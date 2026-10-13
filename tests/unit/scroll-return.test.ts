import { describe, it, expect } from 'vitest';
import {
  stashScrollBeforeLogin,
  takeScrollReturn,
  SCROLL_RETURN_KEY,
} from '../../apps/web/src/lib/scroll-return';

/** Minimal in-memory Storage stand-in. */
function fakeStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
  };
}

describe('scroll-return (login round-trip scroll restore)', () => {
  it('restores the stashed position for the matching path and consumes the entry', () => {
    const storage = fakeStorage();
    stashScrollBeforeLogin('/account/orders', 1200, storage);

    expect(takeScrollReturn('/account/orders', storage)).toBe(1200);
    // Consumed — a second call must not restore again
    expect(takeScrollReturn('/account/orders', storage)).toBeNull();
  });

  it('does not restore a stash for a different path, and clears it (no stale offset)', () => {
    const storage = fakeStorage();
    stashScrollBeforeLogin('/account/orders', 900, storage);

    // User logged in with no return URL → landed on /account instead
    expect(takeScrollReturn('/account', storage)).toBeNull();
    // Stale stash is gone — later visits to /account/orders start at top
    expect(takeScrollReturn('/account/orders', storage)).toBeNull();
  });

  it('ignores y = 0 (top position needs no restore)', () => {
    const storage = fakeStorage();
    stashScrollBeforeLogin('/account/orders', 0, storage);

    expect(takeScrollReturn('/account/orders', storage)).toBeNull();
  });

  it('ignores invalid input', () => {
    const storage = fakeStorage();
    stashScrollBeforeLogin('', 500, storage);
    stashScrollBeforeLogin('/x', Number.NaN, storage);
    stashScrollBeforeLogin('/x', -10, storage);

    expect(storage.getItem(SCROLL_RETURN_KEY)).toBeNull();
  });

  it('tolerates corrupted storage content', () => {
    const storage = fakeStorage();
    storage.setItem(SCROLL_RETURN_KEY, 'not-json{{');

    expect(takeScrollReturn('/x', storage)).toBeNull();
    // Entry consumed despite corruption
    expect(storage.getItem(SCROLL_RETURN_KEY)).toBeNull();
  });

  it('tolerates a failing storage (private mode) without throwing', () => {
    const throwing = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };

    expect(() => stashScrollBeforeLogin('/x', 100, throwing)).not.toThrow();
    expect(takeScrollReturn('/x', throwing)).toBeNull();
  });

  it('rounds fractional offsets', () => {
    const storage = fakeStorage();
    stashScrollBeforeLogin('/x', 333.7, storage);

    expect(takeScrollReturn('/x', storage)).toBe(334);
  });
});
