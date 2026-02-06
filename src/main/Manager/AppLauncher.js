const { BrowserWindow, screen, app, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const { execFileSync } = require('child_process');
const Runtime = require('./Plugins/Runtime');
const PluginManager = require('./Plugins/Main');
const store = require('./Store/Main');
const windowManager = require('../Windows/WindowManager');

function resolveShortcutTarget(p) {
  try {
    const fp = String(p || ''); if (!fp || process.platform !== 'win32') return '';
    if (String(fp).toLowerCase().endsWith('.lnk')) {
      const cmd = `(New-Object -COM WScript.Shell).CreateShortcut('${fp.replace(/'/g, "''")}').TargetPath`;
      const out = execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', cmd], { encoding: 'utf8' });
      const target = String(out || '').trim();
      return target || '';
    }
    return '';
  } catch (e) { return ''; }
}

class AppLauncherManager {
  constructor() {
    this.appWin = null;
    this.appsCache = { ts: 0, list: [], building: false };
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;

    ipcMain.handle('launcher:callPlugin', async (e, target, fn, args) => {
      // Wrapper for Runtime.callFunction
      // Note: Runtime.callFunction returns { ok, result/error }
      return Runtime.callFunction(target, fn, args, 'launcher', ipcMain);
    });

    ipcMain.handle('launcher:configGet', async (e, scope, key) => {
      try {
        const val = store.get(scope, key);
        return { ok: true, result: val };
      } catch (e) { return { ok: false, error: e.message }; }
    });

    ipcMain.handle('launcher:configSet', async (e, scope, key, value) => {
      try {
        store.set(scope, key, value);
        return { ok: true };
      } catch (e) { return { ok: false, error: e.message }; }
    });

    ipcMain.handle('launcher:listPlugins', async () => {
      try {
        const list = PluginManager.getPlugins();
        return { ok: true, result: list };
      } catch (e) { return { ok: false, error: e.message }; }
    });

    ipcMain.handle('launcher:closeMenu', async () => {
      this.closeMenu();
      return true;
    });

    ipcMain.handle('launcher:openSettings', async () => {
      try {
        const win = windowManager.ensureSettingsWindow();
        const sendNav = () => { try { win.webContents.send('settings:navigate', 'general'); } catch (e) {} };
        if (win.webContents.isLoading()) win.webContents.once('did-finish-load', sendNav);
        else sendNav();
        return true;
      } catch (e) { return { ok: false, error: e.message }; }
    });

    ipcMain.handle('launcher:getTheme', async () => {
      try {
        const theme = store.getAll('system') || {};
        return { ok: true, result: theme };
      } catch (e) { return { ok: false, error: e.message }; }
    });
  }

  async buildAppsCache() {
    try {
      if (process.platform !== 'win32') { this.appsCache.list = []; this.appsCache.ts = Date.now(); return; }
      const roots = [
        path.join(String(process.env['ProgramData'] || ''), 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
        path.join(String(process.env['AppData'] || ''), 'Microsoft', 'Windows', 'Start Menu', 'Programs')
      ].filter(p => p && fs.existsSync(p));
      const out = [];
      const seen = new Set();
      const isExe = (p) => String(p || '').toLowerCase().endsWith('.exe');
      const isLnk = (p) => String(p || '').toLowerCase().endsWith('.lnk');
      const pushApp = (p) => { try { const key = String(p || '').toLowerCase(); if (!key) return; if (seen.has(key)) return; seen.add(key); const nm = path.basename(p, path.extname(p)); out.push({ name: nm, path: p }); } catch (e) { } };
      const walk = async (dir, depth) => {
        try {
          const ents = await fsp.readdir(dir, { withFileTypes: true });
          for (const d of ents) {
            const p1 = path.join(dir, d.name);
            if (d.isFile() && (isExe(p1) || isLnk(p1))) { pushApp(p1); continue; }
            if (d.isDirectory() && depth < 2) { await walk(p1, depth + 1); }
          }
        } catch (e) { }
      };
      for (const r of roots) { await walk(r, 0); }
      this.appsCache.list = out.slice(0, 800);
      this.appsCache.ts = Date.now();
    } catch (e) { this.appsCache.list = []; this.appsCache.ts = Date.now(); }
  }

  async listInstalledApps() {
    try {
      if (process.platform !== 'win32') return [];
      const now = Date.now();
      if (this.appsCache.list.length && (now - this.appsCache.ts) < 600000) return this.appsCache.list.slice(0, 300);
      
      if (!this.appsCache.list.length) {
         await this.buildAppsCache();
      } else if (!this.appsCache.building) {
         this.appsCache.building = true; 
         this.buildAppsCache().finally(() => { this.appsCache.building = false; }); 
      }
      
      return this.appsCache.list.slice(0, 120);
    } catch (e) { return []; }
  }

  toggleMenu(options) {
    if (this.appWin && !this.appWin.isDestroyed() && this.appWin.isVisible()) {
      this.closeMenu();
    } else {
      this.openMenu(options);
    }
  }

  openMenu(options = {}) {
    try {
      // options: { x, y, bounds, type: 'tray' | 'compass' }
      if (this.appWin && !this.appWin.isDestroyed()) {
        this.appWin.show();
        this.appWin.focus();
        
        // Update theme immediately on show
        const theme = store.getAll('system') || {};
        this.appWin.webContents.send('theme:update', theme);
        
        Runtime.emitEvent('app.active', { active: true });
        return true;
      }

      const targetW = 420;
      const targetH = 520;
      let x = 0;
      let y = 0;
      
      // Calculate position
      if (options.type === 'tray' && options.x !== undefined && options.y !== undefined) {
         // Tray logic: above or near the tray icon (mouse pos)
         const display = screen.getDisplayNearestPoint({ x: options.x, y: options.y });
         const db = display.workArea; // Use workArea to avoid taskbar
         
         // Try to center horizontally on mouse, and place above taskbar (usually bottom)
         x = options.x - Math.floor(targetW / 2);
         y = options.y - targetH - 10; 
         
         // If y is too high (off screen), maybe taskbar is on top?
         if (y < db.y) {
            y = options.y + 20; // Place below
         }
         
         // Ensure inside bounds
         if (x < db.x) x = db.x;
         if (x + targetW > db.x + db.width) x = db.x + db.width - targetW;
         if (y < db.y) y = db.y;
         if (y + targetH > db.y + db.height) y = db.y + db.height - targetH;
         
      } else if (options.type === 'compass' && options.bounds) {
         // Compass logic: near the compass window
         // options.bounds is {x, y, width, height} of dragWin
         const b = options.bounds;
         const cx = b.x + Math.floor(b.width / 2);
         const cy = b.y + Math.floor(b.height / 2);
         
         x = cx - Math.floor(targetW / 2);
         y = b.y - targetH - 10; // Default above
         
         const display = screen.getDisplayNearestPoint({ x: cx, y: cy });
         const db = display.workArea;

         // Check if enough space above
         if (y < db.y) {
             // Not enough space above, try below
             y = b.y + b.height + 10;
         }
         
         // Ensure inside bounds
         if (x < db.x) x = db.x;
         if (x + targetW > db.x + db.width) x = db.x + db.width - targetW;
         if (y < db.y) y = db.y;
         if (y + targetH > db.y + db.height) y = db.y + db.height - targetH;

      } else {
         // Default center
         const pt = screen.getCursorScreenPoint();
         const display = screen.getDisplayNearestPoint(pt);
         const b = display.bounds;
         x = b.x + Math.floor((b.width - targetW) / 2);
         y = b.y + Math.floor((b.height - targetH) / 2);
      }

      const iconPath = process.platform === 'win32'
        ? path.join(app.getAppPath(), 'icon.ico')
        : path.join(app.getAppPath(), 'logo.png');

      const theme = store.getAll('system') || {};
      const bgColor = theme.themeMode === 'light' ? '#f8f9fa' : '#101820';

      this.appWin = new BrowserWindow({
        x: Math.round(x),
        y: Math.round(y),
        width: targetW,
        height: targetH,
        useContentSize: true,
        frame: false,
        transparent: false,
        backgroundColor: bgColor,
        show: true,
        resizable: false,
        movable: true,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        skipTaskbar: true,
        alwaysOnTop: true,
        title: 'OrbiBoard',
        icon: iconPath,
        focusable: true,
        hasShadow: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(app.getAppPath(), 'src', 'renderer', 'app-launcher', 'preload.js')
        }
      });
      
      this.appWin.loadFile(path.join(app.getAppPath(), 'src', 'renderer', 'app-launcher', 'index.html'));

      this.appWin.once('ready-to-show', () => {
         // Send initial theme
         const theme = store.getAll('system') || {};
         if (this.appWin && !this.appWin.isDestroyed()) {
            this.appWin.webContents.send('theme:update', theme);
         }
      });

      this.appWin.on('closed', () => { this.appWin = null; });
      this.appWin.on('blur', () => {
         setTimeout(() => {
           if (this.appWin && !this.appWin.isDestroyed() && !this.appWin.isFocused()) {
             this.closeMenu();
           }
         }, 150);
      });

      Runtime.emitEvent('app.active', { active: true });
      return true;
    } catch (e) {
      console.error('Failed to open app menu:', e);
      return false;
    }
  }

  closeMenu() {
    try {
      if (this.appWin && !this.appWin.isDestroyed()) {
        this.appWin.close();
        this.appWin = null;
      }
      Runtime.emitEvent('app.active', { active: false });
    } catch (e) { }
  }

  async getFileIconDataUrl(p) {
    try {
      const fp = String(p || ''); if (!fp) return '';
      let usePath = fp;
      try { const target = resolveShortcutTarget(fp); if (target) usePath = target; } catch (e) { }
      const img = await app.getFileIcon(usePath, { size: 'normal' });
      if (!img || img.isEmpty()) return '';
      return img.toDataURL();
    } catch (e) { return ''; }
  }
}

module.exports = new AppLauncherManager();
