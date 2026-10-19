// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

/**
 * Engraving cart flow (product rule): an engraving charge exists only once
 * a name is saved.
 *
 * - "Add pet name" opens the editor locally — no server call, no charge
 * - Save atomically sends names + the charge (one call)
 * - Cancel sends nothing (nothing was charged)
 * - Remove engraving toggles the charge off
 * - The drawer shows the engraving as its own priced line so the line
 *   total visibly adds up (base + engraving = subtotal math)
 */

import CartItemCard from '../../apps/web/src/components/cart/CartItemCard';
import { CartDrawer } from '../../packages/ui/src/components/CartDrawer';

const baseItem = {
  _id: 'item1',
  productId: 'prod1',
  productName: 'PawTag Plus',
  unitPrice: 39.99,
  quantity: 1,
  customizable: true,
  customizationLabel: 'Pet name',
  customizationPrice: 19.0,
  customizationTotal: 0,
  customisation: false,
  customisationTexts: [] as string[],
};

describe('CartItemCard engraving flow', () => {
  let onSaveEngraving: ReturnType<typeof vi.fn>;
  let onToggleCustomisation: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onSaveEngraving = vi.fn().mockResolvedValue(undefined);
    onToggleCustomisation = vi.fn().mockResolvedValue(undefined);
  });

  const renderCard = (item: Partial<typeof baseItem> = {}) =>
    render(
      <CartItemCard
        item={{ ...baseItem, ...item } as any}
        onUpdateQuantity={() => {}}
        onRemove={() => {}}
        onSaveEngraving={onSaveEngraving}
        onToggleCustomisation={onToggleCustomisation}
      />,
    );

  it('"Add pet name" opens the editor WITHOUT any server call (no charge)', () => {
    renderCard();
    fireEvent.click(screen.getByText(/Add pet name/i));

    // Editor is open
    expect(screen.getByLabelText('Pet name 1')).toBeTruthy();
    // Nothing was sent — no toggle, no save
    expect(onToggleCustomisation).not.toHaveBeenCalled();
    expect(onSaveEngraving).not.toHaveBeenCalled();
  });

  it('keeps Save disabled while every name field is blank', () => {
    renderCard();
    fireEvent.click(screen.getByText(/Add pet name/i));

    const save = screen.getByText('Save').closest('button')!;
    expect(save.hasAttribute('disabled')).toBe(true);
  });

  it('Save sends the names through the atomic save (names + charge together)', async () => {
    renderCard();
    fireEvent.click(screen.getByText(/Add pet name/i));

    const input = screen.getByLabelText('Pet name 1');
    fireEvent.change(input, { target: { value: '  coco  ' } });

    const save = screen.getByText('Save').closest('button')!;
    expect(save.hasAttribute('disabled')).toBe(false);
    await fireEvent.click(save);

    expect(onSaveEngraving).toHaveBeenCalledWith('item1', ['coco']);
    // Still no separate toggle — the charge travels with the names
    expect(onToggleCustomisation).not.toHaveBeenCalled();
  });

  it('Cancel closes the editor and sends nothing', async () => {
    renderCard();
    fireEvent.click(screen.getByText(/Add pet name/i));
    const input = screen.getByLabelText('Pet name 1');
    fireEvent.change(input, { target: { value: 'coco' } });

    await fireEvent.click(screen.getByText('Cancel'));

    expect(screen.queryByLabelText('Pet name 1')).toBeNull();
    expect(onSaveEngraving).not.toHaveBeenCalled();
    expect(onToggleCustomisation).not.toHaveBeenCalled();
  });

  it('shows the saved engraving as its own priced line', () => {
    renderCard({
      customisation: true,
      customisationTexts: ['jumbo'],
      customizationTotal: 19.0,
    });

    // Names render
    expect(screen.getByText('"jumbo"')).toBeTruthy();
    // Engraving priced as its own visible line
    expect(screen.getByText('+$19.00')).toBeTruthy();
    // Combined line total on the right
    expect(screen.getByText('$58.99')).toBeTruthy();
  });

  it('"Remove engraving" toggles the charge off server-side', async () => {
    renderCard({
      customisation: true,
      customisationTexts: ['jumbo'],
      customizationTotal: 19.0,
    });

    // Remove lives in the editor footer — open the editor via Edit first
    await fireEvent.click(screen.getByLabelText(/Edit Pet name for PawTag Plus/i));
    await fireEvent.click(screen.getByText('Remove engraving'));

    expect(onToggleCustomisation).toHaveBeenCalledWith('item1', false);
    expect(onSaveEngraving).not.toHaveBeenCalled();
  });

  it('legacy charge-with-no-name state shows the Add affordance (was invisible)', () => {
    renderCard({
      customisation: true,
      customisationTexts: [],
      customizationTotal: 19.0,
    });

    expect(screen.getByText(/Add pet name/i)).toBeTruthy();
  });
});

describe('CartDrawer engraving line', () => {
  const drawerProps = {
    open: true,
    onClose: () => {},
    total: 58.99,
    onUpdateQuantity: () => {},
    onRemoveItem: () => {},
    onClearCart: () => {},
  };

  it('shows the engraving as a priced line and the full line total', () => {
    render(
      <CartDrawer
        {...drawerProps}
        items={[
          {
            _id: 'item1',
            productId: 'prod1',
            name: 'PawTag Plus',
            price: 39.99,
            quantity: 1,
            customisation: true,
            customisationTexts: ['jumbo'],
            customizationTotal: 19.0,
          },
        ]}
      />,
    );

    expect(screen.getByText('Pet name: jumbo')).toBeTruthy();
    expect(screen.getByText('Engraving +$19.00')).toBeTruthy();
    // Line total = base 39.99 + engraving 19.00 — matches the subtotal now
    // (appears on the line AND in the footer subtotal — that agreement is the point)
    expect(screen.getAllByText('$58.99').length).toBeGreaterThanOrEqual(2);
  });

  it('items without engraving show base price only', () => {
    render(
      <CartDrawer
        {...drawerProps}
        total={9.99}
        items={[
          {
            _id: 'item1',
            productId: 'prod1',
            name: 'PawTag Scan',
            price: 9.99,
            quantity: 1,
            customizationTotal: 0,
          },
        ]}
      />,
    );

    expect(screen.queryByText(/Engraving/)).toBeNull();
    // Base line price — agrees with the footer subtotal
    expect(screen.getAllByText('$9.99').length).toBeGreaterThanOrEqual(2);
  });

  it('multi-quantity engraving multiplies the surcharge', () => {
    render(
      <CartDrawer
        {...drawerProps}
        total={117.98}
        items={[
          {
            _id: 'item1',
            productId: 'prod1',
            name: 'PawTag Plus',
            price: 39.99,
            quantity: 2,
            customisation: true,
            customisationTexts: ['jumbo', 'coco'],
            customizationTotal: 19.0,
          },
        ]}
      />,
    );

    expect(screen.getByText('Engraving +$38.00')).toBeTruthy();
    // (79.98 base + 38.00 engraving) — line agrees with subtotal
    expect(screen.getAllByText('$117.98').length).toBeGreaterThanOrEqual(2);
  });
});
