// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';

/**
 * CartContext — guest→account merge (login bug regression) + guest TTL.
 *
 * Regression context: the old design listened for the cross-tab `storage`
 * event to detect login and sync the guest cart. That event NEVER fires
 * in the tab that signed in, so a same-tab login (the normal flow: cart
 * → sign in → back) stranded the guest cart in localStorage while the
 * account cart rendered EMPTY from the server. The fix merges on read:
 * refreshCart folds stranded guest items in whenever a token is present.
 */

const { authState, apiMock } = vi.hoisted(() => ({
  authState: { token: null as string | null },
  apiMock: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../apps/web/src/context/AuthContext', () => ({
  useAuth: () => ({ token: authState.token }),
}));

vi.mock('../../apps/web/src/lib/api', () => ({ default: apiMock }));

import { CartProvider, useCart } from '../../apps/web/src/context/CartContext';

const GUEST_KEY = 'pawtag_guest_cart';

function CartProbe() {
  const { items, itemCount, isGuest, addItem } = useCart();
  return (
    <div>
      <span data-testid="count">{itemCount}</span>
      <span data-testid="names">{items.map((i) => i.productName || i.name).join(',')}</span>
      <span data-testid="texts">{items.flatMap((i) => i.customisationTexts || []).join('|')}</span>
      <span data-testid="guest">{isGuest ? 'guest' : 'member'}</span>
      <button
        onClick={() => addItem({ productId: 'p-1', quantity: 1, name: 'PawTag', price: 39 })}
      >
        add
      </button>
    </div>
  );
}

function renderCart() {
  return render(
    <CartProvider>
      <CartProbe />
    </CartProvider>,
  );
}

function serverCartResponse(items: Array<Record<string, unknown>>) {
  return { data: { data: { cart: { items }, totals: { total: 0 } } } };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  authState.token = null;
  // Default: empty server cart for every GET
  apiMock.get.mockResolvedValue(serverCartResponse([]));
  apiMock.post.mockResolvedValue({ data: { data: { cart: { items: [] } } } });
  apiMock.put.mockResolvedValue({ data: { data: { cart: { items: [] } } } });
});

