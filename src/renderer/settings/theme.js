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
    '--hover': 'rgba(255, 255, 255, 0.08)'
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
    '--hover': 'rgba(0, 0, 0, 0.05)'
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

window.applyTheme = (mode, color) => {
  const root = document.documentElement;
  const effectiveMode = getEffectiveMode(mode);
  const accent = color || '#238f4a';
  const { r, g, b } = hexToRgb(accent);
  
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);
  
  const vars = CSS_VARS[effectiveMode] || CSS_VARS.dark;
  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  
  const activeColor = effectiveMode === 'dark' 
    ? `rgba(${r}, ${g}, ${b}, 0.25)`
    : `rgba(${r}, ${g}, ${b}, 0.1)`;
  root.style.setProperty('--active', activeColor);
  
  const gradientAccent = effectiveMode === 'dark' 
    ? adjustBrightness(accent, -40)
    : adjustBrightness(accent, 60);
  root.style.setProperty('--bg-gradient-start', gradientAccent);
  
  if (effectiveMode === 'dark') {
    root.classList.remove('theme-light');
    root.classList.add('theme-dark');
  } else {
    root.classList.remove('theme-dark');
    root.classList.add('theme-light');
  }
  
  if (document.body) {
    document.body.style.background = `radial-gradient(900px 520px at 50% -200px, var(--bg-gradient-start), var(--bg))`;
  }
};

window._currentThemeConfig = { mode: 'system', color: '#238f4a' };

window.initTheme = async () => {
  try {
    if (window.settingsAPI?.getTheme) {
      const theme = await window.settingsAPI.getTheme();
      if (theme.ok) {
        window._currentThemeConfig.mode = theme.mode;
        window._currentThemeConfig.color = theme.color;
      }
    } else if (window.settingsAPI?.configGetAll) {
      const cfg = await window.settingsAPI.configGetAll('system');
      window._currentThemeConfig.mode = cfg?.themeMode || 'system';
      window._currentThemeConfig.color = cfg?.themeColor || '#238f4a';
    }
    
    window.applyTheme(window._currentThemeConfig.mode, window._currentThemeConfig.color);
    
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (window._currentThemeConfig.mode === 'system') {
          window.applyTheme('system', window._currentThemeConfig.color);
        }
      });
    }
    
    if (window.settingsAPI?.onThemeChanged) {
      window.settingsAPI.onThemeChanged((theme) => {
        if (theme) {
          window._currentThemeConfig.mode = theme.mode || window._currentThemeConfig.mode;
          window._currentThemeConfig.color = theme.color || window._currentThemeConfig.color;
          window.applyTheme(window._currentThemeConfig.mode, window._currentThemeConfig.color);
        }
      });
    } else if (window.settingsAPI?.onConfigChanged) {
      window.settingsAPI.onConfigChanged((payload) => {
        if (payload && payload.scope === 'system') {
          if (payload.key === 'themeMode') {
            window._currentThemeConfig.mode = payload.value;
          } else if (payload.key === 'themeColor') {
            window._currentThemeConfig.color = payload.value;
          }
          window.applyTheme(window._currentThemeConfig.mode, window._currentThemeConfig.color);
        }
      });
    }
  } catch (e) {
    console.error('Failed to init theme:', e);
    window.applyTheme('system', '#238f4a');
  }
};
