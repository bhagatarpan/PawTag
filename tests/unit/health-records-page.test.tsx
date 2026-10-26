// @vitest-environment happy-dom
/**
 * Health Records full-page redesign (implementation-package Phase 2):
 *
 * 1. Durable route: /account/pets/:id/health exists and renders INSIDE the
 *    account shell — no modal overlay anywhere (source guard).
 * 2. All nine categories reachable via an accessible selector (aria-current),
 *    seeded from the pet payload exactly as the modal was.
 * 3. Existing CRUD contract preserved: save posts/puts the same section
 *    endpoints, delete hits sectionItem with the existing confirm().
 * 4. Entitlement gate re-checked on the page (pet_health_records) — without
 *    it the page locks to the membership card, never data.
 * 5. Desexing edit reachability regression: the old modal's Edit button set
 *    state but the render branch never showed a form — the page now opens
 *    one and saves through the existing PUT /desexing endpoint.
 */
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { API } from '@pawtag/shared/api';

const { apiMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('../../apps/web/src/lib/api', () => ({ default: apiMock }));

import HealthRecords from '../../apps/web/src/pages/account/HealthRecords';

const pet = {
  _id: 'p1',
  name: 'Bailey',
  petType: 'Dog',
  breed: 'Golden Retriever',
  dateOfBirth: '2023-05-01',
  vaccinations: [{ _id: 'v1', vaccine: 'Rabies', vaccineType: 'core', dateGiven: '2026-01-05' }],
  medications: [{ _id: 'm1', name: 'Apoquel', dosage: '5.4 mg' }],
  microchips: [],
  allergies: [],
  vetDetails: [],
  surgeries: [],
  weightHistory: [],
  healthConditions: [],
  desexing: { isDesexed: false },
};

let entitled = true;

function mockApi() {
  apiMock.get.mockImplementation((url: string) => {
    if (String(url).includes('entitlements')) {
      return Promise.resolve({
        data: { data: { entitlements: { pet_health_records: { enabled: entitled, value: entitled } } } },
      });
    }
    if (String(url) === API.customer.pets.detail('p1')) {
      return Promise.resolve({ data: { data: pet } });
    }
    return Promise.resolve({ data: { data: [] } }); // section refetches
  });
  apiMock.post.mockResolvedValue({ data: { data: {} } });
  apiMock.put.mockResolvedValue({ data: { data: {} } });
  apiMock.delete.mockResolvedValue({ data: { data: {} } });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/account/pets/p1/health']}>
      <Routes>
        <Route path="/account/pets/:id/health" element={<HealthRecords />} />
      </Routes>
    </MemoryRouter>,
  );
}

const readSrc = (rel: string) => readFileSync(path.resolve(__dirname, '../../', rel), 'utf8');

beforeEach(() => {
  apiMock.get.mockReset();
  apiMock.post.mockReset();
  apiMock.put.mockReset();
  apiMock.delete.mockReset();
  entitled = true;
  mockApi();
});

describe('route wiring (source guards)', () => {
  it('App.tsx registers /account/pets/:id/health inside the shell', () => {
    const src = readSrc('apps/web/src/App.tsx');
    expect(src).toContain('path="/account/pets/:id/health"');
    expect(src).toContain('<AccountLayout><HealthRecords />');
  });

  it('PetDetail and MyPets navigate instead of mounting a modal', () => {
    // `canAccessHealthRecords` contains the substring — match the module import instead.
    expect(readSrc('apps/web/src/pages/account/PetDetail.tsx')).not.toContain("from './HealthRecords'");
    expect(readSrc('apps/web/src/pages/account/MyPets.tsx')).not.toContain("from './HealthRecords'");
  });
});

