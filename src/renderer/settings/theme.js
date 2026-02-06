// 主题管理模块 (非模块化，挂载到 window)

window.applyTheme = (mode, color) => {
  const root = document.documentElement;
  const isDark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  
  // 辅助：调整颜色亮度 (percent: -100 to 100)
  const adjustBrightness = (hex, percent) => {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return '#' + (
      0x1000000 +
      (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255)
    ).toString(16).slice(1);
  };

  // 设置强调色
  const accent = color || '#238f4a';
  root.style.setProperty('--accent', accent);
  // 计算并设置 RGB 变量，用于半透明背景
  const hex = accent.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  root.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);
  
  // 设置深浅模式变量
  if (isDark) {
    // 深色模式：背景改为原侧边栏颜色 (#121621)，渐变头使用强调色的极深版本
    root.style.setProperty('--bg', '#121621');
    root.style.setProperty('--fg', '#ededed');
    root.style.setProperty('--muted', '#94a3b8');
    root.style.setProperty('--panel', 'rgba(255, 255, 255, 0.04)'); // 保持原透明度
    root.style.setProperty('--item-bg', 'rgba(255, 255, 255, 0.04)');
    root.style.setProperty('--border', 'rgba(255, 255, 255, 0.12)');
    root.style.setProperty('--bg-sidebar', 'transparent'); // 侧边栏透明
    root.style.setProperty('--bg-titlebar', '#121621');
    root.style.setProperty('--bg-modal', '#1b1f2a');
    root.style.setProperty('--fg-title', '#e5e7eb');
    root.style.setProperty('--btn-secondary-bg', 'rgba(255, 255, 255, 0.06)');
    
    // 计算深色渐变头：适度降低亮度，避免过黑
    const darkAccent = adjustBrightness(accent, -40);
    root.style.setProperty('--bg-gradient-start', darkAccent);
    
    // 恢复原有背景样式（径向渐变）
    document.body.style.background = 'radial-gradient(900px 520px at 50% -200px, var(--bg-gradient-start), var(--bg))';
  } else {
    root.style.setProperty('--bg', '#f3f4f6');
    root.style.setProperty('--fg', '#1f2937');
    root.style.setProperty('--muted', '#6b7280');
    root.style.setProperty('--panel', '#ffffff');
    root.style.setProperty('--item-bg', '#f3f4f6');
    root.style.setProperty('--border', '#e5e7eb');
    root.style.setProperty('--bg-sidebar', 'transparent'); // 侧边栏透明
    root.style.setProperty('--bg-titlebar', '#ffffff');
    root.style.setProperty('--bg-modal', '#ffffff');
    root.style.setProperty('--fg-title', '#111827');
    root.style.setProperty('--btn-secondary-bg', 'rgba(0, 0, 0, 0.05)');
    
    // 计算浅色渐变头：提高亮度但保留色彩（避免过白）
    const lightAccent = adjustBrightness(accent, 60);
    root.style.setProperty('--bg-gradient-start', lightAccent);
    
    // 浅色模式也保留径向渐变，但颜色更柔和
    document.body.style.background = 'radial-gradient(900px 520px at 50% -200px, var(--bg-gradient-start), var(--bg))';
  }
};

window._currentThemeConfig = { mode: 'system', color: '#238f4a' };

window.initTheme = async () => {
  try {
    const cfg = await window.settingsAPI?.configGetAll('system');
    window._currentThemeConfig.mode = cfg?.themeMode || 'system';
    window._currentThemeConfig.color = cfg?.themeColor || '#238f4a';
    
    window.applyTheme(window._currentThemeConfig.mode, window._currentThemeConfig.color);
    
    // 监听系统主题变化
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (window._currentThemeConfig.mode === 'system') {
        window.applyTheme('system', window._currentThemeConfig.color);
      }
    });
  } catch (e) {
    console.error('Failed to init theme:', e);
  }
};
