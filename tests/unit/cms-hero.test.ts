import { describe, it, expect } from 'vitest';
import {
  CMS_HERO_POSITIONS,
  CMS_HERO_ZOOM_DEFAULT,
  CMS_HERO_ZOOM_MAX,
  CMS_HERO_ZOOM_MIN,
  cmsHeroBackgroundPosition,
  cmsHeroBackgroundSize,
  isCmsHeroPosition,
  normalizeCmsHeroZoom,
} from '@pawtag/shared';

describe('cmsHeroBackgroundPosition (shared)', () => {
  it('maps all 9 positions to valid CSS background-position values', () => {
    const expected: Record<string, string> = {
      center: 'center',
      top: 'top center',
      bottom: 'bottom center',
      left: 'center left',
      right: 'center right',
      'left-top': 'left top',
      'right-top': 'right top',
      'left-bottom': 'left bottom',
      'right-bottom': 'right bottom',
    };
    expect(CMS_HERO_POSITIONS).toHaveLength(9);
    for (const position of CMS_HERO_POSITIONS) {
      expect(cmsHeroBackgroundPosition(position)).toBe(expected[position]);
    }
  });

  it('falls back to center for missing or invalid values (legacy saved sections)', () => {
    expect(cmsHeroBackgroundPosition(undefined)).toBe('center');
    expect(cmsHeroBackgroundPosition(null)).toBe('center');
    expect(cmsHeroBackgroundPosition('middle-left')).toBe('center');
    expect(cmsHeroBackgroundPosition(42)).toBe('center');
  });

  it('isCmsHeroPosition narrows only the 9 known values', () => {
    expect(isCmsHeroPosition('top')).toBe(true);
    expect(isCmsHeroPosition('TOP')).toBe(false);
    expect(isCmsHeroPosition(undefined)).toBe(false);
  });
});

describe('normalizeCmsHeroZoom (shared)', () => {
  it('keeps in-range values', () => {
    expect(normalizeCmsHeroZoom(100)).toBe(100);
    expect(normalizeCmsHeroZoom(CMS_HERO_ZOOM_MIN)).toBe(50);
    expect(normalizeCmsHeroZoom(CMS_HERO_ZOOM_MAX)).toBe(200);
  });

  it('clamps out-of-range values', () => {
    expect(normalizeCmsHeroZoom(10)).toBe(50);
    expect(normalizeCmsHeroZoom(9999)).toBe(200);
  });

  it('rounds fractional values and accepts numeric strings from JSON editing', () => {
    expect(normalizeCmsHeroZoom(133.6)).toBe(134);
    expect(normalizeCmsHeroZoom('150')).toBe(150);
  });

  it('falls back to the default for missing or non-numeric values', () => {
    expect(normalizeCmsHeroZoom(undefined)).toBe(CMS_HERO_ZOOM_DEFAULT);
    expect(normalizeCmsHeroZoom(null)).toBe(CMS_HERO_ZOOM_DEFAULT);
    expect(normalizeCmsHeroZoom('')).toBe(CMS_HERO_ZOOM_DEFAULT);
    expect(normalizeCmsHeroZoom('abc')).toBe(CMS_HERO_ZOOM_DEFAULT);
    expect(normalizeCmsHeroZoom(Number.NaN)).toBe(CMS_HERO_ZOOM_DEFAULT);
  });
});

describe('cmsHeroBackgroundSize (shared)', () => {
  it('uses cover at the default zoom so pre-zoom pages render unchanged', () => {
    expect(cmsHeroBackgroundSize(100)).toBe('cover');
    expect(cmsHeroBackgroundSize(undefined)).toBe('cover');
    expect(cmsHeroBackgroundSize(null)).toBe('cover');
  });

  it('scales with zoom in both directions', () => {
    expect(cmsHeroBackgroundSize(150)).toBe('150% auto');
    expect(cmsHeroBackgroundSize(50)).toBe('50% auto');
    expect(cmsHeroBackgroundSize(200)).toBe('200% auto');
  });
});
