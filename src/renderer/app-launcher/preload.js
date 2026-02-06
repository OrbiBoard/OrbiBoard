const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcherAPI', {
  pluginCall: (targetPluginId, fnName, args) => ipcRenderer.invoke('launcher:callPlugin', targetPluginId, fnName, args),
  configGet: (scope, key) => ipcRenderer.invoke('launcher:configGet', scope, key),
  configSet: (scope, key, value) => ipcRenderer.invoke('launcher:configSet', scope, key, value),
  openMainSettings: () => ipcRenderer.invoke('launcher:openSettings'),
  listPlugins: () => ipcRenderer.invoke('launcher:listPlugins'),
  closeMenu: () => ipcRenderer.invoke('launcher:closeMenu'),
  getTheme: () => ipcRenderer.invoke('launcher:getTheme'),
  onThemeUpdate: (callback) => ipcRenderer.on('theme:update', (e, theme) => callback(theme))
});
