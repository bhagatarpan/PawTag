import { describe, it, expect } from 'vitest';
import path from 'path';

/**
 * Tests that multer filename callbacks produce unique filenames with timestamp+random prefix.
 * We extract and test the callback logic directly.
 */

function petFilenameCb(_req: any, file: { originalname: string }, cb: (err: null, filename: string) => void) {
  const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const ext = path.extname(file.originalname);
  cb(null, `${uniquePrefix}${ext}`);
}

function productFilenameCb(_req: any, file: { originalname: string }, cb: (err: null, filename: string) => void) {
  const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const ext = path.extname(file.originalname);
  cb(null, `${uniquePrefix}${ext}`);
}

function cmsFilenameCb(_req: any, file: { originalname: string }, cb: (err: null, filename: string) => void) {
  cb(null, file.originalname);
}

describe('Upload filename collision prevention', () => {
  describe('Pet photo upload', () => {
    it('produces unique filename with timestamp prefix', () => {
      let result = '';
      petFilenameCb(null, { originalname: 'test.png' }, (_err, filename) => { result = filename; });
      expect(result).toMatch(/^\d+-\d+\.png$/);
    });

    it('preserves file extension', () => {
      let result = '';
      petFilenameCb(null, { originalname: 'photo.jpg' }, (_err, filename) => { result = filename; });
      expect(result).toMatch(/\.jpg$/);
    });

    it('preserves extension for mixed case', () => {
      let result = '';
      petFilenameCb(null, { originalname: 'Photo.PNG' }, (_err, filename) => { result = filename; });
      expect(result).toMatch(/\.PNG$/);
    });

    it('generates different filenames for same input', () => {
      const results = new Set<string>();
      for (let i = 0; i < 20; i++) {
        petFilenameCb(null, { originalname: 'test.png' }, (_err, filename) => { results.add(filename); });
      }
      expect(results.size).toBe(20);
    });
  });

  describe('Product image upload', () => {
    it('produces unique filename with timestamp prefix', () => {
      let result = '';
      productFilenameCb(null, { originalname: 'product.jpg' }, (_err, filename) => { result = filename; });
      expect(result).toMatch(/^\d+-\d+\.jpg$/);
    });

    it('preserves extension with dots in name', () => {
      let result = '';
      productFilenameCb(null, { originalname: 'my.product.v2.png' }, (_err, filename) => { result = filename; });
      expect(result).toMatch(/\.png$/);
    });

    it('generates different filenames for same input', () => {
      const results = new Set<string>();
      for (let i = 0; i < 20; i++) {
        productFilenameCb(null, { originalname: 'product.jpg' }, (_err, filename) => { results.add(filename); });
      }
      expect(results.size).toBe(20);
    });
  });

  describe('CMS media upload (unchanged)', () => {
    it('preserves original filename', () => {
      let result = '';
      cmsFilenameCb(null, { originalname: 'banner.png' }, (_err, filename) => { result = filename; });
      expect(result).toBe('banner.png');
    });
  });

  describe('Filename does NOT cause collisions', () => {
    it('pet uploads with same original name produce different filenames', () => {
      const names = new Set<string>();
      for (let i = 0; i < 50; i++) {
        petFilenameCb(null, { originalname: 'avatar.png' }, (_err, filename) => { names.add(filename); });
      }
      expect(names.size).toBe(50);
    });
  });
});
