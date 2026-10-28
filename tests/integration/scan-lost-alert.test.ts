import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { createCustomerWithRBAC, createPet, createTag, seedMembershipEntitlements } from './helpers';
import { sendPetFoundEmail } from '../../packages/api/src/services/email.service';
import { sendPushToUser } from '../../packages/api/src/services/push-notification.service';

vi.mock('../../packages/api/src/services/email.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../packages/api/src/services/email.service')>();
  return {
    ...actual,
    sendPetFoundEmail: vi.fn().mockResolvedValue({ success: true }),
  };
});

vi.mock('../../packages/api/src/services/push-notification.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../packages/api/src/services/push-notification.service')>();
  return {
    ...actual,
    sendPushToUser: vi.fn().mockResolvedValue({ sent: 1, failed: 0 }),
  };
});

beforeAll(async () => {
  await setupTestDb();
}, 30000);

afterAll(async () => {
  await teardownTestDb();
}, 10000);

beforeEach(async () => {
  await clearDb();
  vi.clearAllMocks();
});

async function notifsFor(userId: string, type?: string) {
  return mongoose.connection.collections.notifications
    .find({ userId: new mongoose.Types.ObjectId(userId), ...(type ? { type } : {}) })
    .toArray();
}

async function historyFor(petId: string) {
  return mongoose.connection.collections.pethistoryevents
    .find({ petId: new mongoose.Types.ObjectId(petId) })
    .sort({ at: -1 })
    .toArray();
}

// ═══════════════════════════════════════════
// LEVEL-1 SCAN ALERT (business rule)
// ═══════════════════════════════════════════

