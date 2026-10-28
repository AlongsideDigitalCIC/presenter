const SERIF_FONTS = new Set(['Merriweather', 'Lora', 'Playfair Display', 'Crimson Pro', 'EB Garamond']);

export function getFontFamilyCss(fontName) {
  const raw = (fontName || '').trim() || 'Inter';
  const generic = SERIF_FONTS.has(raw) ? 'serif' : 'sans-serif';
  return raw.includes(' ') ? `'${raw}', ${generic}` : `${raw}, ${generic}`;
}
