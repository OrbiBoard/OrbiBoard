const THEME_KEY = 'theme';
const THEME_EVENT = 'sys:theme-changed';

const CSS_VARS = {
  dark: {
    '--bg': '#121621',
    '--fg': '#ededed',
    '--muted': '#94a3b8',
    '--panel': 'rgba(255, 255, 255, 0.04)',
    '--item-bg': 'rgba(255, 255, 255, 0.04)',
    '--border': 'rgba(255, 255, 255, 0.12)',
    '--bg-sidebar': 'transparent',
    '--bg-titlebar': '#121621',
    '--bg-modal': '#1b1f2a',
    '--fg-title': '#e5e7eb',
    '--btn-secondary-bg': 'rgba(255, 255, 255, 0.06)',
    '--input-bg': 'rgba(255, 255, 255, 0.1)',
    '--secondary-bg': 'rgba(34, 46, 63, 0.95)',
    '--slider-bg': 'rgba(255, 255, 255, 0.2)',
    '--hover': 'rgba(255, 255, 255, 0.08)',
    '--active': 'rgba(var(--accent-rgb), 0.25)'
  },
  light: {
    '--bg': '#f3f4f6',
    '--fg': '#1f2937',
    '--muted': '#6b7280',
    '--panel': '#ffffff',
    '--item-bg': '#f3f4f6',
    '--border': '#e5e7eb',
    '--bg-sidebar': 'transparent',
    '--bg-titlebar': '#ffffff',
    '--bg-modal': '#ffffff',
    '--fg-title': '#111827',
    '--btn-secondary-bg': 'rgba(0, 0, 0, 0.05)',
    '--input-bg': 'rgba(0, 0, 0, 0.05)',
    '--secondary-bg': 'rgba(245, 245, 245, 0.95)',
    '--slider-bg': 'rgba(0, 0, 0, 0.1)',
    '--hover': 'rgba(0, 0, 0, 0.05)',
    '--active': 'rgba(var(--accent-rgb), 0.1)'
  }
};

function adjustBrightness(hex, percent) {
  if (!hex || typeof hex !== 'string') return '#238f4a';
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length !== 6) return hex;
  const num = parseInt(cleanHex, 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (num >> 16) + amt));
  const G = Math.min(255, Math.max(0, (num >> 8 & 0x00FF) + amt));
  const B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return { r: 35, g: 143, b: 74 };
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length !== 6) return { r: 35, g: 143, b: 74 };
  return {
    r: parseInt(cleanHex.substring(0, 2), 16),
    g: parseInt(cleanHex.substring(2, 4), 16),
    b: parseInt(cleanHex.substring(4, 6), 16)
  };
}

function isColorDark(color) {
  if (!color) return true;
  let r, g, b;
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  } else if (color.startsWith('rgb')) {
    const parts = color.match(/\d+/g);
    if (parts && parts.length >= 3) {
      r = parseInt(parts[0]);
      g = parseInt(parts[1]);
      b = parseInt(parts[2]);
    } else {
      return true;
    }
  } else {
    return true;
  }
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return yiq < 128;
}

function getSystemDarkMode() {
  try {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch (e) {
    return false;
  }
}

function getEffectiveMode(mode) {
  if (mode === 'system') {
    return getSystemDarkMode() ? 'dark' : 'light';
  }
  return mode === 'dark' ? 'dark' : 'light';
}

function applyTheme(mode, color) {
  const root = document.documentElement;
  const effectiveMode = getEffectiveMode(mode);
  const accent = color || '#238f4a';
  const { r, g, b } = hexToRgb(accent);
  
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);
  
  const vars = CSS_VARS[effectiveMode] || CSS_VARS.dark;
  Object.entries(vars).forEach(([key, value]) => {
    if (value.includes('var(--accent-rgb)')) {
      root.style.setProperty(key, value.replace('var(--accent-rgb)', `${r}, ${g}, ${b}`));
    } else {
      root.style.setProperty(key, value);
    }
  });
  
  const gradientAccent = effectiveMode === 'dark' 
    ? adjustBrightness(accent, -40)
    : adjustBrightness(accent, 60);
  root.style.setProperty('--bg-gradient-start', gradientAccent);
  
  if (effectiveMode === 'dark') {
    root.classList.remove('theme-light');
    root.classList.add('theme-dark');
    document.body?.classList.remove('theme-light');
    document.body?.classList.add('theme-dark');
  } else {
    root.classList.remove('theme-dark');
    root.classList.add('theme-light');
    document.body?.classList.remove('theme-dark');
    document.body?.classList.add('theme-light');
  }
  
  if (document.body) {
    document.body.style.background = `radial-gradient(900px 520px at 50% -200px, var(--bg-gradient-start), var(--bg))`;
  }
}

function createThemeManager(options = {}) {
  const { 
    getConfig = () => Promise.resolve({ themeMode: 'system', themeColor: '#238f4a' }),
    onConfigChanged = null,
    ipcRenderer = null
  } = options;
  
  let currentTheme = { mode: 'system', color: '#238f4a' };
  let listeners = [];
  
  async function init() {
    try {
      const config = await getConfig();
      currentTheme.mode = config.themeMode || 'system';
      currentTheme.color = config.themeColor || '#238f4a';
      applyTheme(currentTheme.mode, currentTheme.color);
      
      if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
          if (currentTheme.mode === 'system') {
            applyTheme('system', currentTheme.color);
          }
        });
      }
      
      if (onConfigChanged) {
        onConfigChanged((payload) => {
          if (payload && payload.scope === 'system') {
            if (payload.key === 'themeMode') {
              currentTheme.mode = payload.value;
            } else if (payload.key === 'themeColor') {
              currentTheme.color = payload.value;
            }
            applyTheme(currentTheme.mode, currentTheme.color);
            notifyListeners();
          }
        });
      }
      
      if (ipcRenderer) {
        ipcRenderer.on(THEME_EVENT, (_e, theme) => {
          if (theme) {
            if (theme.mode) currentTheme.mode = theme.mode;
            if (theme.color) currentTheme.color = theme.color;
            applyTheme(currentTheme.mode, currentTheme.color);
            notifyListeners();
          }
        });
      }
    } catch (e) {
      console.error('[ThemeManager] Init failed:', e);
      applyTheme('system', '#238f4a');
    }
  }
  
  function onChange(callback) {
    listeners.push(callback);
    return () => {
      listeners = listeners.filter(l => l !== callback);
    };
  }
  
  function notifyListeners() {
    listeners.forEach(cb => {
      try {
        cb({ ...currentTheme });
      } catch (e) {}
    });
  }
  
  function getTheme() {
    return { ...currentTheme };
  }
  
  return {
    init,
    apply: (mode, color) => {
      if (mode) currentTheme.mode = mode;
      if (color) currentTheme.color = color;
      applyTheme(currentTheme.mode, currentTheme.color);
      notifyListeners();
    },
    get: getTheme,
    onChange,
    getEffectiveMode: () => getEffectiveMode(currentTheme.mode),
    isDark: () => getEffectiveMode(currentTheme.mode) === 'dark'
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    applyTheme,
    createThemeManager,
    getSystemDarkMode,
    getEffectiveMode,
    isColorDark,
    adjustBrightness,
    hexToRgb,
    CSS_VARS,
    THEME_EVENT
  };
}

if (typeof window !== 'undefined') {
  window.ThemeUtils = {
    applyTheme,
    createThemeManager,
    getSystemDarkMode,
    getEffectiveMode,
    isColorDark,
    adjustBrightness,
    hexToRgb,
    CSS_VARS,
    THEME_EVENT
  };
}
