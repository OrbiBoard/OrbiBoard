const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('wizardAPI', {
  configGetAll: (scope) => ipcRenderer.invoke('config:getAll', scope),
  configGet: (scope, key) => ipcRenderer.invoke('config:get', scope, key),
  configSet: (scope, key, value) => ipcRenderer.invoke('config:set', scope, key, value),
  configEnsureDefaults: (scope, defaults) => ipcRenderer.invoke('config:ensureDefaults', scope, defaults),
  
  installPluginZipData: (fileName, data) => ipcRenderer.invoke('plugin:installZipData', fileName, data),
  npmGetVersions: (name) => ipcRenderer.invoke('npm:versions', name),
  npmDownload: (name, version) => ipcRenderer.invoke('npm:download', name, version),
  
  completeWizard: () => ipcRenderer.invoke('wizard:complete'),
  quitApp: () => ipcRenderer.invoke('system:quit')
});
