// react-native-get-random-values polyfills crypto.getRandomValues, which
// nanoid's default (cryptographically secure) generator needs and which
// React Native's Hermes engine doesn't provide natively. Must be imported
// before nanoid.
import 'react-native-get-random-values';
import { customAlphabet } from 'nanoid';

// Excludes 0/O, 1/I/L — characters that are easy to mistype or misread when
// a code is read aloud or copied from a screenshot rather than tapped from
// a link.
const CODE_CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

const generate = customAlphabet(CODE_CHARSET, CODE_LENGTH);

export function generateInviteCode(): string {
  return generate();
}

export function isValidInviteCodeFormat(code: string): boolean {
  const normalized = code.trim().toUpperCase();
  if (normalized.length !== CODE_LENGTH) return false;
  return new RegExp(`^[${CODE_CHARSET}]+$`).test(normalized);
}
