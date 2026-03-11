const { app, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const url = require('url');
const store = require('../Manager/Store/Main');
const { spawn, exec } = require('child_process');

let _isAutoUpdating = false;
let _currentUpdateInfo = null;

function isAutoUpdating() {
  return _isAutoUpdating;
}

function getCurrentUpdateInfo() {
  return _currentUpdateInfo;
}

function cmp(a, b) {
  const pa = String(a || '').split('.').map((x) => parseInt(x, 10) || 0);
  const pb = String(b || '').split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const da = pa[i] || 0; const db = pb[i] || 0;
    if (da !== db) return da - db;
  }
  return 0;
}

const MAX_REDIRECTS = 5;

function getJson(u, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > MAX_REDIRECTS) {
      return reject(new Error('Too many redirects'));
    }
    try {
      const p = url.parse(u);
      const lib = (p.protocol === 'https:' ? https : http);
      const timeout = 30000;
      const req = lib.get(u, { timeout }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return resolve(getJson(res.headers.location, redirectCount + 1));
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
        });
      });
      req.on('error', (e) => reject(e));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    } catch (e) {
      reject(e);
    }
  });
}

function download(u, dest, onProgress, isAuto = false, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > MAX_REDIRECTS) {
      return reject(new Error('Too many redirects'));
    }
    try {
      const p = url.parse(u);
      const lib = (p.protocol === 'https:' ? https : http);
      const file = fs.createWriteStream(dest);
      const timeout = 300000;
      const req = lib.get(u, { timeout }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          try { file.close(); fs.unlinkSync(dest); } catch (e) {}
          return resolve(download(res.headers.location, dest, onProgress, isAuto, redirectCount + 1));
        }
        if (res.statusCode !== 200) {
          try { file.close(); fs.unlinkSync(dest); } catch (e) {}
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        const total = parseInt(res.headers['content-length'] || '0', 10) || 0;
        let received = 0;
        res.on('data', (chunk) => {
          file.write(chunk);
          received += chunk.length;
          if (onProgress && total > 0) {
            try { onProgress({ stage: 'update', message: `下载更新包 ${Math.floor(received * 100 / total)}%`, isAuto }); } catch (e) {}
          }
        });
        res.on('end', () => {
          file.end(() => {
            if (total > 0 && received !== total) {
              try { fs.unlinkSync(dest); } catch (e) {}
              return reject(new Error('Download incomplete'));
            }
            resolve({ ok: true, path: dest, size: received });
          });
        });
      });
      req.on('error', (e) => {
        try { file.close(); fs.unlinkSync(dest); } catch (e) {}
        reject(e);
      });
      req.on('timeout', () => {
        req.destroy();
        try { file.close(); fs.unlinkSync(dest); } catch (e) {}
        reject(new Error('Download timeout'));
      });
    } catch (e) {
      reject(e);
    }
  });
}

function applyAsar(srcPath) {
  try {
    const resourcesDir = path.resolve(path.dirname(process.execPath), 'resources');
    const target = path.join(resourcesDir, 'app.asar');
    const bak = path.join(resourcesDir, `app_${Date.now()}.asar.bak`);
    const tmp = path.join(resourcesDir, `app_${Date.now()}.asar.new`);
    fs.copyFileSync(srcPath, tmp);
    if (fs.existsSync(target)) {
      try { fs.renameSync(target, bak); } catch (e) {}
    }
    fs.renameSync(tmp, target);
    return true;
  } catch (e) {
    return false;
  }
}

function escapeBatPath(p) {
  return p.replace(/&/g, '^&').replace(/\|/g, '^|').replace(/</g, '^<').replace(/>/g, '^>').replace(/\^/g, '^^');
}

