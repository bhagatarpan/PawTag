import { describe, it, expect } from 'vitest';
import { toFinderPetView } from '../../packages/shared/src/finder-dto';

/**
 * Finder pet DTO — pure mapping rules for the non-premium care attributes
 * (age, favourite food) the founder approved for all pets. The sensitive-
 * field exclusion contract is pinned by tests/integration/
 * finder-dto-privacy.test.ts against the live route.
 */

function yearsAgo(years: number): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d;
}

describe('toFinderPetView — age and favourite food', () => {
  it('passes through a stored age', () => {
    const view = toFinderPetView({ name: 'Rex', age: 3 });
    expect(view.age).toBe(3);
  });

  it('computes whole years from dateOfBirth when no age is stored', () => {
    const view = toFinderPetView({ name: 'Rex', dateOfBirth: yearsAgo(3) });
    expect(view.age).toBe(3);
  });

  it('has not counted the birthday yet when the anniversary is later this year', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setFullYear(tomorrow.getFullYear() - 3); // 3 years ago + 1 day = birthday is tomorrow
    const view = toFinderPetView({ name: 'Rex', dateOfBirth: tomorrow });
    expect(view.age).toBe(2);
  });

  it('returns no age when neither age nor birthday is set', () => {
    const view = toFinderPetView({ name: 'Rex' });
    expect(view.age).toBeUndefined();
  });

  it('ignores an unparseable birthday instead of crashing', () => {
    const view = toFinderPetView({ name: 'Rex', dateOfBirth: 'not-a-date' });
    expect(view.age).toBeUndefined();
  });

  it('prefers the stored age over a computed one', () => {
    const view = toFinderPetView({ name: 'Rex', age: 5, dateOfBirth: yearsAgo(3) });
    expect(view.age).toBe(5);
  });

  it('includes favouriteFood and omits it when empty', () => {
    expect(toFinderPetView({ name: 'Rex', favouriteFood: 'Chicken' }).favouriteFood).toBe('Chicken');
    expect(toFinderPetView({ name: 'Rex', favouriteFood: '' }).favouriteFood).toBeUndefined();
  });

  it('never exposes the raw birthday — only the year count', () => {
    const view = toFinderPetView({ name: 'Rex', dateOfBirth: yearsAgo(4) }) as Record<string, unknown>;
    expect(view.dateOfBirth).toBeUndefined();
  });
});
