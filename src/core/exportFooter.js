/**
 * The text lines of the strip under an exported photo (no DOM, no drawing): subject code and
 * date, one line per measurement with its name and value, and the projection disclaimer. Only
 * the subject code is ever printed, never a person's name. More than `maxItems` measurements
 * collapse into a single "+n more" line so the strip stays a sensible height.
 */
export function footerLines({ subjectCode, date, items, disclaimer, more, maxItems = 12 }) {
  const lines = [[subjectCode, date].filter(Boolean).join(' · ')];
  const shown = items.length > maxItems ? items.slice(0, maxItems - 1) : items;
  for (const item of shown) lines.push(`${item.name} — ${item.value}`);
  if (shown.length < items.length) lines.push(more(items.length - shown.length));
  lines.push(disclaimer);
  return lines;
}