describe('guest → account cart merge (same-tab login)', () => {
  it('folds a stranded guest item into the account cart after same-tab login', async () => {
    // 1. Signed-out user adds an item → guest cart in localStorage
    authState.token = null;
    const first = renderCart();
    await act(async () => {
      screen.getByText('add').click();
    });
    expect(localStorage.getItem(GUEST_KEY)).toBeTruthy();
    expect(screen.getByTestId('count').textContent).toBe('1');
    first.unmount();

    // 2. Same-tab login: token appears (context + localStorage, as the
    //    real login flow writes both), guest cart still stranded.
    //    Mock per-URL so the free-shifting threshold GET doesn't disturb
    //    the cart sequencing: 1st /cart GET (merge dup-check) sees an
    //    empty server cart; after the merge POST, the final load returns
    //    the merged item.
    authState.token = 'tok-123';
    localStorage.setItem('pawtag_token', 'tok-123');
    let cartGets = 0;
    apiMock.get.mockImplementation((url: string) => {
      if (url === '/cart') {
        cartGets += 1;
        return Promise.resolve(
          cartGets === 1
            ? serverCartResponse([])
            : serverCartResponse([{ _id: 's1', productId: 'p-1', productName: 'PawTag', quantity: 1, customisation: false }]),
        );
      }
      return Promise.resolve({ data: { data: { threshold: null } } });
    });
    renderCart();

    // 3. The merged item renders — NOT an empty cart
    await waitFor(() => {
      expect(screen.getByTestId('names').textContent).toContain('PawTag');
    });
    // Guest storage cleared after successful merge
    expect(localStorage.getItem(GUEST_KEY)).toBeNull();
    // The item was POSTed to the server cart
    expect(apiMock.post).toHaveBeenCalledWith('/cart/items', expect.objectContaining({ productId: 'p-1' }));
  });

  it('merges only once even when refreshCart runs concurrently', async () => {
    localStorage.setItem(
      GUEST_KEY,
      JSON.stringify({ v: 1, savedAt: Date.now(), items: [{ productId: 'p-1', productName: 'PawTag', quantity: 1, unitPrice: 39, customizationTotal: 0 }] }),
    );
    authState.token = 'tok-123';
    localStorage.setItem('pawtag_token', 'tok-123');

    let resolvePost!: (v: unknown) => void;
    apiMock.post.mockReturnValue(new Promise((r) => { resolvePost = r; }));

    renderCart();

    // Wait for the in-flight POST, then resolve it
    await waitFor(() => expect(apiMock.post).toHaveBeenCalledTimes(1));
    await act(async () => { resolvePost({ data: { data: { cart: { items: [] } } } }); });

    // Mount + auth-transition refreshes all awaited the SAME merge
    expect(apiMock.post).toHaveBeenCalledTimes(1);
  });

  it('keeps the guest item in storage when the merge POST fails (retries next read)', async () => {
    localStorage.setItem(
      GUEST_KEY,
      JSON.stringify({ v: 1, savedAt: Date.now(), items: [{ productId: 'p-1', productName: 'PawTag', quantity: 1, unitPrice: 39, customizationTotal: 0 }] }),
    );
    authState.token = 'tok-123';
    localStorage.setItem('pawtag_token', 'tok-123');
    apiMock.post.mockRejectedValue(new Error('network down'));

    renderCart();

    await waitFor(() => expect(apiMock.post).toHaveBeenCalled());
    // Item NOT lost — still in guest storage for the next attempt
    expect(localStorage.getItem(GUEST_KEY)).toBeTruthy();
  });

  it('preserves engraving texts through the merge', async () => {
    localStorage.setItem(
      GUEST_KEY,
      JSON.stringify({
        v: 1,
        savedAt: Date.now(),
        items: [{
          productId: 'p-1', productName: 'PawTag', quantity: 1, unitPrice: 39,
          customizationTotal: 0, customisation: true, customisationTexts: ['KFC'],
        }],
      }),
    );
    authState.token = 'tok-123';
    localStorage.setItem('pawtag_token', 'tok-123');

    renderCart();

    await waitFor(() => expect(apiMock.post).toHaveBeenCalled());
    expect(apiMock.post).toHaveBeenCalledWith(
      '/cart/items',
      expect.objectContaining({ customisation: true, customisationTexts: ['KFC'] }),
    );
  });

  it('never merges for a signed-out user (guest cart loads from storage)', async () => {
    localStorage.setItem(
      GUEST_KEY,
      JSON.stringify({ v: 1, savedAt: Date.now(), items: [{ productId: 'p-1', productName: 'PawTag', quantity: 2, unitPrice: 39, customizationTotal: 0 }] }),
    );
    authState.token = null;

    renderCart();

    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'));
    expect(apiMock.post).not.toHaveBeenCalled();
    expect(screen.getByTestId('guest').textContent).toBe('guest');
  });
});

describe('guest cart 30-day TTL', () => {
  it('drops a guest cart older than 30 days', () => {
    const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
    localStorage.setItem(
      GUEST_KEY,
      JSON.stringify({ v: 1, savedAt: thirtyOneDaysAgo, items: [{ productId: 'p-old', productName: 'Old', quantity: 1, unitPrice: 10, customizationTotal: 0 }] }),
    );
    authState.token = null;

    renderCart();

    // Expired cart is gone — not rendered, storage cleared
    expect(screen.getByTestId('count').textContent).toBe('0');
    expect(localStorage.getItem(GUEST_KEY)).toBeNull();
  });

  it('keeps a guest cart within 30 days and refreshes its stamp on write', async () => {
    const tenDaysAgo = Date.now() - 10 * 24 * 60 * 60 * 1000;
    localStorage.setItem(
      GUEST_KEY,
      JSON.stringify({ v: 1, savedAt: tenDaysAgo, items: [{ productId: 'p-1', productName: 'Fresh', quantity: 1, unitPrice: 10, customizationTotal: 0 }] }),
    );
    authState.token = null;

    renderCart();
    expect(screen.getByTestId('count').textContent).toBe('1');

    // Adding an item re-stamps savedAt (extends the 30-day window)
    await act(async () => {
      screen.getByText('add').click();
    });
    const stored = JSON.parse(localStorage.getItem(GUEST_KEY)!);
    expect(stored.savedAt).toBeGreaterThan(Date.now() - 1000);
  });

  it('still reads a legacy bare-array guest cart (pre-envelope format)', () => {
    localStorage.setItem(
      GUEST_KEY,
      JSON.stringify([{ productId: 'p-1', productName: 'Legacy', quantity: 1, unitPrice: 10, customizationTotal: 0 }]),
    );
    authState.token = null;

    renderCart();
    expect(screen.getByTestId('count').textContent).toBe('1');
  });
});
