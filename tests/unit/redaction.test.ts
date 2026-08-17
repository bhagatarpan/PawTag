import { describe, it, expect } from 'vitest';
import {
  isSensitiveField,
  redactValue,
  deepRedact,
  safeSerialize,
  sanitizeRequestBody,
  sanitizeHeaders,
  sanitizeEnvVars,
  partialMask,
} from '../../packages/api/src/lib/redaction';

describe('Redaction Module', () => {
  describe('isSensitiveField', () => {
    it('identifies password fields', () => {
      expect(isSensitiveField('password')).toBe(true);
      expect(isSensitiveField('passwordHash')).toBe(true);
      expect(isSensitiveField('hashedPassword')).toBe(true);
      expect(isSensitiveField('passwd')).toBe(true);
    });

    it('identifies token fields', () => {
      expect(isSensitiveField('token')).toBe(true);
      expect(isSensitiveField('accessToken')).toBe(true);
      expect(isSensitiveField('refreshToken')).toBe(true);
      expect(isSensitiveField('sessionToken')).toBe(true);
    });

    it('identifies secret fields', () => {
      expect(isSensitiveField('secret')).toBe(true);
      expect(isSensitiveField('jwtSecret')).toBe(true);
      expect(isSensitiveField('secretKey')).toBe(true);
      expect(isSensitiveField('privateKey')).toBe(true);
    });

    it('identifies API key fields', () => {
      expect(isSensitiveField('apiKey')).toBe(true);
      expect(isSensitiveField('api_key')).toBe(true);
      expect(isSensitiveField('apiSecret')).toBe(true);
    });

    it('identifies HTTP auth headers', () => {
      expect(isSensitiveField('authorization')).toBe(true);
      expect(isSensitiveField('cookie')).toBe(true);
    });

    it('identifies OTP/MFA fields', () => {
      expect(isSensitiveField('otp')).toBe(true);
      expect(isSensitiveField('otpCode')).toBe(true);
      expect(isSensitiveField('mfaSecret')).toBe(true);
      expect(isSensitiveField('mfaCode')).toBe(true);
    });

    it('identifies payment fields', () => {
      expect(isSensitiveField('creditCard')).toBe(true);
      expect(isSensitiveField('cardNumber')).toBe(true);
      expect(isSensitiveField('cvv')).toBe(true);
      expect(isSensitiveField('cvc')).toBe(true);
      expect(isSensitiveField('ssn')).toBe(true);
    });

    it('identifies PawTag-specific sensitive fields', () => {
      expect(isSensitiveField('finderPhone')).toBe(true);
      expect(isSensitiveField('finderEmail')).toBe(true);
      expect(isSensitiveField('emergencyContact')).toBe(true);
      expect(isSensitiveField('emergencyPhone')).toBe(true);
    });

    it('does not flag safe fields', () => {
      expect(isSensitiveField('name')).toBe(false);
      expect(isSensitiveField('email')).toBe(false);
      expect(isSensitiveField('phoneNumber')).toBe(false);
      expect(isSensitiveField('address')).toBe(false);
      expect(isSensitiveField('petName')).toBe(false);
      expect(isSensitiveField('tagId')).toBe(false);
    });
  });

  describe('redactValue', () => {
    it('redacts sensitive field values', () => {
      expect(redactValue('mysecret', 'password')).toBe('[REDACTED]');
      expect(redactValue('jwt-token-123', 'accessToken')).toBe('[REDACTED]');
      expect(redactValue('sk_test_123', 'apiKey')).toBe('[REDACTED]');
    });

    it('preserves safe field values', () => {
      expect(redactValue('John Doe', 'name')).toBe('John Doe');
      expect(redactValue('john@example.com', 'email')).toBe('john@example.com');
      expect(redactValue(123, 'count')).toBe(123);
    });

    it('handles null and undefined', () => {
      expect(redactValue(null, 'password')).toBe(null);
      expect(redactValue(undefined, 'password')).toBe(undefined);
    });
  });

  describe('deepRedact', () => {
    it('redacts sensitive fields at top level', () => {
      const input = {
        name: 'John',
        password: 'secret123',
        email: 'john@example.com',
      };
      const result = deepRedact(input) as Record<string, unknown>;
      expect(result.name).toBe('John');
      expect(result.password).toBe('[REDACTED]');
      expect(result.email).toBe('john@example.com');
    });

    it('redacts sensitive fields in nested objects', () => {
      const input = {
        user: {
          name: 'John',
          credentials: {
            password: 'secret',
            token: 'jwt-token',
          },
        },
      };
      const result = deepRedact(input) as any;
      expect(result.user.name).toBe('John');
      expect(result.user.credentials.password).toBe('[REDACTED]');
      expect(result.user.credentials.token).toBe('[REDACTED]');
    });

    it('redacts sensitive fields in arrays', () => {
      const input = {
        users: [
          { name: 'John', password: 'secret1' },
          { name: 'Jane', password: 'secret2' },
        ],
      };
      const result = deepRedact(input) as any;
      expect(result.users[0].name).toBe('John');
      expect(result.users[0].password).toBe('[REDACTED]');
      expect(result.users[1].name).toBe('Jane');
      expect(result.users[1].password).toBe('[REDACTED]');
    });

    it('handles null and undefined values', () => {
      expect(deepRedact(null)).toBe(null);
      expect(deepRedact(undefined)).toBe(undefined);
    });

    it('handles primitive values', () => {
      expect(deepRedact('string')).toBe('string');
      expect(deepRedact(123)).toBe(123);
      expect(deepRedact(true)).toBe(true);
    });

    it('handles Date objects', () => {
      const date = new Date();
      expect(deepRedact(date)).toBe(date);
    });

    it('handles circular references', () => {
      const obj: any = { name: 'test' };
      obj.self = obj;
      const result = deepRedact(obj) as any;
      expect(result.name).toBe('test');
      expect(result.self).toBe('[CIRCULAR]');
    });

    it('preserves safe nested structures', () => {
      const input = {
        pet: {
          name: 'Buddy',
          breed: 'Golden Retriever',
          medical: {
            vaccinations: ['rabies', 'distemper'],
            allergies: ['peanuts'],
          },
        },
      };
      const result = deepRedact(input) as any;
      expect(result.pet.name).toBe('Buddy');
      expect(result.pet.breed).toBe('Golden Retriever');
      expect(result.pet.medical.vaccinations).toEqual(['rabies', 'distemper']);
      expect(result.pet.medical.allergies).toEqual(['peanuts']);
    });
  });

  describe('sanitizeRequestBody', () => {
    it('redacts sensitive fields in body', () => {
      const body = {
        email: 'john@example.com',
        password: 'secret123',
        name: 'John',
      };
      const result = sanitizeRequestBody(body) as Record<string, unknown>;
      expect(result.email).toBe('john@example.com');
      expect(result.password).toBe('[REDACTED]');
      expect(result.name).toBe('John');
    });

    it('filters to allowed fields when specified', () => {
      const body = {
        email: 'john@example.com',
        password: 'secret123',
        name: 'John',
        extra: 'data',
      };
      const result = sanitizeRequestBody(body, ['email', 'name']) as Record<string, unknown>;
      expect(result.email).toBe('john@example.com');
      expect(result.name).toBe('John');
      expect(result.password).toBeUndefined();
      expect(result.extra).toBeUndefined();
    });

    it('handles null body', () => {
      expect(sanitizeRequestBody(null)).toBe(null);
    });
  });

  describe('sanitizeHeaders', () => {
    it('includes only safe headers', () => {
      const headers = {
        'content-type': 'application/json',
        'authorization': 'Bearer secret-token',
        'cookie': 'session=abc123',
        'user-agent': 'Mozilla/5.0',
        'x-request-id': 'req-123',
        'x-custom-header': 'should-be-excluded',
      };
      const result = sanitizeHeaders(headers);
      expect(result['content-type']).toBe('application/json');
      expect(result['user-agent']).toBe('Mozilla/5.0');
      expect(result['x-request-id']).toBe('req-123');
      expect(result['authorization']).toBeUndefined();
      expect(result['cookie']).toBeUndefined();
      expect(result['x-custom-header']).toBeUndefined();
    });
  });

  describe('sanitizeEnvVars', () => {
    it('includes only safe environment variables', () => {
      const env = {
        NODE_ENV: 'production',
        PORT: '5000',
        DB_URL: 'mongodb://secret',
        JWT_SECRET: 'super-secret',
        API_KEY: 'key-123',
        LOG_LEVEL: 'info',
      };
      const result = sanitizeEnvVars(env);
      expect(result.NODE_ENV).toBe('production');
      expect(result.PORT).toBe('5000');
      expect(result.LOG_LEVEL).toBe('info');
      expect(result.DB_URL).toBeUndefined();
      expect(result.JWT_SECRET).toBeUndefined();
      expect(result.API_KEY).toBeUndefined();
    });
  });

  describe('partialMask', () => {
    it('masks email addresses partially', () => {
      const masked = partialMask('john.doe@example.com', 'email');
      expect(masked).toBe('joh***@example.com');
    });

    it('masks phone numbers partially', () => {
      const masked = partialMask('+1-555-123-4567', 'phoneNumber');
      expect(masked).toBe('***-***-4567');
    });

    it('returns [REDACTED] for unknown field types', () => {
      expect(partialMask('secret-value', 'unknownField')).toBe('[REDACTED]');
    });

    it('handles null and undefined', () => {
      expect(partialMask(null, 'email')).toBe(null);
      expect(partialMask(undefined, 'email')).toBe(undefined);
    });
  });
});
