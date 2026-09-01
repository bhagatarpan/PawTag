import { describe, it, expect } from 'vitest';
import { encryptToken, decryptToken } from '../../packages/api/src/services/integration-connection.service';

describe('integration-connection token encryption', () => {
  it('roundtrips a simple token', () => {
    const plain = 'xero-access-token-abc123';
    const encrypted = encryptToken(plain);
    expect(encrypted).not.toBe(plain);
    expect(decryptToken(encrypted)).toBe(plain);
  });

  it('produces different ciphertext for same plaintext (IV randomness)', () => {
    const plain = 'same-token';
    const a = encryptToken(plain);
    const b = encryptToken(plain);
    expect(a).not.toBe(b);
    expect(decryptToken(a)).toBe(plain);
    expect(decryptToken(b)).toBe(plain);
  });

  it('handles long tokens', () => {
    const plain = 'a'.repeat(1000);
    const encrypted = encryptToken(plain);
    expect(decryptToken(encrypted)).toBe(plain);
  });

  it('handles unicode in tokens', () => {
    const plain = 'token-with-unicode-🔐-and-spécial-chars';
    const encrypted = encryptToken(plain);
    expect(decryptToken(encrypted)).toBe(plain);
  });
});