describe('Health Records page', () => {
  it('renders identity, all nine categories and seeded records — no modal overlay', async () => {
    renderPage();
    const h1 = await screen.findByRole('heading', { level: 1 });
    expect(h1.textContent).toContain('Bailey');

    const nav = screen.getByRole('navigation', { name: 'Health record categories' });
    const cats = within(nav).getAllByRole('button');
    expect(cats.map((c) => c.textContent?.trim())).toEqual([
      'Vaccinations', 'Microchips', 'Medications', 'Allergies', 'Vet Details',
      'Surgeries', 'Weight', 'Conditions', 'Desexing',
    ]);
    expect(cats[0].getAttribute('aria-current')).toBe('page');

    expect(await screen.findByText('Rabies')).toBeDefined();
    expect(readSrc('apps/web/src/pages/account/HealthRecords.tsx')).not.toContain('fixed inset-0');
  });

  it('switches categories and shows that category’s data + selection state', async () => {
    renderPage();
    await screen.findByText('Rabies');
    fireEvent.click(screen.getByRole('button', { name: 'Medications' }));
    expect(await screen.findByText('Apoquel')).toBeDefined();
    expect(screen.queryByText('Rabies')).toBeNull();
    const nav = screen.getByRole('navigation', { name: 'Health record categories' });
    expect(within(nav).getByRole('button', { name: 'Medications' }).getAttribute('aria-current')).toBe('page');
    expect(within(nav).getByRole('button', { name: 'Vaccinations' }).getAttribute('aria-current')).toBeNull();
  });

  it('opens an inline add form and saves through the existing section endpoint', async () => {
    renderPage();
    await screen.findByText('Rabies');
    fireEvent.click(screen.getByRole('button', { name: /Add record/ }));
    expect(await screen.findByRole('heading', { name: /Add vaccinations/i })).toBeDefined();

    fireEvent.change(screen.getByLabelText('Vaccine *'), { target: { value: 'Kennel Cough' } });
    fireEvent.click(screen.getByRole('button', { name: /Save record/ }));

    await waitFor(() =>
      expect(apiMock.post).toHaveBeenCalledWith(
        API.customer.pets.section('p1', 'vaccinations'),
        expect.objectContaining({ vaccine: 'Kennel Cough' }),
      ),
    );
    // Inline: form returns to the list (no overlay was ever involved).
    await waitFor(() => expect(screen.queryByRole('heading', { name: /Add vaccinations/i })).toBeNull());
  });

  it('edit prefills the form; delete confirms and hits the existing endpoint', async () => {
    renderPage();
    await screen.findByText('Rabies');

    fireEvent.click(screen.getByLabelText('Edit Rabies'));
    expect(await screen.findByRole('heading', { name: /Edit vaccinations/i })).toBeDefined();
    expect((screen.getByLabelText('Vaccine *') as HTMLInputElement).value).toBe('Rabies');
    fireEvent.click(screen.getByRole('button', { name: /Cancel/ }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: /Edit vaccinations/i })).toBeNull());

    (window as any).confirm = vi.fn().mockReturnValue(true);
    fireEvent.click(screen.getByLabelText('Delete Rabies'));
    await waitFor(() =>
      expect(apiMock.delete).toHaveBeenCalledWith(API.customer.pets.sectionItem('p1', 'vaccinations', 'v1')),
    );
  });

  it('desexing edit opens a form (previously unreachable) and saves via PUT /desexing', async () => {
    renderPage();
    await screen.findByText('Rabies');
    fireEvent.click(screen.getByRole('button', { name: 'Desexing' }));
    expect(await screen.findByText('Not desexed yet')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /Record Desexing/ }));
    expect(await screen.findByRole('heading', { name: 'Record desexing' })).toBeDefined();
    expect((screen.getByLabelText('Desexed') as HTMLInputElement).checked).toBe(true);

    fireEvent.change(screen.getByLabelText('Clinic'), { target: { value: 'Greenwood Vet Clinic' } });
    fireEvent.click(screen.getByRole('button', { name: /Save record/ }));
    await waitFor(() =>
      expect(apiMock.put).toHaveBeenCalledWith(
        API.customer.pets.desexing('p1'),
        expect.objectContaining({ clinic: 'Greenwood Vet Clinic', isDesexed: true }),
      ),
    );
  });

  it('locks to the membership card without the pet_health_records entitlement', async () => {
    entitled = false;
    mockApi();
    renderPage();
    expect(await screen.findByText(/membership benefit/)).toBeDefined();
    expect(screen.queryByRole('button', { name: /Add record/ })).toBeNull();
    expect(screen.queryByText('Rabies')).toBeNull();
  });
});
