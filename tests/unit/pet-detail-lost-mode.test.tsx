// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

/**
 * Packet 1b (board parity): pet detail + Lost Mode screens.
 * Guards the two things this packet must never get wrong:
 * 1. health data stays entitlement-gated on the new detail screen;
 * 2. Lost Mode never renders a lost-state view for a pet that is not lost.
 */

const pets = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('../../apps/web/src/lib/api', () => ({ default: pets }));

vi.mock('../../apps/web/src/pages/account/HealthRecords', () => ({
  default: ({ pet }: { pet: { name: string } }) => <div>health-records-for-{pet.name}</div>,
}));

import PetDetail from '../../apps/web/src/pages/account/PetDetail';
import LostMode from '../../apps/web/src/pages/account/LostMode';

const SAFE_PET = {
  _id: 'pet1',
  petId: 'PT-DOG-1',
  name: 'Buddy',
  petType: 'Dog',
  breed: 'Golden Retriever',
  status: 'safe',
  photos: [],
  medicalAlerts: '',
  vaccinations: [{ vaccine: 'Rabies' }],
  allergies: [],
  healthConditions: [],
  vetDetails: [{ clinicName: 'Ponsonby Vet' }],
  favouriteFood: 'Chicken',
};

const LOST_PET = { ...SAFE_PET, status: 'lost', lostCount: 2 };

function apiGetImpl(overrides: { pet?: Record<string, unknown>; entitlement?: boolean } = {}) {
  pets.get.mockImplementation((url: string) => {
    if (url === '/customer/pets/pet1') {
      return Promise.resolve({ data: { data: overrides.pet ?? SAFE_PET } });
    }
    if (url === '/customer/tags') {
      return Promise.resolve({
        data: { data: [{ _id: 'tag1', tagId: 'PT284719', petId: 'pet1', status: 'active' }] },
      });
    }
    if (url.endsWith('/locations')) {
      return Promise.resolve({
        data: {
          data: [
            {
              _id: 'loc1',
              timestamp: new Date().toISOString(),
              location: { latitude: -36.8, longitude: 174.7, source: 'qr_scan' },
              notes: 'Seen near the park',
            },
          ],
        },
      });
    }
    if (url.includes('membership/entitlements')) {
      const on = overrides.entitlement === true;
      return Promise.resolve({
        data: { data: { entitlements: { pet_health_records: { enabled: on, value: on } } } },
      });
    }
    if (url.includes('escalations')) return Promise.resolve({ data: { data: [] } });
    if (url.includes('found-timer')) return Promise.resolve({ data: { data: { active: false } } });
    return Promise.resolve({ data: { data: null } });
  });
  pets.post.mockResolvedValue({ data: { data: {} } });
}

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={['/account/pets/pet1']}>
      <Routes>
        <Route path="/account/pets/:id" element={<PetDetail />} />
        <Route path="/account/pets/:id/lost" element={<div>lost-mode-screen</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderLost() {
  return render(
    <MemoryRouter initialEntries={['/account/pets/pet1/lost']}>
      <Routes>
        <Route path="/account/pets/:id/lost" element={<LostMode />} />
        <Route path="/account/pets/:id" element={<div>detail-screen</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PetDetail', () => {
  it('renders identity, tag status and last-seen from real data', async () => {
    apiGetImpl();
    renderDetail();
    expect(await screen.findByRole('heading', { name: 'Buddy' })).toBeTruthy();
    expect(screen.getByText('PawTag #PT284719')).toBeTruthy();
    expect(screen.getByText(/Last seen/)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Edit/ })).toBeTruthy();
  });

  it('keeps health data entitlement-gated: locked users see the upsell, never counts', async () => {
    apiGetImpl({ entitlement: false });
    renderDetail();
    await screen.findByRole('heading', { name: 'Buddy' });
    expect(screen.getByText(/membership benefit/)).toBeTruthy();
    expect(screen.queryByText(/1 vaccination/)).toBeNull();
    expect(screen.queryByText(/Ponsonby Vet/)).toBeNull();
  });

  it('entitled users see the health summary with real record counts', async () => {
    apiGetImpl({ entitlement: true });
    renderDetail();
    await screen.findByRole('heading', { name: 'Buddy' });
    expect(screen.getByText('1 vaccination on file')).toBeTruthy();
    expect(screen.getByText('No known allergies')).toBeTruthy();
    expect(screen.getByText('All good')).toBeTruthy();
  });

  it('gates Mark as Lost behind explicit confirmation, then posts the real endpoint', async () => {
    apiGetImpl();
    renderDetail();
    const btn = await screen.findByRole('button', { name: /Mark as Lost/ });
    fireEvent.click(btn);

    // Confirmation dialog first — the first tap must NEVER change status.
    expect(await screen.findByText('Are you sure your pet is lost?')).toBeTruthy();
    expect(pets.post).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Yes, Activate Lost Mode' }));
    await waitFor(() => expect(pets.post).toHaveBeenCalledWith('/customer/pets/pet1/mark-lost'));
    // then opens the Lost Mode screen
    expect(await screen.findByText('lost-mode-screen')).toBeTruthy();
  });

  it('gates Mark as Found behind reunion confirmation', async () => {
    apiGetImpl({ pet: LOST_PET });
    renderDetail();
    const btn = await screen.findByRole('button', { name: /Mark as Found/ });
    fireEvent.click(btn);
    expect(await screen.findByText('Has your pet been safely reunited with you?')).toBeTruthy();
    expect(pets.post).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Yes, My Pet Is Reunited' }));
    await waitFor(() => expect(pets.post).toHaveBeenCalledWith('/customer/pets/pet1/mark-found'));
  });
});

describe('LostMode', () => {
  it('renders the lost state with truthful capabilities and shared locations', async () => {
    apiGetImpl({ pet: LOST_PET });
    renderLost();
    expect(await screen.findByRole('heading', { name: 'Buddy is in Lost Mode' })).toBeTruthy();
    expect(screen.getByText(/Shared on tag scan/)).toBeTruthy();
    expect(screen.getByText(/Finders can scan the tag/)).toBeTruthy();
    // no fake GPS/location-toggle claims
    expect(screen.queryByText(/location sharing is on/i)).toBeNull();
  });

  it('never shows a lost-state view for a pet that is not lost', async () => {
    apiGetImpl({ pet: SAFE_PET });
    renderLost();
    expect(await screen.findByText(/is not in Lost Mode/)).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /is in Lost Mode/ })).toBeNull();
  });

  it('copies the finder recovery link for the linked tag', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    apiGetImpl({ pet: LOST_PET });
    renderLost();
    const share = await screen.findByRole('button', { name: /Share Buddy's lost pet profile/ });
    fireEvent.click(share);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/PT284719')));
  });
});
