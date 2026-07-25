import { describe, it, expect } from 'vitest';
import { validatePassword, PASSWORD_REGEX, PASSWORD_MIN_LENGTH } from '../../packages/shared/src/constants';

describe('validatePassword', () => {
  it('passes with valid password containing all required character types', () => {
    const result = validatePassword('MyPass123!');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('fails with password shorter than minimum length', () => {
    const result = validatePassword('Ab1!');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('at least');
  });

  it('fails with password missing uppercase letter', () => {
    const result = validatePassword('lowercase1!');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('uppercase');
  });

  it('fails with password missing lowercase letter', () => {
    const result = validatePassword('UPPERCASE1!');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('lowercase');
  });

  it('fails with password missing digit', () => {
    const result = validatePassword('NoDigitHere!');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('number');
  });

  it('fails with password missing special character', () => {
    const result = validatePassword('NoSpecial123');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('special character');
  });

  it('passes with various special characters', () => {
    const specials = ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '_', '+', '-', '=', '[', ']', '{', '}', ';', "'", ':', '"', '\\', '|', ',', '.', '<', '>', '?', '/'];
    for (const char of specials) {
      const result = validatePassword(`TestPass1${char}`);
      expect(result.valid).toBe(true);
    }
  });

  it('passes with exactly minimum length', () => {
    const result = validatePassword('Abcdef1!');
    expect(result.valid).toBe(true);
  });

  it('passes with long password', () => {
    const result = validatePassword('A'.repeat(100) + 'b1!');
    expect(result.valid).toBe(true);
  });
});

describe('PASSWORD_REGEX', () => {
  it('matches passwords with all required character types', () => {
    expect(PASSWORD_REGEX.test('MyPass123!')).toBe(true);
    expect(PASSWORD_REGEX.test('Str0ng@Pass')).toBe(true);
    expect(PASSWORD_REGEX.test('Test#1234')).toBe(true);
  });

  it('rejects passwords missing required character types', () => {
    expect(PASSWORD_REGEX.test('lowercase1!')).toBe(false);
    expect(PASSWORD_REGEX.test('UPPERCASE1!')).toBe(false);
    expect(PASSWORD_REGEX.test('NoDigitHere!')).toBe(false);
    expect(PASSWORD_REGEX.test('NoSpecial123')).toBe(false);
  });
});

describe('PASSWORD_MIN_LENGTH', () => {
  it('is set to 8', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
  });
});
