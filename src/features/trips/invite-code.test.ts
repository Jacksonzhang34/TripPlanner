import { generateInviteCode, isValidInviteCodeFormat } from './invite-code';

describe('generateInviteCode', () => {
  it('generates an 8-character code', () => {
    expect(generateInviteCode()).toHaveLength(8);
  });

  it('only uses unambiguous uppercase letters and digits', () => {
    const code = generateInviteCode();
    expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/);
  });

  it('excludes visually ambiguous characters', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateInviteCode();
      expect(code).not.toMatch(/[0O1IL]/);
    }
  });

  it('generates different codes across calls', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateInviteCode()));
    expect(codes.size).toBe(20);
  });
});

describe('isValidInviteCodeFormat', () => {
  it('accepts a well-formed code', () => {
    expect(isValidInviteCodeFormat('ABCD2345')).toBe(true);
  });

  it('accepts lowercase input (case-insensitive)', () => {
    expect(isValidInviteCodeFormat('abcd2345')).toBe(true);
  });

  it('rejects the wrong length', () => {
    expect(isValidInviteCodeFormat('ABCD234')).toBe(false);
    expect(isValidInviteCodeFormat('ABCD23456')).toBe(false);
  });

  it('rejects ambiguous characters', () => {
    expect(isValidInviteCodeFormat('ABCD01IL')).toBe(false);
  });

  it('rejects empty or whitespace-only input', () => {
    expect(isValidInviteCodeFormat('')).toBe(false);
    expect(isValidInviteCodeFormat('   ')).toBe(false);
  });
});
