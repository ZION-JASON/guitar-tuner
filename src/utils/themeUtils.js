export const THEME_STORAGE_KEY = 'chromatuner.theme.v1';

export const THEME_IDS = {
  STUDIO: 'studio',
  PIXEL: 'pixel',
};

export function normalizeTheme(value) {
  return value === THEME_IDS.PIXEL ? THEME_IDS.PIXEL : THEME_IDS.STUDIO;
}

export function toggleThemeValue(currentTheme) {
  return normalizeTheme(currentTheme) === THEME_IDS.PIXEL
    ? THEME_IDS.STUDIO
    : THEME_IDS.PIXEL;
}

export function loadTheme() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return THEME_IDS.STUDIO;
  }
  try {
    return normalizeTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return THEME_IDS.STUDIO;
  }
}

export function saveTheme(theme) {
  const normalized = normalizeTheme(theme);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, normalized);
    } catch {
      // Ignore storage quota / privacy mode failures
    }
  }
  return normalized;
}

export function applyThemeToDocument(theme, doc = typeof document !== 'undefined' ? document : null) {
  const normalized = normalizeTheme(theme);
  if (!doc || !doc.documentElement) return normalized;

  if (normalized === THEME_IDS.PIXEL) {
    doc.documentElement.dataset.theme = THEME_IDS.PIXEL;
    doc.documentElement.classList.add('pixel-theme');
  } else {
    delete doc.documentElement.dataset.theme;
    doc.documentElement.classList.remove('pixel-theme');
  }

  return normalized;
}
