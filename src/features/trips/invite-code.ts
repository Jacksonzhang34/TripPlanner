// Excludes 0/O, 1/I/L — characters that are easy to mistype or misread when
// a code is read aloud or copied from a screenshot rather than tapped from
// a link. Must match the charset the create-invite Edge Function actually
// generates codes with (supabase/functions/create-invite/index.ts).
const CODE_CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

export function isValidInviteCodeFormat(code: string): boolean {
  const normalized = code.trim().toUpperCase();
  if (normalized.length !== CODE_LENGTH) return false;
  return new RegExp(`^[${CODE_CHARSET}]+$`).test(normalized);
}
