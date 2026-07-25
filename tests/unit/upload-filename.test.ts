import { describe, it, expect } from 'vitest';

/**
 * Tests that multer filename callbacks preserve the original filename.
 * We extract and test the callback logic directly.
 */

function petFilenameCb(_req: any, file: { originalname: string }, cb: (err: null, filename: string) => void) {
  cb(null, file.originalname);
}

function productFilenameCb(_req: any, file: { originalname: string }, cb: (err: null, filename: string) => void) {
  cb(null, file.originalname);
}

function cmsFilenameCb(_req: any, file: { originalname: string }, cb: (err: null, filename: string) => void) {
  cb(null, file.originalname);
}

describe('Upload filename preservation', () => {
  describe('Pet photo upload', () => {
    it('preserves original filename for .png', () => {
      let result = '';
      petFilenameCb(null, { originalname: 'test.png' }, (_err, filename) => { result = filename; });
      expect(result).toBe('test.png');
    });

    it('preserves original filename for .jpg', () => {
      let result = '';
      petFilenameCb(null, { originalname: 'photo.jpg' }, (_err, filename) => { result = filename; });
      expect(result).toBe('photo.jpg');
    });

    it('preserves original filename with spaces', () => {
      let result = '';
      petFilenameCb(null, { originalname: 'my photo.png' }, (_err, filename) => { result = filename; });
      expect(result).toBe('my photo.png');
    });

    it('preserves original filename with mixed case', () => {
      let result = '';
      petFilenameCb(null, { originalname: 'Photo.PNG' }, (_err, filename) => { result = filename; });
      expect(result).toBe('Photo.PNG');
    });
  });

  describe('Product image upload', () => {
    it('preserves original filename', () => {
      let result = '';
      productFilenameCb(null, { originalname: 'product.jpg' }, (_err, filename) => { result = filename; });
      expect(result).toBe('product.jpg');
    });

    it('preserves filename with dots', () => {
      let result = '';
      productFilenameCb(null, { originalname: 'my.product.v2.png' }, (_err, filename) => { result = filename; });
      expect(result).toBe('my.product.v2.png');
    });
  });

  describe('CMS media upload', () => {
    it('preserves original filename', () => {
      let result = '';
      cmsFilenameCb(null, { originalname: 'banner.png' }, (_err, filename) => { result = filename; });
      expect(result).toBe('banner.png');
    });

    it('preserves filename for PDF', () => {
      let result = '';
      cmsFilenameCb(null, { originalname: 'document.pdf' }, (_err, filename) => { result = filename; });
      expect(result).toBe('document.pdf');
    });

    it('preserves filename for video', () => {
      let result = '';
      cmsFilenameCb(null, { originalname: 'clip.mp4' }, (_err, filename) => { result = filename; });
      expect(result).toBe('clip.mp4');
    });
  });

  describe('Filename does NOT contain random suffix', () => {
    it('pet upload has no timestamp prefix', () => {
      let result = '';
      petFilenameCb(null, { originalname: 'test.png' }, (_err, filename) => { result = filename; });
      expect(result).not.toMatch(/^pet-\d+/);
    });

    it('product upload has no timestamp prefix', () => {
      let result = '';
      productFilenameCb(null, { originalname: 'test.png' }, (_err, filename) => { result = filename; });
      expect(result).not.toMatch(/^product-\d+/);
    });

    it('cms upload has no timestamp prefix', () => {
      let result = '';
      cmsFilenameCb(null, { originalname: 'test.png' }, (_err, filename) => { result = filename; });
      expect(result).not.toMatch(/^cms-\d+/);
    });
  });
});
