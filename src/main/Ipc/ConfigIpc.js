const { ipcMain, BrowserWindow } = require('electron');
const store = require('../Manager/Store/Main');
const pluginManager = require('../Manager/Plugins/Main');
const backendLog = require('../Debug/backendLog');

const THEME_KEYS = ['themeMode', 'themeColor'];
const THEME_EVENT = 'sys:theme-changed';

function broadcastThemeChange() {
  try {
    const sys = store.getAll('system') || {};
    const theme = {
      mode: sys.themeMode || 'system',
      color: sys.themeColor || '#238f4a'
    };
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send(THEME_EVENT, theme);
      }
    });
  } catch (e) {}
}

function register() {
  ipcMain.handle('config:getAll', async (_e, scope) => {
    return store.getAll(scope);
  });
  ipcMain.handle('config:get', async (_e, scope, key) => {
    return store.get(scope, key);
  });
  ipcMain.handle('config:set', async (_e, scope, key, value) => {
    const r = store.set(scope, key, value);
    try {
      BrowserWindow.getAllWindows().forEach(win => {
        if (!win.isDestroyed()) {
          win.webContents.send('sys:config-changed', { scope, key, value });
        }
      });
      if (scope === 'system' && THEME_KEYS.includes(key)) {
        broadcastThemeChange();
      }
      if (scope === 'system' && key === 'developerMode') {
        backendLog.enableLogging(true);
      }
    } catch (e) {}
    return r;
  });
  ipcMain.handle('config:getTheme', async () => {
    try {
      const sys = store.getAll('system') || {};
      return {
        ok: true,
        mode: sys.themeMode || 'system',
        color: sys.themeColor || '#238f4a'
      };
    } catch (e) {
      return { ok: false, error: e?.message || String(e) };
    }
  });
  ipcMain.handle('config:deleteScope', async (_e, scope) => {
    return store.deleteScope(scope);
  });
  ipcMain.handle('config:ensureDefaults', async (_e, scope, defaults) => {
    return store.ensureDefaults(scope, defaults);
  });
  ipcMain.handle('config:listScopes', async () => {
    try { return store.listPluginScopes(); } catch (e) { return []; }
  });
  
  ipcMain.handle('config:plugin:getAll', async (_e, pluginKey) => {
    try {
      const canon = pluginManager.canonicalizePluginId(pluginKey);
      const primary = store.getAll(canon);
      if (primary && Object.keys(primary).length) return primary;
      const raw = store.getAll(pluginKey);
      if (raw && Object.keys(raw).length) return raw;
      const dot = store.getAll(String(canon).replace(/-/g, '.'));
      return dot || {};
    } catch (e) { return {}; }
  });
  ipcMain.handle('config:plugin:get', async (_e, pluginKey, key) => {
    try {
      const canon = pluginManager.canonicalizePluginId(pluginKey);
      let val = store.get(canon, key);
      if (val === undefined) val = store.get(pluginKey, key);
      if (val === undefined) val = store.get(String(canon).replace(/-/g, '.'), key);
      return val;
    } catch (e) { return undefined; }
  });
  ipcMain.handle('config:plugin:set', async (_e, pluginKey, key, value) => {
    try {
      const canon = pluginManager.canonicalizePluginId(pluginKey);
      return store.set(canon, key, value);
    } catch (e) { return { ok: false, error: e?.message || String(e) }; }
  });
  
  ipcMain.handle('config:plugin:migrateScope', async (_e, sourceScope, targetPluginKey, deleteSource = true) => {
    try {
      const data = store.getAll(sourceScope);
      const scope = pluginManager.canonicalizePluginId(targetPluginKey);
      store.setAll(scope, data);
      if (deleteSource) store.deleteScope(sourceScope);
      return { ok: true, targetScope: scope };
    } catch (e) {
      return { ok: false, error: e?.message || String(e) };
    }
  });
}

module.exports = { register };
