// Canvas typography: the one font stack every painter uses, and the thousands separator the score
// and best lines rely on. Text only, no layout.

export const FONT = 'ui-sans-serif, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export function formatScore(value) {
  const text = String(Math.max(0, Math.round(value)));
  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    if (i > 0 && (text.length - i) % 3 === 0) out += ',';
    out += text[i];
  }
  return out;
}