describe('Integration: scan → potential lost pet alert', () => {
  it('a scan creates scan history + owner prompt and NEVER changes pet status', async () => {
    const { userId } = await createCustomerWithRBAC({ email: 'scan-owner@example.com' });
    const petId = await createPet(userId, { name: 'Bailey', status: 'safe' });
    await createTag(userId, petId, { tagId: 'TAG-SCAN-001' });

    const res = await request(app).get('/api/finder/TAG-SCAN-001');
    expect(res.status).toBe(200);

    // Business rule core: scan alone never marks the pet lost.
    const pet = await mongoose.connection.collections.pets.findOne({ _id: new mongoose.Types.ObjectId(petId) });
    expect(pet?.status).toBe('safe');

    // Level-1 prompt for the owner (in-app only, unread)
    const prompts = await notifsFor(userId, 'finder_scan');
    expect(prompts.length).toBe(1);
    expect(prompts[0].read).toBe(false);
    expect(prompts[0].message).toMatch(/scanned/i);
    expect(String(prompts[0].message)).toMatch(/is (Bailey|safe)/i);
    // Safety prompts are in-app only (founder two-level rule) — no push
    expect(vi.mocked(sendPushToUser)).not.toHaveBeenCalled();

    // History: scan recorded + owner prompted (approximation recorded as none/approximate, never precise)
    const history = await historyFor(petId);
    const types = history.map((e) => e.type);
    expect(types).toContain('scan_received');
    expect(types).toContain('owner_prompted');
    for (const e of history) {
      expect(e.precision === 'precise').toBe(false);
    }
  });

  it('keeps ONE unread prompt no matter how many scans arrive, but records every scan in history', async () => {
    const { userId } = await createCustomerWithRBAC({ email: 'scan-dedupe@example.com' });
    const petId = await createPet(userId, { name: 'Rex', status: 'safe' });
    await createTag(userId, petId, { tagId: 'TAG-SCAN-DEDUPE' });

    await request(app).get('/api/finder/TAG-SCAN-DEDUPE');
    await request(app).get('/api/finder/TAG-SCAN-DEDUPE');
    await request(app).get('/api/finder/TAG-SCAN-DEDUPE');

    const prompts = await notifsFor(userId, 'finder_scan');
    expect(prompts.length).toBe(1); // no notification storms while prompt unread

    const history = await historyFor(petId);
    expect(history.filter((e) => e.type === 'scan_received').length).toBe(3); // every scan is history
    expect(history.filter((e) => e.type === 'owner_prompted').length).toBe(1);
  });

  it('re-arms after the owner acknowledges (Option B) when the floor has elapsed', async () => {
    const { userId, token } = await createCustomerWithRBAC({ email: 'scan-rearm@example.com' });
    const petId = await createPet(userId, { name: 'Sky', status: 'safe' });
    await createTag(userId, petId, { tagId: 'TAG-SCAN-REARM' });
    // Floor 0 = next scan may prompt as soon as the owner has responded
    await mongoose.connection.collections.settings.insertOne({
      key: 'scanAlert.remindFloorMinutes', value: '0',
    });

    await request(app).get('/api/finder/TAG-SCAN-REARM');
    const first = await notifsFor(userId, 'finder_scan');
    expect(first.length).toBe(1);

    const ack = await request(app)
      .put(`/api/customer/notifications/${first[0]._id}/ack`)
      .set('Authorization', `Bearer ${token}`);
    expect(ack.status).toBe(200);

    // Unread prompt blocked re-prompting… but the response re-arms it.
    await request(app).get('/api/finder/TAG-SCAN-REARM');
    const prompts = await notifsFor(userId, 'finder_scan');
    expect(prompts.length).toBe(2);
    expect(prompts.filter((p) => p.read === false).length).toBe(1); // still exactly one open prompt
  });

  it('the floor suppresses re-prompting right after a response (no tap-spam loops)', async () => {
    const { userId, token } = await createCustomerWithRBAC({ email: 'scan-floor@example.com' });
    const petId = await createPet(userId, { name: 'Dash', status: 'safe' });
    await createTag(userId, petId, { tagId: 'TAG-SCAN-FLOOR' });
    await mongoose.connection.collections.settings.insertOne({
      key: 'scanAlert.remindFloorMinutes', value: '60',
    });

    await request(app).get('/api/finder/TAG-SCAN-FLOOR');
    const prompts = await notifsFor(userId, 'finder_scan');
    expect(prompts.length).toBe(1);

    // Owner looks at the prompt in the list (plain read, still "responded" for floor purposes)
    await request(app)
      .put(`/api/customer/notifications/${prompts[0]._id}/read`)
      .set('Authorization', `Bearer ${token}`);

    // Immediate rescan inside the 60-minute floor → no new prompt
    await request(app).get('/api/finder/TAG-SCAN-FLOOR');
    expect((await notifsFor(userId, 'finder_scan')).length).toBe(1);

    // …but the scan still lands in history either way
    const history = await historyFor(petId);
    expect(history.filter((e) => e.type === 'scan_received').length).toBe(2);
  });

  it('a scan on a pet already in Lost Mode raises a high-priority SIGHTING alert (in-app + push)', async () => {
    const { userId } = await createCustomerWithRBAC({ email: 'scan-lost@example.com' });
    const petId = await createPet(userId, { name: 'Luna', status: 'lost' });
    await createTag(userId, petId, { tagId: 'TAG-SCAN-LOST' });

    await request(app).get('/api/finder/TAG-SCAN-LOST');

    // The reunification-critical moment: a sighting replaces the safety prompt
    const prompts = await notifsFor(userId, 'finder_scan');
    expect(prompts.length).toBe(1);
    expect(prompts[0].title).toMatch(/Possible sighting of Luna/i);
    expect(prompts[0].priority).toBe('high');
    expect(String(prompts[0].message)).toMatch(/Lost Mode page/i);
    expect((prompts[0].data as any).kind).toBe('sighting');
    expect(vi.mocked(sendPushToUser)).toHaveBeenCalledTimes(1); // sightings push

    // …and the sighting still lands in history (as its own event type)
    const history = await historyFor(petId);
    const types = history.map((e) => e.type);
    expect(types).toContain('scan_received');
    expect(types).toContain('sighting_alerted');
    expect(types).not.toContain('owner_prompted');
  });

  it('grant-time share then notify with the same coords keeps ONE LocationEvent (dedupe)', async () => {
    const { userId } = await createCustomerWithRBAC({ email: 'share-dedupe@example.com' });
    const petId = await createPet(userId, { name: 'Nori', status: 'lost' });
    await createTag(userId, petId, { tagId: 'TAG-SHARE-DEDUPE' });

    // The finder scanned first (creates the FinderScan row the share updates)
    await request(app).get('/api/finder/TAG-SHARE-DEDUPE');

    // 1) Finder grants at the banner — standalone share, no notify submitted
    const share = await request(app)
      .post('/api/finder/TAG-SHARE-DEDUPE/share-location')
      .send({ latitude: -36.9001, longitude: 174.7401, accuracy: 15 });
    expect(share.status).toBe(200);

    // Owner already has the spot (even if the finder walks away), with the
    // consent trail and a precise history event carrying coordinates.
    let events = await mongoose.connection.collections.locationevents
      .find({ petId: new mongoose.Types.ObjectId(petId) })
      .toArray();
    expect(events.length).toBe(1);
    expect(events[0].location.source).toBe('qr_scan');

    const history = await historyFor(petId);
    const shared = history.find((e) => e.type === 'finder_location_shared') as any;
    expect(shared).toBeTruthy();
    expect(shared.metadata.standalone).toBe(true);
    expect(shared.metadata.latitude).toBeCloseTo(-36.9001);
    expect(shared.precision).toBe('precise');

    const tagRow = await mongoose.connection.collections.tags.findOne({ tagId: 'TAG-SHARE-DEDUPE' });
    const scans = await mongoose.connection.collections.finderscans
      .find({ tagId: tagRow!._id })
      .toArray();
    expect(scans.length).toBe(1);
    expect(scans[0].consent?.locationConsent).toBe('granted'); // server-recorded consent

    // 2) Finder then submits notify WITH the same coordinates → no duplicate
    const notify = await request(app)
      .post('/api/finder/TAG-SHARE-DEDUPE/notify')
      .send({
        finderPhone: '+64211234567',
        latitude: -36.9001,
        longitude: 174.7401,
        accuracy: 15,
        consent: { locationConsent: 'granted' },
      });
    expect(notify.status).toBe(200);

    events = await mongoose.connection.collections.locationevents
      .find({ petId: new mongoose.Types.ObjectId(petId) })
      .toArray();
    expect(events.length).toBe(1); // still one — same physical spot
  });
});

