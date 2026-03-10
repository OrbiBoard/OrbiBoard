const { BrowserWindow, app } = require('electron');
const path = require('path');
const fs = require('fs');
const Registry = require('./Registry');

class PluginIconService {
  constructor() {
    this.iconCache = new Map();
    this.tempIconDir = null;
    this.iconWindow = null;
  }

  async init() {
    try {
      await this._ensureIconWindow();
      console.info('PluginIconService: icon window initialized');
    } catch (e) {
      console.error('PluginIconService: failed to init icon window:', e?.message || String(e));
    }
  }

  async _ensureIconWindow() {
    if (this.iconWindow && !this.iconWindow.isDestroyed()) {
      return this.iconWindow;
    }
    
    const size = 256;
    const rendererDir = path.join(__dirname, '../../../renderer');
    const remixCssPath = path.join(rendererDir, 'remixicon-local.css');
    let remixCss = '';
    try { remixCss = fs.readFileSync(remixCssPath, 'utf8'); } catch (e) {}
    const woffUrl = `file://${rendererDir.replace(/\\/g, '/')}/remixicon.woff2`;
    if (remixCss) {
      remixCss = remixCss.replace(/url\(\s*['"]?remixicon\.woff2['"]?\s*\)/g, `url('${woffUrl}')`);
    }
    const cssBlock = remixCss
      ? `<style>${remixCss}\nhtml,body{margin:0;padding:0;background:transparent;}</style>`
      : `<link rel=\"stylesheet\" href=\"file://${rendererDir.replace(/\\/g, '/')}/remixicon-local.css\" />\n<style>@font-face { font-family: 'remixicon'; src: url('${woffUrl}') format('woff2'); font-display: block; } html,body{margin:0;padding:0;background:transparent;}</style>`;
    const html = `<!DOCTYPE html><html><head>
      <meta charset=\"utf-8\" />
      ${cssBlock}
    </head><body></body></html>`;
    
    this.iconWindow = new BrowserWindow({ 
      show: false, 
      width: size, 
      height: size, 
      webPreferences: { offscreen: false , webSecurity: false } 
    });
    await this.iconWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    
    return this.iconWindow;
  }

  _getTempIconDir() {
    if (!this.tempIconDir) {
      this.tempIconDir = path.join(app.getPath('userData'), 'plugin-icons');
      if (!fs.existsSync(this.tempIconDir)) {
        fs.mkdirSync(this.tempIconDir, { recursive: true });
      }
    }
    return this.tempIconDir;
  }

  async ensurePluginIcon(pluginId, pluginInfo) {
    try {
      let iconPath;
      let iconName = 'ri-plug-line';
      let bgColor = '#262626';
      let fgColor = '#ffffff';
      
      if (pluginInfo) {
        iconName = pluginInfo.icon || iconName;
        bgColor = pluginInfo.iconBg || bgColor;
        fgColor = pluginInfo.iconFg || fgColor;
        
        if (pluginInfo.local) {
          const pluginDir = path.resolve(path.dirname(Registry.manifestPath), pluginInfo.local);
          iconPath = path.join(pluginDir, 'icon.ico');
        }
      }
      
      if (!iconPath) {
        iconPath = path.join(this._getTempIconDir(), `${pluginId}.ico`);
      }
      
      if (fs.existsSync(iconPath)) {
        return iconPath;
      }
      
      console.info('PluginIconService: generating icon', { pluginId, iconName, iconPath });
      
      const success = await this._generateRemixIconIco(iconName, iconPath, bgColor, fgColor);
      console.info('PluginIconService: icon generated', { success, iconPath });
      return success ? iconPath : null;
    } catch (e) {
      console.error('PluginIconService.ensurePluginIcon error:', e?.message || String(e), e?.stack || '');
      return null;
    }
  }

  async _generateRemixIconIco(iconClassName, icoPath, bgColor, fgColor) {
    try {
      const win = await this._ensureIconWindow();
      const js = `(() => new Promise(async (resolve) => {
        const size = 256;
        const bg = ${JSON.stringify(bgColor)};
        const fg = ${JSON.stringify(fgColor)};
        const icon = ${JSON.stringify(iconClassName)};
        const i = document.createElement('i');
        i.className = icon;
        i.style.fontFamily = 'remixicon';
        i.style.fontStyle = 'normal';
        i.style.fontWeight = 'normal';
        document.body.appendChild(i);
        try { await document.fonts.ready; } catch (e) {}
        function getCharFromComputed(el) {
          const content = getComputedStyle(el, '::before').content || '';
          const raw = String(content).replace(/^\\s*[\"\']|[\"\']\\s*$/g, '');
          if (/^\\\\[0-9a-fA-F]+$/.test(raw)) {
            const hex = raw.replace(/\\\\+/g, '');
            const code = parseInt(hex || '0', 16);
            return String.fromCharCode(code || 0);
          }
          return raw;
        }
        let ch = getCharFromComputed(i);
        for (let t = 0; t < 30 && (!ch || ch === 'none' || ch === '""' || ch === "''"); t++) {
          await new Promise(r => setTimeout(r, 50));
          ch = getCharFromComputed(i);
        }
        if (!ch || ch === '""' || ch === "''" || ch === 'none') {
          i.className = 'ri-flashlight-fill';
          ch = getCharFromComputed(i) || '';
        }
        const c = document.createElement('canvas'); c.width = size; c.height = size; document.body.appendChild(c);
        const ctx = c.getContext('2d');
        function roundRect(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
        ctx.fillStyle = bg; roundRect(0,0,size,size, Math.floor(size*0.18)); ctx.fill();
        ctx.fillStyle = fg;
        const fontSize = Math.floor(size*0.56);
        ctx.font = fontSize + 'px remixicon';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillText(ch || '', size/2, size/2);
        const data = c.toDataURL('image/png');
        resolve(data);
        c.remove();
        i.remove();
      }))()`;
      const dataUrl = await win.webContents.executeJavaScript(js, true);
      const pngBuf = Buffer.from(String(dataUrl || '').replace(/^data:image\/png;base64,/, ''), 'base64');
      if (!pngBuf?.length) return false;
      const icoBuf = this._pngToIco(pngBuf, 256);
      const dir = path.dirname(icoPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(icoPath, icoBuf);
      return true;
    } catch (e) {
      console.error('PluginIconService._generateRemixIconIco error:', e?.message || String(e));
      return false;
    }
  }

  _pngToIco(pngBuf, size) {
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(1, 4);
    const dir = Buffer.alloc(16);
    dir[0] = size >= 256 ? 0 : size;
    dir[1] = size >= 256 ? 0 : size;
    dir[2] = 0;
    dir[3] = 0;
    dir.writeUInt16LE(1, 4);
    dir.writeUInt16LE(32, 6);
    dir.writeUInt32LE(pngBuf.length, 8);
    dir.writeUInt32LE(6 + 16, 12);
    return Buffer.concat([header, dir, pngBuf]);
  }

  setTaskbarGroup(browserWindow, pluginId, pluginInfo) {
    if (process.platform !== 'win32') return { ok: false, error: 'windows_only' };
    if (!browserWindow || browserWindow.isDestroyed()) return { ok: false, error: 'window_invalid' };
    
    try {
      const appId = `com.orbiboard.plugin.${pluginId}`;
      const details = { appId };
      
      let iconPath = null;
      if (pluginInfo && pluginInfo.local) {
        const pluginDir = path.resolve(path.dirname(Registry.manifestPath), pluginInfo.local);
        iconPath = path.join(pluginDir, 'icon.ico');
      }
      if (!iconPath || !fs.existsSync(iconPath)) {
        iconPath = path.join(this._getTempIconDir(), `${pluginId}.ico`);
      }
      if (fs.existsSync(iconPath)) {
        details.appIconPath = iconPath;
      }
      
      if (pluginInfo && pluginInfo.name) {
        details.relaunchDisplayName = pluginInfo.name;
      }
      
      browserWindow.setAppDetails(details);
      return { ok: true, appId };
    } catch (e) {
      console.error('PluginIconService.setTaskbarGroup error:', e);
      return { ok: false, error: e.message };
    }
  }

  resetTaskbarGroup(browserWindow) {
    if (process.platform !== 'win32') return { ok: false, error: 'windows_only' };
    if (!browserWindow || browserWindow.isDestroyed()) return { ok: false, error: 'window_invalid' };
    
    try {
      const baseAppId = app.getAppUserModelId() || 'com.orbiboard';
      browserWindow.setAppDetails({ appId: baseAppId });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  clearPluginIcons() {
    const cleared = [];
    const manifest = Registry.manifest.plugins || [];
    for (const p of manifest) {
      if (p.local) {
        const pluginDir = path.resolve(path.dirname(Registry.manifestPath), p.local);
        const iconPath = path.join(pluginDir, 'icon.ico');
        if (fs.existsSync(iconPath)) {
          try {
            fs.unlinkSync(iconPath);
            cleared.push(iconPath);
          } catch (e) {}
        }
      }
    }
    if (this.tempIconDir && fs.existsSync(this.tempIconDir)) {
      try {
        const files = fs.readdirSync(this.tempIconDir);
        for (const f of files) {
          if (f.endsWith('.ico')) {
            const fp = path.join(this.tempIconDir, f);
            try {
              fs.unlinkSync(fp);
              cleared.push(fp);
            } catch (e) {}
          }
        }
      } catch (e) {}
    }
    return { ok: true, cleared, count: cleared.length };
  }
}

module.exports = new PluginIconService();
