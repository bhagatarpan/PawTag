// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

/**
 * Prompt-resolution contract for the app-wide lost-pet alert:
 * - "View Scan Details" is NOT a decision — it must never write to the API
 *   (no read-mark), so the alert stays open (regression: owner could no
 *   longer click "My Pet Is Safe" after viewing).
 * - "My Pet Is Safe" uses the dedicated ack endpoint.
 * - "Confirm Pet Is Lost" goes through the confirmation dialog and only then
 *   posts the real mark-lost endpoint.
 */

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}));

vi.mock('../../apps/web/src/lib/api', () => ({ default: apiMock }));

import LostPetAlertHost, { type ActiveAlertState } from '../../apps/web/src/components/LostPetAlertHost';

const STATE: ActiveAlertState = {
  alerts: [
    {
      id: 'n1',
      type: 'finder_scan',
      petId: 'p1',
      petName: 'Zappy',
      area: 'Blockhouse Bay, Auckland',
      title: 'Someone may have found your pet Zappy!',
      message: 'Your PawTag was scanned recently. Is Zappy safe with you?',
      actionUrl: '/account/pets/p1',
      createdAt: '2026-10-27T10:00:00.000Z',
    },
  ],
  lostPets: [],
};

function renderHost(state: ActiveAlertState = STATE) {
  return render(
    <MemoryRouter initialEntries={['/account']}>
      <Routes>
        <Route path="/account" element={<LostPetAlertHost state={state} onChanged={vi.fn()} />} />
        <Route path="/account/pets/:id" element={<div data-testid="pet-detail" />} />
        <Route path="/account/pets/:id/lost" element={<div data-testid="lost-mode" />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.post.mockResolvedValue({ data: { data: {} } });
  apiMock.put.mockResolvedValue({ data: { data: {} } });
});

describe('LostPetAlertHost prompt resolution', () => {
  it('View Scan Details navigates WITHOUT any API write — the prompt stays open', async () => {
    renderHost();
    fireEvent.click(await screen.findByRole('button', { name: 'View Scan Details' }));

    expect(await screen.findByTestId('pet-detail')).toBeTruthy();
    expect(apiMock.put).not.toHaveBeenCalled();
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it('"My Pet Is Safe" acks via the dedicated ack endpoint and never changes status', async () => {
    renderHost();
    fireEvent.click(await screen.findByRole('button', { name: 'My Pet Is Safe' }));

    await waitFor(() =>
      expect(apiMock.put).toHaveBeenCalledWith(expect.stringContaining('/notifications/n1/ack')),
    );
    expect(apiMock.post).not.toHaveBeenCalled(); // no mark-lost, ever
  });

  it('"Confirm Pet Is Lost" requires the dialog, then posts the real endpoint', async () => {
    renderHost();
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm Pet Is Lost' }));

    // Confirmation first — no status change on the first tap.
    expect(await screen.findByText('Are you sure your pet is lost?')).toBeTruthy();
    expect(apiMock.post).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Yes, Activate Lost Mode' }));
    await waitFor(() =>
      expect(apiMock.post).toHaveBeenCalledWith('/customer/pets/p1/mark-lost'),
    );
    expect(await screen.findByTestId('lost-mode')).toBeTruthy();
  });

  it('renders the persistent PET IS LOST banner from server-derived lost pets', async () => {
    renderHost({
      alerts: [],
      lostPets: [{ id: 'p1', name: 'Zappy' }],
    });
    expect(await screen.findByText('PET IS LOST — Zappy')).toBeTruthy();
    expect(apiMock.put).not.toHaveBeenCalled();
    expect(apiMock.post).not.toHaveBeenCalled();
  });
});
