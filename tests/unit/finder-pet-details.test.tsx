// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import PetDetailsCard from '../../apps/finder/src/components/PetDetailsCard';
import type { FinderData } from '../../apps/finder/src/types';

/**
 * Packet 2 (board 2, finder): identity header with trait chips.
 * Finder rules: privacy-approved pet data only — the owner box must appear
 * only when owner data is actually present in the safe DTO.
 */

function makeData(overrides: Partial<NonNullable<FinderData['pet']>> = {}, owner: { ownerName?: string; ownerLocation?: string } = {}): FinderData {
  return {
    tagId: 'PT123',
    tagStatus: 'active',
    pet: {
      name: 'Bella',
      breed: 'Golden Retriever',
      color: 'Golden',
      pattern: '',
      gender: 'female',
      age: 3,
      status: 'lost',
      photos: [],
      medicalAlerts: '',
      favouriteFood: 'Chicken',
      ...overrides,
    },
    ...owner,
  } as FinderData;
}

describe('Finder PetDetailsCard', () => {
  it('renders name, reassurance pill and trait chips from real pet data', () => {
    render(<PetDetailsCard data={makeData()} />);
    expect(screen.getByRole('heading', { name: 'Bella' })).toBeTruthy();
    expect(screen.getByText('Helping me get home')).toBeTruthy();
    expect(screen.getByText('Golden Retriever')).toBeTruthy();
    expect(screen.getByText('Female')).toBeTruthy();
    expect(screen.getByText('3 years')).toBeTruthy();
    expect(screen.getByText('Golden')).toBeTruthy();
    expect(screen.getByText(/Favourite Food/)).toBeTruthy();
    // old stacked rows are gone — no duplicate breed/gender blocks
    expect(screen.getAllByText('Golden Retriever')).toHaveLength(1);
  });

  it('omits optional chips when the owner left fields blank', () => {
    render(<PetDetailsCard data={makeData({ breed: '', color: '', gender: 'unknown', age: undefined })} />);
    expect(screen.getByRole('heading', { name: 'Bella' })).toBeTruthy();
    expect(screen.queryByText('Female')).toBeNull();
    expect(screen.queryByText(/years/)).toBeNull();
  });

  it('never renders owner details when the safe DTO carries none', () => {
    render(<PetDetailsCard data={makeData({}, {})} />);
    expect(screen.queryByText(/Owner/)).toBeNull();
  });

  it('renders owner details only when present', () => {
    render(<PetDetailsCard data={makeData({}, { ownerName: 'Sarah', ownerLocation: 'Ponsonby' })} />);
    expect(screen.getByText('Sarah, Ponsonby')).toBeTruthy();
  });
});
