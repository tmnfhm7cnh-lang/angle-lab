/**
 * Calendar dates in the user's LOCAL time zone.
 *
 * `new Date().toISOString().slice(0, 10)` is the UTC date: between 00:00 and
 * 02:00 in Spain it is still "yesterday". Everything the user sees or exports
 * (file names, the CSV date) must follow the local calendar day instead.
 */

export function localDateISO(date = new Date()) {
  const y = String(date.getFullYear()).padStart(4, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Returns a new Date `n` calendar days from `date` (n may be negative); the input is untouched.
export function addDays(date, n) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + n);
  return next;
}
