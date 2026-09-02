import { describe, it, expect } from 'vitest';
import { isValidTransition, getValidTransitions, getTransitionMap } from '../../packages/api/src/services/orderStatus.service';
import type { OrderStatus } from '@pawtag/db';

describe('Order Status State Machine', () => {
  describe('isValidTransition', () => {
    describe('valid transitions', () => {
      it('pending -> pending_payment', () => {
        expect(isValidTransition('pending', 'pending_payment')).toBe(true);
      });

      it('pending -> paid', () => {
        expect(isValidTransition('pending', 'paid')).toBe(true);
      });

      it('pending -> cancelled', () => {
        expect(isValidTransition('pending', 'cancelled')).toBe(true);
      });

      it('pending_payment -> paid', () => {
        expect(isValidTransition('pending_payment', 'paid')).toBe(true);
      });

      it('pending_payment -> cancelled', () => {
        expect(isValidTransition('pending_payment', 'cancelled')).toBe(true);
      });

      it('paid -> packing', () => {
        expect(isValidTransition('paid', 'packing')).toBe(true);
      });

      it('paid -> cancelled', () => {
        expect(isValidTransition('paid', 'cancelled')).toBe(true);
      });

      it('paid -> refunded', () => {
        expect(isValidTransition('paid', 'refunded')).toBe(true);
      });

      it('packing -> shipped', () => {
        expect(isValidTransition('packing', 'shipped')).toBe(true);
      });

      it('packing -> cancelled', () => {
        expect(isValidTransition('packing', 'cancelled')).toBe(true);
      });

      it('shipped -> delivered', () => {
        expect(isValidTransition('shipped', 'delivered')).toBe(true);
      });

      it('delivered -> refunded', () => {
        expect(isValidTransition('delivered', 'refunded')).toBe(true);
      });
    });

    describe('invalid transitions', () => {
      it('pending -> packing (skip steps)', () => {
        expect(isValidTransition('pending', 'packing')).toBe(false);
      });

      it('pending -> shipped (skip steps)', () => {
        expect(isValidTransition('pending', 'shipped')).toBe(false);
      });

      it('pending -> delivered (skip steps)', () => {
        expect(isValidTransition('pending', 'delivered')).toBe(false);
      });

      it('pending -> refunded (skip steps)', () => {
        expect(isValidTransition('pending', 'refunded')).toBe(false);
      });

      it('pending_payment -> packing (skip steps)', () => {
        expect(isValidTransition('pending_payment', 'packing')).toBe(false);
      });

      it('pending_payment -> shipped (skip steps)', () => {
        expect(isValidTransition('pending_payment', 'shipped')).toBe(false);
      });

      it('pending_payment -> delivered (skip steps)', () => {
        expect(isValidTransition('pending_payment', 'delivered')).toBe(false);
      });

      it('pending_payment -> refunded (skip steps)', () => {
        expect(isValidTransition('pending_payment', 'refunded')).toBe(false);
      });

      it('paid -> pending (backward)', () => {
        expect(isValidTransition('paid', 'pending')).toBe(false);
      });

      it('paid -> pending_payment (backward)', () => {
        expect(isValidTransition('paid', 'pending_payment')).toBe(false);
      });

      it('paid -> shipped (skip packing)', () => {
        expect(isValidTransition('paid', 'shipped')).toBe(false);
      });

      it('paid -> delivered (skip steps)', () => {
        expect(isValidTransition('paid', 'delivered')).toBe(false);
      });

      it('packing -> pending (backward)', () => {
        expect(isValidTransition('packing', 'pending')).toBe(false);
      });

      it('packing -> paid (backward)', () => {
        expect(isValidTransition('packing', 'paid')).toBe(false);
      });

      it('packing -> delivered (skip shipped)', () => {
        expect(isValidTransition('packing', 'delivered')).toBe(false);
      });

      it('shipped -> pending (backward)', () => {
        expect(isValidTransition('shipped', 'pending')).toBe(false);
      });

      it('shipped -> packing (backward)', () => {
        expect(isValidTransition('shipped', 'packing')).toBe(false);
      });

      it('shipped -> cancelled (too late)', () => {
        expect(isValidTransition('shipped', 'cancelled')).toBe(false);
      });

      it('delivered -> pending (backward)', () => {
        expect(isValidTransition('delivered', 'pending')).toBe(false);
      });

      it('delivered -> packing (backward)', () => {
        expect(isValidTransition('delivered', 'packing')).toBe(false);
      });

      it('delivered -> shipped (backward)', () => {
        expect(isValidTransition('delivered', 'shipped')).toBe(false);
      });

      it('delivered -> cancelled (too late)', () => {
        expect(isValidTransition('delivered', 'cancelled')).toBe(false);
      });

      it('cancelled -> refunded (valid)', () => {
        expect(isValidTransition('cancelled', 'refunded')).toBe(true);
      });

      it('cancelled -> anything else (invalid)', () => {
        const statuses: OrderStatus[] = ['pending', 'pending_payment', 'paid', 'packing', 'shipped', 'delivered', 'cancelled'];
        for (const status of statuses) {
          expect(isValidTransition('cancelled', status)).toBe(false);
        }
      });

      it('refunded -> anything (terminal)', () => {
        const statuses: OrderStatus[] = ['pending', 'pending_payment', 'paid', 'packing', 'shipped', 'delivered', 'cancelled'];
        for (const status of statuses) {
          expect(isValidTransition('refunded', status)).toBe(false);
        }
      });
    });

    describe('same status', () => {
      it('pending -> pending is invalid', () => {
        expect(isValidTransition('pending', 'pending')).toBe(false);
      });

      it('paid -> paid is invalid', () => {
        expect(isValidTransition('paid', 'paid')).toBe(false);
      });

      it('cancelled -> cancelled is invalid', () => {
        expect(isValidTransition('cancelled', 'cancelled')).toBe(false);
      });
    });
  });

  describe('getValidTransitions', () => {
    it('returns correct transitions for pending', () => {
      expect(getValidTransitions('pending')).toEqual(['pending_payment', 'paid', 'cancelled']);
    });

    it('returns correct transitions for pending_payment', () => {
      expect(getValidTransitions('pending_payment')).toEqual(['paid', 'cancelled']);
    });

    it('returns correct transitions for paid', () => {
      expect(getValidTransitions('paid')).toEqual(['packing', 'cancelled', 'refunded']);
    });

    it('returns correct transitions for packing', () => {
      expect(getValidTransitions('packing')).toEqual(['shipped', 'cancelled']);
    });

    it('returns correct transitions for shipped', () => {
      expect(getValidTransitions('shipped')).toEqual(['delivered']);
    });

    it('returns correct transitions for delivered', () => {
      expect(getValidTransitions('delivered')).toEqual(['refunded']);
    });

    it('returns refunded for cancelled', () => {
      expect(getValidTransitions('cancelled')).toEqual(['refunded']);
    });

    it('returns empty for refunded', () => {
      expect(getValidTransitions('refunded')).toEqual([]);
    });
  });

  describe('getTransitionMap', () => {
    it('returns a copy of the transition map', () => {
      const map = getTransitionMap();
      expect(map).toHaveProperty('pending');
      expect(map).toHaveProperty('paid');
      expect(map).toHaveProperty('cancelled');

      // Mutating the copy should not affect the original
      map.pending = ['invalid' as any];
      expect(isValidTransition('pending', 'paid')).toBe(true);
    });
  });
});