// ═══════════════════════════════════════════
// OWNER CONFIRMATION + LOST EPISODE
// ═══════════════════════════════════════════

describe('Integration: owner confirmation → lost → reunion', () => {
  it('mark-lost is explicit, idempotent, records history, and resolves scan prompts', async () => {
    const { userId, token } = await createCustomerWithRBAC({ email: 'lost-owner@example.com' });
    const petId = await createPet(userId, { name: 'Coco', status: 'safe' });
    await createTag(userId, petId, { tagId: 'TAG-LOST-001' });

    // Owner has an outstanding scan prompt
    await request(app).get('/api/finder/TAG-LOST-001');
    expect((await notifsFor(userId, 'finder_scan'))[0].read).toBe(false);

    const first = await request(app)
      .post(`/api/customer/pets/${petId}/mark-lost`)
      .set('Authorization', `Bearer ${token}`);
    expect(first.status).toBe(200);

    // Repeat confirmation (double-tap/retry) must not inflate the episode
    const second = await request(app)
      .post(`/api/customer/pets/${petId}/mark-lost`)
      .set('Authorization', `Bearer ${token}`);
    expect(second.status).toBe(200);

    const pet = await mongoose.connection.collections.pets.findOne({ _id: new mongoose.Types.ObjectId(petId) });
    expect(pet?.status).toBe('lost');
    expect(pet?.lostCount).toBe(1);

    const history = await historyFor(petId);
    expect(history.filter((e) => e.type === 'lost_activated').length).toBe(1);

    // Scan prompts for this pet are resolved once Lost Mode is active
    const prompts = await notifsFor(userId, 'finder_scan');
    expect(prompts.every((p) => p.read === true)).toBe(true);
  });

  it('mark-found confirms reunion, keeps history, and restores safe status', async () => {
    const { userId, token } = await createCustomerWithRBAC({ email: 'reunion-owner@example.com' });
    const petId = await createPet(userId, { name: 'Poppy', status: 'lost' });
    await createTag(userId, petId, { tagId: 'TAG-REUNION-001' });

    await request(app).get('/api/finder/TAG-REUNION-001'); // earlier scan → history must survive reunion

    const res = await request(app)
      .post(`/api/customer/pets/${petId}/mark-found`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const pet = await mongoose.connection.collections.pets.findOne({ _id: new mongoose.Types.ObjectId(petId) });
    expect(pet?.status).toBe('safe');

    const history = await historyFor(petId);
    const types = history.map((e) => e.type);
    expect(types).toContain('reunion_confirmed');
    // History survives reunion — nothing is deleted on recovery
    expect(types).toContain('scan_received');
  });

  it('another customer cannot change this pet status (ownership enforced)', async () => {
    const owner = await createCustomerWithRBAC({ email: 'owner-a@example.com' });
    const intruder = await createCustomerWithRBAC({ email: 'intruder@example.com' });
    const petId = await createPet(owner.userId, { status: 'safe' });

    const res = await request(app)
      .post(`/api/customer/pets/${petId}/mark-lost`)
      .set('Authorization', `Bearer ${intruder.token}`);
    expect(res.status).toBe(404);

    const pet = await mongoose.connection.collections.pets.findOne({ _id: new mongoose.Types.ObjectId(petId) });
    expect(pet?.status).toBe('safe');
  });
});

// ═══════════════════════════════════════════
// PET HISTORY ENDPOINT
// ═══════════════════════════════════════════

describe('Integration: pet history timeline', () => {
  it('returns the owner-scoped timeline newest first with bounded limits', async () => {
    const { userId, token } = await createCustomerWithRBAC({ email: 'history-owner@example.com' });
    const petId = await createPet(userId, { status: 'lost' });
    await createTag(userId, petId, { tagId: 'TAG-HISTORY-001' });

    await request(app).get('/api/finder/TAG-HISTORY-001'); // scan_received
    await request(app)
      .post('/api/finder/TAG-HISTORY-001/notify')
      .send({ finderPhone: '+64211111111', finderName: 'Kind Finder' }); // finder_notified + notification_attempted

    const res = await request(app)
      .get(`/api/customer/pets/${petId}/history`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const events = res.body.data;
    expect(events.length).toBeGreaterThanOrEqual(3);
    const types = events.map((e: any) => e.type);
    expect(types).toContain('scan_received');
    expect(types).toContain('finder_notified');
    expect(types).toContain('notification_attempted');
    // Newest first
    const times = events.map((e: any) => new Date(e.at).getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);

    // Limit is honoured and hard-capped
    const limited = await request(app)
      .get(`/api/customer/pets/${petId}/history?limit=2`)
      .set('Authorization', `Bearer ${token}`);
    expect(limited.body.data.length).toBe(2);

    // Cursor pagination
    const lastAt = events[events.length - 1].at;
    const paged = await request(app)
      .get(`/api/customer/pets/${petId}/history?limit=50&before=${encodeURIComponent(lastAt)}`)
      .set('Authorization', `Bearer ${token}`);
    expect(paged.body.data.length).toBe(0);

    // Wrong owner → 404 (no existence leak)
    const intruder = await createCustomerWithRBAC({ email: 'history-intruder@example.com' });
    const forbidden = await request(app)
      .get(`/api/customer/pets/${petId}/history`)
      .set('Authorization', `Bearer ${intruder.token}`);
    expect(forbidden.status).toBe(404);
  });

  it('records honest per-channel notification attempt statuses', async () => {
    const { userId, token } = await createCustomerWithRBAC({ email: 'delivery-owner@example.com' });
    const petId = await createPet(userId, { name: 'Milo', status: 'lost' });
    await createTag(userId, petId, { tagId: 'TAG-DELIVERY-001' });

    await request(app)
      .post('/api/finder/TAG-DELIVERY-001/notify')
      .send({ finderPhone: '+64211111111' });
    expect(sendPetFoundEmail).toHaveBeenCalledTimes(1);

    const history = await historyFor(petId);
    const attempt = history.find((e) => e.type === 'notification_attempted');
    expect(attempt).toBeTruthy();
    const channels = (attempt as any).metadata.channels;
    expect(channels.email).toBe('sent'); // mocked provider resolved
    expect(channels.inApp).toBe('created');
    expect(['sent', 'failed']).toContain(channels.push);

    const finderEvent = history.find((e) => e.type === 'finder_notified');
    expect((finderEvent as any).metadata.finderPhone).toBe('+64211111111');
  });
});

// ═══════════════════════════════════════════
// APP-WIDE ALERT SURFACES + ACK
// ═══════════════════════════════════════════

describe('Integration: active alerts + acknowledge', () => {
  it('exposes unread alerts with Level-2 first, hides scan prompts for lost pets, lists lost pets', async () => {
    const { userId, token } = await createCustomerWithRBAC({ email: 'alerts-owner@example.com' });
    const petId = await createPet(userId, { name: 'Ziggy', status: 'safe' });
    await createTag(userId, petId, { tagId: 'TAG-ALERTS-001' });
    await request(app).get('/api/finder/TAG-ALERTS-001');

    // Direct fixture: a Level-2 finder-contact alert
    await mongoose.connection.collections.notifications.insertOne({
      userId: new mongoose.Types.ObjectId(userId),
      audience: 'customer',
      type: 'pet_found',
      title: 'Your pet Ziggy has been found!',
      message: 'Someone reached out.',
      priority: 'high',
      read: false,
      channel: 'alert',
      data: {
        petId, petName: 'Ziggy', tagId: 'TAG-ALERTS-001',
        finderName: 'Kind Finder', finderPhone: '+64217770000', finderEmail: 'kind@test.com',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    let res = await request(app)
      .get('/api/customer/notifications/active-alerts')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.alerts.length).toBe(2);
    expect(res.body.data.alerts[0].type).toBe('pet_found'); // Level-2 outranks Level-1
    expect(res.body.data.alerts[0].finderName).toBe('Kind Finder');
    expect(res.body.data.alerts[0].finderPhone).toBe('+64217770000');
    expect(res.body.data.alerts[0].finderEmail).toBe('kind@test.com');
    expect(res.body.data.alerts[1].type).toBe('finder_scan');
    expect(res.body.data.alerts[1].finderPhone).toBeNull(); // bare scans carry no contact
    expect(res.body.data.lostPets).toEqual([]);

    // After the owner activates Lost Mode: every pet prompt is auto-resolved
    // and the lost pet feeds the persistent banner.
    await request(app)
      .post(`/api/customer/pets/${petId}/mark-lost`)
      .set('Authorization', `Bearer ${token}`);

    res = await request(app)
      .get('/api/customer/notifications/active-alerts')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.data.alerts).toEqual([]);
    expect(res.body.data.lostPets).toEqual([{ id: petId, name: 'Ziggy' }]);

    // Defensive: a scan prompt that somehow stays unread for a lost pet must
    // never be surfaced (the owner already acted — Lost Mode is the home now).
    await mongoose.connection.collections.notifications.insertOne({
      userId: new mongoose.Types.ObjectId(userId),
      audience: 'customer',
      type: 'finder_scan',
      title: 'Someone may have found your pet Ziggy!',
      message: 'Your PawTag was scanned recently.',
      priority: 'normal',
      read: false,
      channel: 'alert',
      data: { petId, petName: 'Ziggy', tagId: 'TAG-ALERTS-001' },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    res = await request(app)
      .get('/api/customer/notifications/active-alerts')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.data.alerts).toEqual([]);
    expect(res.body.data.lostPets).toEqual([{ id: petId, name: 'Ziggy' }]);
  });

  it('ack records "owner confirmed pet is safe" history and marks the prompt read', async () => {
    const { userId, token } = await createCustomerWithRBAC({ email: 'ack-owner@example.com' });
    const petId = await createPet(userId, { name: 'Nala', status: 'safe' });
    await createTag(userId, petId, { tagId: 'TAG-ACK-001' });
    await request(app).get('/api/finder/TAG-ACK-001');

    const before = await request(app)
      .get('/api/customer/notifications/active-alerts')
      .set('Authorization', `Bearer ${token}`);
    const alert = before.body.data.alerts[0];
    expect(alert.type).toBe('finder_scan');

    const ack = await request(app)
      .put(`/api/customer/notifications/${alert.id}/ack`)
      .set('Authorization', `Bearer ${token}`);
    expect(ack.status).toBe(200);

    const prompts = await notifsFor(userId, 'finder_scan');
    expect(prompts[0].read).toBe(true);

    const history = await historyFor(petId);
    expect(history.map((e) => e.type)).toContain('owner_prompt_dismissed');

    // Pet status untouched by ack
    const pet = await mongoose.connection.collections.pets.findOne({ _id: new mongoose.Types.ObjectId(petId) });
    expect(pet?.status).toBe('safe');

    // Second fetch: no active alerts remain
    const after = await request(app)
      .get('/api/customer/notifications/active-alerts')
      .set('Authorization', `Bearer ${token}`);
    expect(after.body.data.alerts).toEqual([]);
  });

  it('ack is ownership-scoped', async () => {
    const owner = await createCustomerWithRBAC({ email: 'ack-owner2@example.com' });
    const intruder = await createCustomerWithRBAC({ email: 'ack-intruder@example.com' });
    const petId = await createPet(owner.userId, { status: 'safe' });
    await createTag(owner.userId, petId, { tagId: 'TAG-ACK-002' });
    await request(app).get('/api/finder/TAG-ACK-002');

    const prompts = await notifsFor(owner.userId, 'finder_scan');
    const res = await request(app)
      .put(`/api/customer/notifications/${prompts[0]._id}/ack`)
      .set('Authorization', `Bearer ${intruder.token}`);
    expect(res.status).toBe(404);

    const history = await historyFor(petId);
    expect(history.map((e) => e.type)).not.toContain('owner_prompt_dismissed');
  });
});