function stageScriptReplace(srcPath) {
  try {
    const resourcesDir = path.resolve(path.dirname(process.execPath), 'resources');
    const target = path.join(resourcesDir, 'app.asar');
    const exe = process.execPath;
    const exeDir = path.dirname(exe);
    const bat = path.join(exeDir, `apply_${Date.now()}.cmd`);
    const escapedSrc = escapeBatPath(srcPath.replace(/"/g, '""'));
    const escapedTarget = escapeBatPath(target.replace(/"/g, '""'));
    const escapedExe = escapeBatPath(exe.replace(/"/g, '""'));
    const content = [
      '@echo off',
      'setlocal',
      `set NEW=${escapedSrc}`,
      `set TARGET=${escapedTarget}`,
      `set APP=${escapedExe}`,
      ':copynew',
      'copy /y "%NEW%" "%TARGET%.new" >nul',
      'if errorlevel 1 (',
      '  timeout /t 2 /nobreak >nul',
      '  goto copynew',
      ')',
      ':swap',
      'if exist "%TARGET%" (',
      '  move /y "%TARGET%" "%TARGET%.bak" >nul',
      '  if errorlevel 1 (',
      '    timeout /t 2 /nobreak >nul',
      '    goto swap',
      '  )',
      ')',
      'move /y "%TARGET%.new" "%TARGET%" >nul',
      'if errorlevel 1 (',
      '  timeout /t 2 /nobreak >nul',
      '  goto swap',
      ')',
      'del /f /q "%NEW%" 2>nul',
      'del /f /q "%~f0" 2>nul',
      'start "" "%APP%"',
      'endlocal',
      'exit /b 0'
    ].join('\r\n');
    fs.writeFileSync(bat, content, 'utf-8');
    const p = spawn('cmd.exe', ['/c', bat], { detached: true, stdio: 'ignore' });
    p.unref();
    return true;
  } catch (e) {
    return false;
  }
}

async function checkAndUpdate(onProgress, checkOnly = false) {
  try {
    if (!app.isPackaged) return { ok: false, error: 'not_packaged' };
    const cfg = store.getAll('system') || {};
    const enabled = cfg.autoUpdateEnabled !== false;
    if (!enabled && !checkOnly) return { ok: false, error: 'disabled' };
    const base = cfg.updateServerUrl || 'https://orbiboard.3r60.top';
    const versionUrl = `${base.replace(/\/+$/,'')}/api/version`;
    
    const isAuto = !checkOnly && onProgress;
    if (isAuto) {
      _isAutoUpdating = true;
    }
    
    if (onProgress) { try { onProgress({ stage: 'update', message: '检查更新...', isAuto }); } catch (e) {} }
    const info = await getJson(versionUrl);
    const remote = String(info?.version || '');
    const local = String(app.getVersion ? app.getVersion() : (require('../../../package.json').version || '0.0.0'));
    if (!remote) { _isAutoUpdating = false; return { ok: false, error: 'no_remote_version' }; }
    
    let notes = '';
    try {
      const logUrl = `${base.replace(/\/+$/,'')}/api/changelog`;
      const logs = await getJson(logUrl);
      if (Array.isArray(logs)) {
        const entry = logs.find(x => x.version === remote);
        if (entry && entry.notes) notes = entry.notes;
      }
    } catch (e) {}

    const hasUpdate = cmp(remote, local) > 0;
    
    if (hasUpdate) {
      _currentUpdateInfo = { remoteVersion: remote, notes, isAuto };
    }
    
    if (checkOnly) {
      return { 
        ok: true, 
        hasUpdate, 
        currentVersion: local, 
        remoteVersion: remote, 
        notes,
        info 
      };
    }

    if (!hasUpdate) { _isAutoUpdating = false; return { ok: true, updated: false, version: local }; }
    
    const asarSupported = !!info.asarSupported;
    const asarUrl = info?.asar?.url || '';
    
    const useAsar = !!asarSupported && !!asarUrl;

    const tmpDir = path.join(app.getPath('temp'), 'OrbiBoard');
    try { fs.mkdirSync(tmpDir, { recursive: true }); } catch (e) {}

    if (useAsar) {
      if (notes && onProgress) {
        try { onProgress({ stage: 'update', message: `发现新版本 v${remote}\n${notes.split('\n')[0]}...`, isAuto }); } catch (e) {}
      }
      const dlUrl = asarUrl.startsWith('http') ? asarUrl : `${base.replace(/\/+$/,'')}${asarUrl.startsWith('/') ? asarUrl : ('/' + asarUrl)}`;
      const tmpFile = path.join(tmpDir, `update_${Date.now()}.asar.bin`);
      let dl;
      try {
        dl = await download(dlUrl, tmpFile, onProgress, isAuto);
      } catch (e) {
        _isAutoUpdating = false;
        return { ok: false, error: 'download_failed: ' + (e?.message || String(e)) };
      }
      if (!dl.ok) { _isAutoUpdating = false; return { ok: false, error: 'download_failed' }; }
      if (onProgress) { try { onProgress({ stage: 'update', message: '应用更新包...', isAuto }); } catch (e) {} }
      const staged = stageScriptReplace(tmpFile);
      if (staged) {
        try { store.set('system', 'openSettingsOnBootOnce', true); } catch (e) {}
        app.exit(0);
        return { ok: true, updated: true, version: remote, type: 'asar_script' };
      }
      const applied = applyAsar(tmpFile);
      if (!applied) {
        try { fs.unlinkSync(tmpFile); } catch (e) {}
        let installUrl = '';
        let installName = '';
        if (process.platform === 'win32') {
          installUrl = info?.windows?.url;
          installName = info?.windows?.filename || 'installer.exe';
        } else if (process.platform === 'linux') {
          installUrl = info?.uos?.url;
          installName = info?.uos?.filename || 'installer.deb';
        }
        if (installUrl) {
          if (onProgress) { try { onProgress({ stage: 'update', message: 'ASAR更新失败，切换安装包更新...', isAuto }); } catch (e) {} }
          const altUrl = installUrl.startsWith('http') ? installUrl : `${base.replace(/\/+$/,'')}${installUrl.startsWith('/') ? installUrl : ('/' + installUrl)}`;
          const tmpInst = path.join(tmpDir, installName);
          let dl2;
          try {
            dl2 = await download(altUrl, tmpInst, onProgress, isAuto);
          } catch (e) {
            _isAutoUpdating = false;
            return { ok: false, error: 'download_installer_failed: ' + (e?.message || String(e)) };
          }
          if (!dl2.ok) { _isAutoUpdating = false; return { ok: false, error: 'download_installer_failed' }; }
          if (onProgress) { try { onProgress({ stage: 'update', message: '正在启动安装程序...', isAuto }); } catch (e) {} }
          try {
            await shell.openPath(tmpInst);
            setTimeout(() => app.quit(), 1000);
            return { ok: true, updated: true, version: remote, type: 'installer' };
          } catch (e) {
            _isAutoUpdating = false;
            return { ok: false, error: 'open_installer_failed: ' + (e?.message || String(e)) };
          }
        }
        try { fs.unlinkSync(tmpFile); } catch (e) {}
        _isAutoUpdating = false;
        return { ok: false, error: 'apply_failed' };
      }
      try { fs.unlinkSync(tmpFile); } catch (e) {}
      try { store.set('system', 'openSettingsOnBootOnce', true); } catch (e) {}
      app.relaunch();
      app.exit(0);
      return { ok: true, updated: true, version: remote, type: 'asar' };
    } else {
      let installUrl = '';
      let installName = '';
      if (process.platform === 'win32') {
        installUrl = info?.windows?.url;
        installName = info?.windows?.filename || 'installer.exe';
      } else if (process.platform === 'linux') {
        installUrl = info?.uos?.url;
        installName = info?.uos?.filename || 'installer.deb';
      }
      
      if (!installUrl) { _isAutoUpdating = false; return { ok: false, error: 'no_installer_url' }; }
      
      if (notes && onProgress) {
        try { onProgress({ stage: 'update', message: `下载安装包 v${remote}\n${notes.split('\n')[0]}...`, isAuto }); } catch (e) {}
      }

      const dlUrl = installUrl.startsWith('http') ? installUrl : `${base.replace(/\/+$/,'')}${installUrl.startsWith('/') ? installUrl : ('/' + installUrl)}`;
      const tmpFile = path.join(tmpDir, installName);
      
      let dl;
      try {
        dl = await download(dlUrl, tmpFile, onProgress, isAuto);
      } catch (e) {
        _isAutoUpdating = false;
        return { ok: false, error: 'download_installer_failed: ' + (e?.message || String(e)) };
      }
      if (!dl.ok) { _isAutoUpdating = false; return { ok: false, error: 'download_installer_failed' }; }
      
      if (onProgress) { try { onProgress({ stage: 'update', message: '正在启动安装程序...', isAuto }); } catch (e) {} }
      
      try {
        if (process.platform === 'win32') {
          const quotedPath = `"${tmpFile}"`;
          exec(`start "" ${quotedPath}`, { detached: true }, () => {});
          setTimeout(() => app.quit(), 1000);
        } else {
          await shell.openPath(tmpFile);
          setTimeout(() => app.quit(), 1000);
        }
      } catch (e) {
        _isAutoUpdating = false;
        return { ok: false, error: 'open_installer_failed: ' + (e?.message || String(e)) };
      }
     
      return { ok: true, updated: true, version: remote, type: 'installer' };
    }
  } catch (e) {
    _isAutoUpdating = false;
    return { ok: false, error: e?.message || String(e) };
  }
}

module.exports = { checkAndUpdate, isAutoUpdating, getCurrentUpdateInfo };
