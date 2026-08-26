import { isValidInviteCodeFormat } from './invite-code';

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
