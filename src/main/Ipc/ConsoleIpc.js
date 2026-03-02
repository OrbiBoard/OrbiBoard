const { ipcMain, app, BrowserWindow, dialog, webContents } = require('electron');
const fs = require('fs');
const backendLog = require('../Debug/backendLog');
const pluginManager = require('../Manager/Plugins/Main');
const windowManager = require('../Windows/WindowManager');

function register() {
  ipcMain.handle('debug:logs:get', async () => {
    try { return backendLog.getLast(20); } catch (e) { return []; }
  });
  ipcMain.on('debug:logs:subscribe', (event) => {
    try { backendLog.subscribe(event.sender); } catch (e) {}
  });
  ipcMain.handle('debug:logs:getEntries', async (_e, count = 500) => {
    try { return backendLog.getLastEntries(count); } catch (e) { return []; }
  });
  ipcMain.handle('debug:log:write', async (_e, level, ...args) => {
    try { backendLog.write(level, ...(Array.isArray(args) ? args : [args])); return { ok: true }; } catch (e) { return { ok: false, error: e?.message || String(e) }; }
  });

  ipcMain.handle('console:open', async () => {
    try {
      windowManager.ensureConsoleWindow();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e?.message || String(e) };
    }
  });

  ipcMain.handle('console:metrics', async () => {
    try {
      const info = {};
      try {
        info.process = {
          memory: (() => {
            try {
              const m = process.memoryUsage();
              return { rss: m.rss, heapTotal: m.heapTotal, heapUsed: m.heapUsed, external: m.external };
            } catch (e) { return {}; }
          })(),
          cpu: (() => {
            try {
              const c = process.cpuUsage();
              return { user: c.user, system: c.system };
            } catch (e) { return {}; }
          })(),
          uptimeSec: (() => { try { return process.uptime(); } catch (e) { return 0; } })()
        };
      } catch (e) {}
      try {
        info.appMetrics = (typeof app.getAppMetrics === 'function') ? app.getAppMetrics() : [];
      } catch (e) { info.appMetrics = []; }
      try {
        const list = await pluginManager.getPlugins();
        info.plugins = { total: Array.isArray(list) ? list.length : 0, enabled: (Array.isArray(list) ? list.filter(p => p.enabled).length : 0) };
      } catch (e) { info.plugins = { total: 0, enabled: 0 }; }
      return { ok: true, info };
    } catch (e) {
      return { ok: false, error: e?.message || String(e) };
    }
  });

  ipcMain.handle('console:listWindows', async () => {
    try {
      const wins = BrowserWindow.getAllWindows();
      const manifest = pluginManager.getPlugins ? pluginManager.getPlugins() : [];
      const appPath = app.getAppPath();
      const appMetrics = app.getAppMetrics ? app.getAppMetrics() : [];
      const pidMemoryMap = new Map();
      appMetrics.forEach(m => {
        if (m.memory && m.memory.workingSetSize !== undefined) {
          pidMemoryMap.set(m.pid, m.memory.workingSetSize);
        }
      });
      const data = wins.map((w) => {
        let url = '';
        try { url = w.webContents.getURL(); } catch (e) {}
        let title = '';
        try { title = w.getTitle(); } catch (e) {}
        let bounds = null;
        try { bounds = w.getBounds(); } catch (e) {}
        let webContentsId = null;
        try { webContentsId = w.webContents.id; } catch (e) {}
        let pluginId = null;
        let isSystemWindow = false;
        let memoryBytes = 0;
        let processId = null;
        let processType = null;
        try { pluginId = pluginManager.getPluginIdByWebContentsId(webContentsId); } catch (e) {}
        if (!pluginId && url) {
          if (url.includes('/OrbiBoard/src/') || url.includes(appPath + '/src/')) {
            isSystemWindow = true;
          } else {
            for (const p of manifest) {
              if (p.local) {
                const pluginPath = '/plugins/' + p.local + '/';
                if (url.toLowerCase().includes(pluginPath.toLowerCase())) {
                  pluginId = p.id;
                  break;
                }
              }
            }
          }
        }
        try {
          processId = w.webContents.getOSProcessId ? w.webContents.getOSProcessId() : null;
        } catch (e) {}
        const matchingMetric = appMetrics.find(m => m.pid === processId);
        if (matchingMetric && matchingMetric.memory) {
          memoryBytes = matchingMetric.memory.workingSetSize || 0;
          processType = matchingMetric.type;
        }
        return {
          id: w.id,
          title,
          url,
          isVisible: (() => { try { return w.isVisible(); } catch (e) { return false; } })(),
          isFocused: (() => { try { return w.isFocused(); } catch (e) { return false; } })(),
          isMinimized: (() => { try { return w.isMinimized(); } catch (e) { return false; } })(),
          isMaximized: (() => { try { return w.isMaximized(); } catch (e) { return false; } })(),
          isFullScreen: (() => { try { return w.isFullScreen(); } catch (e) { return false; } })(),
          webContentsId,
          bounds,
          pluginId,
          isSystemWindow,
          memoryBytes,
          processId,
          processType
        };
      });
      return { ok: true, windows: data };
    } catch (e) {
      return { ok: false, error: e?.message || String(e) };
    }
  });

  ipcMain.handle('console:openDevTools', async (_e, windowId) => {
    try {
      const wc = webContents.fromId(Number(windowId));
      if (!wc) return { ok: false, error: 'window_not_found' };
      try { wc.openDevTools({ mode: 'detach' }); } catch (e) {}
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e?.message || String(e) };
    }
  });

  ipcMain.handle('console:focusWindow', async (_e, windowId) => {
    try {
      const wins = BrowserWindow.getAllWindows();
      const target = wins.find(w => w.id === Number(windowId));
      if (!target) return { ok: false, error: 'window_not_found' };
      try { target.show(); target.focus(); } catch (e) {}
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e?.message || String(e) };
    }
  });

  ipcMain.handle('console:controlWindow', async (_e, windowId, action) => {
    try {
      const win = BrowserWindow.getAllWindows().find(w => w.id === Number(windowId));
      if (!win) return { ok: false, error: 'window_not_found' };
      switch (String(action)) {
        case 'minimize': try { win.minimize(); } catch (e) {} break;
        case 'maximize': try { win.isMaximized() ? win.unmaximize() : win.maximize(); } catch (e) {} break;
        case 'reload': try { win.webContents?.reload(); } catch (e) {} break;
        case 'close': try { win.close(); } catch (e) {} break;
        case 'fullscreen': try { win.setFullScreen(!win.isFullScreen()); } catch (e) {} break;
        case 'hide': try { win.hide(); } catch (e) {} break;
        case 'show': try { win.show(); win.focus(); } catch (e) {} break;
        default: break;
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e?.message || String(e) };
    }
  });

  ipcMain.handle('console:exportText', async (_e, text, defaultName = 'backend.log') => {
    try {
      const { filePath, canceled } = await dialog.showSaveDialog({
        title: '保存日志',
        defaultPath: defaultName,
        filters: [{ name: '日志', extensions: ['log', 'txt'] }]
      });
      if (canceled || !filePath) return { ok: false, error: 'cancelled' };
      fs.writeFileSync(filePath, String(text || ''), 'utf-8');
      return { ok: true, path: filePath };
    } catch (e) {
      return { ok: false, error: e?.message || String(e) };
    }
  });
}

module.exports = { register };
