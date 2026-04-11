/** ISO/IEC 7812 allows up to 19 digits; Amex PANs are 15 digits (34 / 37). */
export const MAX_CARD_DIGITS_STANDARD = 19;
export const MAX_CARD_DIGITS_AMEX = 15;

export function maxCardDigitsForPan(digits: string): number {
  const d = digits.replace(/\D/g, '');
  return /^3[47]/.test(d) ? MAX_CARD_DIGITS_AMEX : MAX_CARD_DIGITS_STANDARD;
}

/** Longest formatted value for max PAN (19 digits, groups of 4): 19 + 4 spaces = 23. */
export const MAX_CARD_NUMBER_FORMATTED_LENGTH = 23;

/** Groups card digits for display/input: 4×4 for most cards, 4-6-5 for Amex (15 digits, starts with 34/37). */
export function formatCardDigitsGrouped(digits: string, maxDigits = MAX_CARD_DIGITS_STANDARD): string {
  const d = digits.replace(/\D/g, '').slice(0, maxDigits);
  if (d.length === 0) return '';
  const isAmex = /^3[47]/.test(d) && d.length <= MAX_CARD_DIGITS_AMEX;
  if (isAmex) {
    if (d.length <= 4) return d;
    if (d.length <= 10) return `${d.slice(0, 4)} ${d.slice(4)}`;
    return `${d.slice(0, 4)} ${d.slice(4, 10)} ${d.slice(10)}`;
  }
  return d.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

export function formatCardNumberInput(raw: string): string {
  const d = raw.replace(/\D/g, '');
  const max = maxCardDigitsForPan(d);
  return formatCardDigitsGrouped(d, max);
}

/** Formats expiry as MM/YY while typing (digits only in raw input). */
export function formatExpiryInput(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

/** Card face preview: grouped digits with • for remaining slots (Amex 4-6-5, else groups of 4). */
export function formatCardPreviewDisplay(cleanNum: string): string {
  const raw = cleanNum.replace(/\D/g, '');
  const maxDigits = maxCardDigitsForPan(raw);
  const d = raw.slice(0, maxDigits);
  if (d.length === 0) return '•••• •••• •••• ••••';
  const isAmex = /^3[47]/.test(d);
  const targetLen = isAmex ? MAX_CARD_DIGITS_AMEX : Math.min(MAX_CARD_DIGITS_STANDARD, Math.max(16, d.length));
  let padded = '';
  for (let i = 0; i < targetLen; i++) {
    padded += i < d.length ? d[i] : '•';
  }
  if (isAmex) {
    return `${padded.slice(0, 4)} ${padded.slice(4, 10)} ${padded.slice(10)}`;
  }
  const chunks: string[] = [];
  for (let i = 0; i < padded.length; i += 4) {
    chunks.push(padded.slice(i, i + 4));
  }
  return chunks.join(' ');
}
