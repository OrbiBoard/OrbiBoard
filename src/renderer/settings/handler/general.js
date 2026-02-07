
// 通用设置：启动页与名言、基础设置
async function initGeneralSettings() {
  // 子夹（子页面）导航切换（限定在通用设置页面内）
  const subItems = document.querySelectorAll('#page-general .sub-item');
  const subpages = {
    appearance: document.getElementById('general-appearance'),
    splash: document.getElementById('general-splash'),
    basic: document.getElementById('general-basic'),
    time: document.getElementById('general-time'),
    data: document.getElementById('general-data')
  };
  subItems.forEach((btn) => {
    if (btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => {
      subItems.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const page = btn.dataset.sub;
      for (const key of Object.keys(subpages)) {
        subpages[key].hidden = key !== page;
      }
    });
  });
  // 默认显示“基础”子页
  for (const key of Object.keys(subpages)) subpages[key].hidden = key !== 'basic';
  subItems.forEach((b) => b.classList.toggle('active', b.dataset.sub === 'basic'));

  const defaults = {
    themeMode: 'system',
    themeColor: '#238f4a',
    quoteSource: 'engquote',
    quoteApiUrl: 'https://v1.hitokoto.cn/',
    localQuotes: [],
    splashEnabled: true,
    splashQuoteEnabled: false,
    splashBgStyle: 'black',
    splashProgramName: 'OrbiBoard',
    splashProgramDesc: '插件化大屏课堂辅助工具',
    autoUpdateEnabled: true,
    autoUpdatePluginsEnabled: true,
    showUpdateNotification: true,
    autostartEnabled: false,
    autostartHigh: false,
    preciseTimeEnabled: false,
    ntpServer: 'ntp.aliyun.com',
    timeOffset: 0,
    autoOffsetDaily: 0,
    offsetBaseDate: new Date().toISOString().slice(0, 10),
    semesterStart: new Date().toISOString().slice(0, 10),
    biweekOffset: false,
    marketApiBase: 'https://orbiboard.3r60.top/',
    timeZone: 'Asia/Shanghai'
  };
  await window.settingsAPI?.configEnsureDefaults('system', defaults);
  const cfg = await window.settingsAPI?.configGetAll('system');

  // 主题设置逻辑
  const themeModeRadios = document.querySelectorAll('input[name="themeMode"]');
  const colorPickerContainer = document.getElementById('theme-color-picker');
  const customColorInput = document.getElementById('theme-color-custom');
  
  // 预设颜色列表
  const presetColors = ['#238f4a', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#ef4444', '#14b8a6', '#6366f1'];
  
  // 颜色工具函数
  const colorUtils = {
    hexToRgb: (hex) => {
      const bigint = parseInt(hex.slice(1), 16);
      return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
    },
    rgbToHex: (r, g, b) => {
      return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    },
    rgbToHsl: (r, g, b) => {
      r /= 255; g /= 255; b /= 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h, s, l = (max + min) / 2;
      if (max === min) h = s = 0;
      else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
      }
      return [h, s, l];
    },
    hslToRgb: (h, s, l) => {
      let r, g, b;
      if (s === 0) r = g = b = l;
      else {
        const hue2rgb = (p, q, t) => {
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1/6) return p + (q - p) * 6 * t;
          if (t < 1/2) return q;
          if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
          return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
      }
      return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    },
    adjustBrightness: (hex, mode) => {
      const [r, g, b] = colorUtils.hexToRgb(hex);
      const [h, s, l] = colorUtils.rgbToHsl(r, g, b);
      let newL = l;
      // Dark模式：避免过暗 (仅在极暗 < 0.25 时微调，保留更多差异)
      if (mode === 'dark' && l < 0.25) newL = 0.25 + (l * 0.1); 
      // Light模式：避免过亮 (仅在极亮 > 0.85 时微压，防止看不清)
      if (mode === 'light' && l > 0.85) newL = 0.85 - ((1 - l) * 0.1);
      
      if (newL === l) return hex;
      const [nr, ng, nb] = colorUtils.hslToRgb(h, s, newL);
      return colorUtils.rgbToHex(nr, ng, nb);
    },
    // 计算颜色差异 (欧氏距离)
    colorDiff: (hex1, hex2) => {
      const [r1, g1, b1] = colorUtils.hexToRgb(hex1);
      const [r2, g2, b2] = colorUtils.hexToRgb(hex2);
      return Math.sqrt(Math.pow(r1 - r2, 2) + Math.pow(g1 - g2, 2) + Math.pow(b1 - b2, 2));
    }
  };

  // 提取图片主色调
  const extractColors = async (url) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const max = 200;
          let w = img.width;
          let h = img.height;
          if (w > max || h > max) {
            if (w > h) { h = Math.round(h * max / w); w = max; }
            else { w = Math.round(w * max / h); h = max; }
          }
          canvas.width = w;
          canvas.height = h;
          ctx.drawImage(img, 0, 0, w, h);
          const data = ctx.getImageData(0, 0, w, h).data;
          const colorCounts = {};
          const quantization = 24;
          for (let i = 0; i < data.length; i += 16) {
            const r = Math.floor(data[i] / quantization) * quantization;
            const g = Math.floor(data[i + 1] / quantization) * quantization;
            const b = Math.floor(data[i + 2] / quantization) * quantization;
            if (data[i + 3] < 128) continue;
            const key = `${r},${g},${b}`;
            colorCounts[key] = (colorCounts[key] || 0) + 1;
          }
          
          // 获取当前实际模式
          let mode = document.querySelector('input[name="themeMode"]:checked')?.value || 'system';
          if (mode === 'system') {
            mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
          }

          const sortedEntries = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]);
          const resultColors = [];
          const minDiff = 40; // 最小差异阈值

          for (const [key] of sortedEntries) {
            if (resultColors.length >= 5) break;
            const [r, g, b] = key.split(',').map(Number);
            const rawHex = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
            const adjustedHex = colorUtils.adjustBrightness(rawHex, mode);
            
            // 检查重复（与已选颜色的差异是否足够大）
            let isDistinct = true;
            for (const existing of resultColors) {
              if (colorUtils.colorDiff(adjustedHex, existing) < minDiff) {
                isDistinct = false;
                break;
              }
            }
            if (isDistinct) {
              resultColors.push(adjustedHex);
            }
          }

          resolve(resultColors);
        } catch (e) { reject(e); }
      };
      img.onerror = () => reject(new Error('Load image failed'));
      img.src = url;
    });
  };

  // 渲染取色器
  const renderColorPicker = (selectedColor, useColors = null) => {
    if (!colorPickerContainer) return;
    colorPickerContainer.innerHTML = '';
    
    const colors = useColors || presetColors;

    // 如果是壁纸取色模式，添加返回按钮
    if (useColors) {
      const backBtn = document.createElement('div');
      backBtn.className = 'color-dot custom';
      backBtn.innerHTML = '<i class="ri-arrow-left-line"></i>';
      backBtn.title = '返回预设';
      backBtn.onclick = () => renderColorPicker(selectedColor);
      colorPickerContainer.appendChild(backBtn);
    }
    
    // 颜色按钮
    colors.forEach(c => {
      const btn = document.createElement('div');
      btn.className = 'color-dot';
      btn.style.backgroundColor = c;
      if (c.toLowerCase() === selectedColor.toLowerCase()) btn.classList.add('selected');
      btn.onclick = async () => {
        document.querySelectorAll('.color-dot.selected').forEach(d => d.classList.remove('selected'));
        btn.classList.add('selected');
        
        await window.settingsAPI?.configSet('system', 'themeColor', c);
        if (window._currentThemeConfig) window._currentThemeConfig.color = c;
        const mode = document.querySelector('input[name="themeMode"]:checked')?.value || 'system';
        window.applyTheme?.(mode, c);
      };
      colorPickerContainer.appendChild(btn);
    });

    if (!useColors) {
      // 壁纸取色按钮
      const wpBtn = document.createElement('div');
      wpBtn.className = 'color-dot custom wp-picker';
      wpBtn.innerHTML = '<i class="ri-image-2-line"></i>';
      wpBtn.title = '从壁纸取色';
      wpBtn.onclick = async () => {
        if (wpBtn.classList.contains('loading')) return;
        const originHtml = wpBtn.innerHTML;
        wpBtn.classList.add('loading');
        wpBtn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i>';
        try {
          const path = await window.settingsAPI.getWallpaper();
          if (!path) throw new Error('未找到壁纸');
          const url = 'file://' + path.replace(/\\/g, '/');
          const extracted = await extractColors(url);
          if (!extracted || !extracted.length) throw new Error('未提取到颜色');
          renderColorPicker(selectedColor, extracted);
        } catch (e) {
          console.error(e);
          alert('取色失败：' + (e.message || '未知错误'));
          wpBtn.innerHTML = originHtml;
          wpBtn.classList.remove('loading');
        }
      };
      colorPickerContainer.appendChild(wpBtn);

      // 自定义颜色按钮（+号或色轮）
      const customBtn = document.createElement('div');
      customBtn.className = 'color-dot custom';
      customBtn.innerHTML = '<i class="ri-add-line"></i>';
      // 检查是否是预设之外的颜色
      const isCustom = !presetColors.includes(selectedColor);
      if (isCustom) {
        customBtn.classList.add('selected');
        customBtn.style.backgroundColor = selectedColor;
        customBtn.innerHTML = ''; 
      }
      
      customBtn.onclick = () => {
        customColorInput.click();
      };
      colorPickerContainer.appendChild(customBtn);
    }
  };

  // 初始化 UI 状态
  const currentMode = cfg.themeMode || 'system';
  themeModeRadios.forEach(r => {
    if (r.value === currentMode) r.checked = true;
    r.addEventListener('change', async () => {
      if (r.checked) {
        await window.settingsAPI?.configSet('system', 'themeMode', r.value);
        if (window._currentThemeConfig) window._currentThemeConfig.mode = r.value;
        // 获取最新的主题色配置，确保切换模式时颜色不变
        const currentColor = window._currentThemeConfig?.color || cfg.themeColor || '#238f4a';
        window.applyTheme?.(r.value, currentColor);
      }
    });
  });
  
  if (customColorInput) {
    customColorInput.value = cfg.themeColor || '#238f4a';
    customColorInput.addEventListener('change', async () => {
      const val = customColorInput.value;
      cfg.themeColor = val; // 更新本地缓存
      if (window._currentThemeConfig) window._currentThemeConfig.color = val;
      await window.settingsAPI?.configSet('system', 'themeColor', val);
      // 仅更新UI选中状态，不全量重绘
      const mode = document.querySelector('input[name="themeMode"]:checked')?.value || 'system';
      window.applyTheme?.(mode, val);
      // 更新预设按钮选中态
      document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('selected'));
      const customBtn = document.querySelector('.color-dot.custom');
      if (customBtn) {
        customBtn.classList.add('selected');
        customBtn.style.backgroundColor = val;
        customBtn.innerHTML = '';
      }
    });
  }
  
  // 初始渲染 UI (不重复调用 applyTheme，因为已全局初始化)
  const initColor = cfg.themeColor || '#238f4a';
  renderColorPicker(initColor);
  
  // 启动页与名言相关控件
  const splashEnabled = document.getElementById('splash-enabled');
  const splashQuoteEnabled = document.getElementById('splash-quote-enabled');
  const quoteSourceGroup = document.getElementById('quote-source-group');
  splashEnabled.checked = !!cfg.splashEnabled;
  splashQuoteEnabled.checked = !!cfg.splashQuoteEnabled;
  splashEnabled.addEventListener('change', async () => {
    await window.settingsAPI?.configSet('system', 'splashEnabled', !!splashEnabled.checked);
    updateSplashPreview();
  });
  // 初始化来源分组显隐
  if (quoteSourceGroup) quoteSourceGroup.hidden = !cfg.splashQuoteEnabled;
  splashQuoteEnabled.addEventListener('change', async () => {
    const enabled = !!splashQuoteEnabled.checked;
    await window.settingsAPI?.configSet('system', 'splashQuoteEnabled', enabled);
    if (quoteSourceGroup) quoteSourceGroup.hidden = !enabled;
    updateSplashPreview();
  });

  const radios = document.querySelectorAll('input[name="quoteSource"]');
  const fieldApi = document.getElementById('field-api');
  const fieldLocal = document.getElementById('field-local');
  const apiUrl = document.getElementById('api-url');
  const apiTest = document.getElementById('api-test');
  const apiSample = document.getElementById('api-sample');
  const openArrayEditor = document.getElementById('open-array-editor');

  const getSelectedSource = () => document.querySelector('input[name="quoteSource"]:checked')?.value || (cfg.quoteSource || 'engquote');

  radios.forEach((r) => { r.checked = r.value === (cfg.quoteSource || 'engquote'); });
  apiUrl.value = cfg.quoteApiUrl || 'https://v1.hitokoto.cn/';
  const switchSource = (val) => {
    fieldApi.hidden = val !== 'custom';
    fieldLocal.hidden = val !== 'local';
    apiUrl.disabled = val !== 'custom';
    apiTest.disabled = val !== 'custom';
    apiSample.textContent = '';
  };
  switchSource(cfg.quoteSource || 'engquote');

  radios.forEach((r) => {
    r.addEventListener('change', async () => {
      if (!r.checked) return;
      await window.settingsAPI?.configSet('system', 'quoteSource', r.value);
      switchSource(r.value);
      // 预览仅展示基础文案，不实时拉取API
      updateSplashPreview();
    });
  });

  apiUrl.addEventListener('change', async () => {
    await window.settingsAPI?.configSet('system', 'quoteApiUrl', apiUrl.value.trim());
  });

  apiTest.addEventListener('click', async () => {
    const source = getSelectedSource();
    if (source !== 'custom') {
      apiSample.textContent = '仅在“自定义地址”模式下可测试。';
      return;
    }
    const url = apiUrl.value.trim() || 'https://v1.hitokoto.cn/';
    try {
      const resp = await fetch(url);
      const data = await resp.json();
      const txt = (data && typeof data === 'object')
        ? (data.hitokoto ? `「${data.hitokoto}」—— ${data.from || ''}`
          : (data.text ? `「${data.text}」—— ${data.from || ''}`
            : JSON.stringify(data)))
        : String(data);
      apiSample.textContent = txt;
    } catch (e) {
      apiSample.textContent = '获取失败，请检查API地址或网络。';
    }
  });

  openArrayEditor.addEventListener('click', async () => {
    const modal = document.getElementById('array-modal');
    const listEl = document.getElementById('array-list');
    const addBtn = document.getElementById('array-add');
    const importInput = document.getElementById('array-import');
    const saveBtn = document.getElementById('array-save');
    const cancelBtn = document.getElementById('array-cancel');

    const renderItems = (items) => {
      listEl.innerHTML = '';
      items.forEach((val, idx) => {
        const row = document.createElement('div');
        row.className = 'array-item';
        // 文本列
        const inputText = document.createElement('input');
        inputText.type = 'text';
        inputText.placeholder = '文本';
        inputText.value = typeof val === 'string' ? val : (val?.text || '');
        inputText.addEventListener('change', () => {
          const current = items[idx];
          items[idx] = typeof current === 'object' ? { ...current, text: inputText.value } : { text: inputText.value, from: '' };
        });
        // 来源列
        const inputFrom = document.createElement('input');
        inputFrom.type = 'text';
        inputFrom.placeholder = '来源';
        inputFrom.value = typeof val === 'object' ? (val?.from || '') : '';
        inputFrom.addEventListener('change', () => {
          const current = items[idx];
          items[idx] = typeof current === 'object' ? { ...current, from: inputFrom.value } : { text: inputText.value, from: inputFrom.value };
        });
        const del = document.createElement('button');
        del.innerHTML = '<i class="ri-delete-bin-line"></i> 删除';
        del.addEventListener('click', () => { items.splice(idx, 1); renderItems(items); });
        row.appendChild(inputText);
        row.appendChild(inputFrom);
        row.appendChild(del);
        listEl.appendChild(row);
      });
    };

    // 每次打开从配置读取最新值，避免保存后无效的问题
    const latest = await window.settingsAPI?.configGet('system', 'localQuotes');
    let items = Array.isArray(latest) ? [...latest] : [];
    renderItems(items);

    addBtn.onclick = () => { items.push({ text: '', from: '' }); renderItems(items); };
    importInput.onchange = () => {
      const file = importInput.files && importInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result || '');
        const lines = text.split(/\r?\n/).map((s) => s.trim()).filter((s) => s.length);
        items = lines.map((line) => {
          const parts = line.split(/[\|\t]/);
          const t = (parts[0] || '').trim();
          const f = (parts[1] || '').trim();
          return { text: t, from: f };
        });
        renderItems(items);
      };
      reader.readAsText(file, 'utf-8');
    };
    saveBtn.onclick = async () => {
      await window.settingsAPI?.configSet('system', 'localQuotes', items);
      // 更新内存中的cfg以便再次打开时显示最新
      cfg.localQuotes = items;
      modal.hidden = true;
    };
    cancelBtn.onclick = () => { modal.hidden = true; };

    modal.hidden = false;
  });

  // 启动页样式：背景风格（单选按钮组）、程序名称与描述 + 内嵌预览
  const splashBgStyleRadios = Array.from(document.querySelectorAll('input[name="splashBgStyle"]'));
  const splashProgramName = document.getElementById('splash-program-name');
  const splashProgramDesc = document.getElementById('splash-program-desc');
  const splashPreviewFrame = document.getElementById('splash-preview-frame');

  // 初始化背景风格选中状态
  const initStyle = String(cfg.splashBgStyle || 'black');
  if (splashBgStyleRadios && splashBgStyleRadios.length) {
    let matched = false;
    splashBgStyleRadios.forEach(r => {
      if (r.value === initStyle) { r.checked = true; matched = true; }
    });
    if (!matched) {
      const def = splashBgStyleRadios.find(r => r.value === 'black');
      if (def) def.checked = true;
    }
  }
  if (splashProgramName) splashProgramName.value = String(cfg.splashProgramName || 'OrbiBoard');
  if (splashProgramDesc) splashProgramDesc.value = String(cfg.splashProgramDesc || '插件化大屏课堂辅助工具');

  async function updateSplashPreview() {
    try {
      const frame = splashPreviewFrame;
      if (!frame || !frame.contentWindow || !frame.contentWindow.document) return;
      const doc = frame.contentWindow.document;
      const root = doc.documentElement; // <html>
      const body = doc.body;
      const brandTitle = doc.querySelector('.brand h1');
      const brandSub = doc.querySelector('.brand .subtitle');
      const quoteEl = doc.getElementById('quote');

      const name = splashProgramName?.value?.trim() || 'OrbiBoard';
      const desc = splashProgramDesc?.value?.trim() || '插件化大屏课堂辅助工具';
      const quoteEnabled = !!(document.getElementById('splash-quote-enabled')?.checked);
      const style = getSelectedBgStyle();

      if (brandTitle) brandTitle.textContent = name;
      if (brandSub) brandSub.textContent = desc;
      if (quoteEl) {
        quoteEl.style.display = quoteEnabled ? '' : 'none';
      }

      // 根据风格设置CSS变量与背景
      const setVars = (vars) => {
        Object.entries(vars || {}).forEach(([k, v]) => root.style.setProperty(k, v));
      };
      if (style === 'blue') {
        setVars({ '--bg': '#0b1733', '--fg': '#e6f0ff', '--muted': '#a8c0ff', '--accent': '#3b82f6', '--btn-primary': '#1d4ed8', '--btn-secondary': '#1e3a8a' });
        if (body) body.style.background = 'radial-gradient(900px 520px at 50% -200px, #0a1342, var(--bg))';
      } else if (style === 'black') {
        setVars({ '--bg': '#000000', '--fg': '#f0f0f0', '--muted': '#bdbdbd', '--accent': '#22c55e', '--btn-primary': '#374151', '--btn-secondary': '#1f2937' });
        if (body) body.style.background = 'var(--bg)';
      } else {
        // 默认沿用 splash.css 定义
        setVars({ '--bg': '#071a12', '--fg': '#d7f3e5', '--muted': '#9bd6b8', '--accent': '#22c55e', '--btn-primary': '#15803d', '--btn-secondary': '#14532d' });
        if (body) body.style.background = 'radial-gradient(900px 520px at 50% -200px, #0b2a1d, var(--bg))';
      }

      // 预览语句：根据当前来源设置请求并渲染（非阻塞）
      if (quoteEnabled) {
        try { renderPreviewQuoteFromSource(doc, name); } catch (e) {}
      }
    } catch (e) {
      // 静默预览错误
    }
  }

  if (splashPreviewFrame) {
    if (!window.__splashPreviewLoadBound__) {
      splashPreviewFrame.addEventListener('load', () => updateSplashPreview());
      window.__splashPreviewLoadBound__ = true;
    }
    // 如果 iframe 已经加载完成（用户直接进入该子页），也立即应用样式设定
    try {
      const ready = splashPreviewFrame.contentWindow?.document?.readyState;
      if (ready === 'interactive' || ready === 'complete') {
        updateSplashPreview();
      }
    } catch (e) {}
  }

  // 背景风格变更监听（单选按钮组）
  if (splashBgStyleRadios && splashBgStyleRadios.length) {
    splashBgStyleRadios.forEach(radio => {
      radio.addEventListener('change', async () => {
        const val = getSelectedBgStyle();
        await window.settingsAPI?.configSet('system', 'splashBgStyle', val);
        updateSplashPreview();
      });
    });
  }
  if (splashProgramName) {
    splashProgramName.addEventListener('change', async () => {
      await window.settingsAPI?.configSet('system', 'splashProgramName', splashProgramName.value.trim());
      updateSplashPreview();
    });
  }
  if (splashProgramDesc) {
    splashProgramDesc.addEventListener('change', async () => {
      await window.settingsAPI?.configSet('system', 'splashProgramDesc', splashProgramDesc.value.trim());
      updateSplashPreview();
    });
  }

  // 刷新语句按钮：强制重新获取并更新预览
  const splashRefreshBtn = document.getElementById('splash-refresh-quote');
  if (splashRefreshBtn) {
    splashRefreshBtn.addEventListener('click', async () => {
      const frame = splashPreviewFrame;
      if (!frame || !frame.contentWindow || !frame.contentWindow.document) return;
      const doc = frame.contentWindow.document;
      const name = splashProgramName?.value?.trim() || 'OrbiBoard';
      await renderPreviewQuoteFromSource(doc, name, true);
    });
  }

  // 实际获取语句并更新预览中的 quote 元素
  async function renderPreviewQuoteFromSource(doc, programName, force) {
    try {
      const quoteEnabled = !!(document.getElementById('splash-quote-enabled')?.checked);
      if (!quoteEnabled) return;
      const source = getSelectedSource();
      const quoteEl = doc.getElementById('quote');
      if (!quoteEl) return;
      if (source === 'hitokoto') {
        const url = 'https://v1.hitokoto.cn/';
        const resp = await fetch(url, { cache: 'no-store' });
        const data = await resp.json();
        const txt = `「${data.hitokoto}」—— ${data.from || ''}`;
        quoteEl.textContent = txt || `「正在启动…」—— ${programName}`;
      } else if (source === 'engquote') {
        const url = 'https://api.limeasy.cn/engquote/';
        const resp = await fetch(url, { cache: 'no-store' });
        const data = await resp.json();
        const en = String(data?.text || '');
        const cn = String(data?.chinese || '');
        const rawOrigin = String(data?.source || data?.subject || '').trim();
        const originNormalized = rawOrigin && rawOrigin.toLowerCase() !== 'null' ? rawOrigin : '';
        const typeNum = Number(data?.type || 0);
        const aiNote = typeNum === 1 ? '（英文为AI翻译）' : (typeNum === 2 ? '（中文为AI翻译）' : '');
        quoteEl.innerHTML = `
          <div class="quote-en">「${en}」</div>
          ${cn ? `<div class="quote-cn">【译】${cn}</div>` : ''}
          ${aiNote ? `<div class="quote-note">${aiNote}</div>` : ''}
          ${originNormalized ? `<div class="quote-origin">${originNormalized}</div>` : ''}
        `;
      } else if (source === 'custom') {
        const url = (apiUrl?.value?.trim()) || 'https://v1.hitokoto.cn/';
        const resp = await fetch(url, { cache: 'no-store' });
        let txt = '';
        try {
          const data = await resp.json();
          if (data && typeof data === 'object') {
            if (data.hitokoto) txt = `「${data.hitokoto}」—— ${data.from || ''}`;
            else if (data.text) txt = `「${data.text}」—— ${data.from || ''}`;
            else txt = JSON.stringify(data);
          } else {
            txt = String(data);
          }
        } catch (e) {
          txt = await resp.text();
        }
        quoteEl.textContent = txt || `「正在启动…」—— ${programName}`;
      } else {
        const list = Array.isArray(cfg.localQuotes) ? cfg.localQuotes : [];
        const pick = list.length ? list[Math.floor(Math.random() * list.length)] : { text: '', from: '' };
        const txt = typeof pick === 'string' ? pick : `「${pick.text || ''}」—— ${pick.from || ''}`;
        quoteEl.textContent = txt || `「正在启动…」—— ${programName}`;
      }
    } catch (e) {
      const quoteEl = doc.getElementById('quote');
      if (quoteEl) quoteEl.textContent = `「正在启动…」—— ${programName}`;
    }
  }

  // 获取当前选中的背景风格（单选按钮组）
  function getSelectedBgStyle() {
    const radios = splashBgStyleRadios || [];
    for (const r of radios) { if (r.checked) return r.value || 'black'; }
    return 'black';
  }

  // 基础设置：自启动、精确时间与偏移
  const autostartEnabled = document.getElementById('autostart-enabled');
  const autoUpdateEnabled = document.getElementById('auto-update-enabled');
  const autoUpdatePluginsEnabled = document.getElementById('auto-update-plugins-enabled');
  const showUpdateNotification = document.getElementById('show-update-notification');
  const autostartHigh = document.getElementById('autostart-high');
  const preciseTime = document.getElementById('precise-time');
  const semesterStart = document.getElementById('semester-start');
  const biweekOffset = document.getElementById('biweek-offset');
  const timeOffset = document.getElementById('time-offset');
  const autoOffsetDaily = document.getElementById('auto-offset-daily');
  const currentTimeSummary = document.getElementById('current-time-summary');
  const currentOffsetSummary = document.getElementById('current-offset-summary');
  const currentSemesterSummary = document.getElementById('current-semester-summary');

  autostartEnabled.checked = !!cfg.autostartEnabled;
  autoUpdateEnabled.checked = cfg.autoUpdateEnabled !== false;
  if (autoUpdatePluginsEnabled) autoUpdatePluginsEnabled.checked = cfg.autoUpdatePluginsEnabled !== false;
  if (showUpdateNotification) showUpdateNotification.checked = cfg.showUpdateNotification !== false;
  autostartHigh.checked = !!cfg.autostartHigh;
  preciseTime.checked = !!cfg.preciseTimeEnabled;
  semesterStart.value = String(cfg.semesterStart || cfg.offsetBaseDate || new Date().toISOString().slice(0, 10));
  if (biweekOffset) biweekOffset.checked = !!cfg.biweekOffset;
  timeOffset.value = Number(cfg.timeOffset || 0);
  autoOffsetDaily.value = Number(cfg.autoOffsetDaily || 0);

  // 时间与日期：实时展示与计算逻辑
  const tzInput = document.getElementById('time-zone');
  if (tzInput) {
    tzInput.value = String(cfg.timeZone || 'Asia/Shanghai');
    tzInput.addEventListener('change', async () => {
      const val = String(tzInput.value || '').trim() || 'Asia/Shanghai';
      await window.settingsAPI?.configSet('system', 'timeZone', val);
      cfg.timeZone = val;
      updateTimeSummaries();
    });
  }

  const formatDateTime = (d) => {
    try {
      const tz = String(cfg.timeZone || 'Asia/Shanghai');
      const parts = new Intl.DateTimeFormat('zh-CN', {
        timeZone: tz,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).formatToParts(d);
      const get = (t) => parts.find(p => p.type === t)?.value || '';
      const y = get('year');
      const m = get('month');
      const day = get('day');
      const hh = get('hour');
      const mm = get('minute');
      const ss = get('second');
      return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
    } catch (e) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      const ss = String(d.getSeconds()).padStart(2, '0');
      return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
    }
  };
  // 使用统一接口从主进程获取当前时间与偏移（preciseTime/NTP/每日偏移均已应用）
  const updateTimeSummaries = async () => {
    try {
      const info = await window.settingsAPI?.getCurrentTime?.(); // { nowMs, iso, offsetSec, daysFromBase }
      const adj = new Date(Number(info?.nowMs || Date.now()));
      const total = Number(info?.offsetSec || 0);
      const days = Number(info?.daysFromBase || 0);
      const weekIndex = Math.floor(days / 7) + 1; // 周序号：从1开始
      let isEven = Math.floor(days / 7) % 2 === 0; // 第0周视为双周
      if (biweekOffset?.checked) isEven = !isEven;
      const parity = isEven ? '双周' : '单周';
      if (currentTimeSummary) currentTimeSummary.textContent = formatDateTime(adj);
      if (currentOffsetSummary) currentOffsetSummary.textContent = `偏移 ${total >= 0 ? '+' : ''}${total}s`;
      if (currentSemesterSummary) currentSemesterSummary.textContent = `第 ${weekIndex} 周（${parity}），已开学 ${days} 天`;
    } catch (e) {
      const now = new Date();
      if (currentTimeSummary) currentTimeSummary.textContent = formatDateTime(now);
      if (currentOffsetSummary) currentOffsetSummary.textContent = '偏移 —';
      if (currentSemesterSummary) currentSemesterSummary.textContent = '—';
    }
  };
  // 初始化与定时刷新（避免重复定时器）
  try { if (window.__timeSummaryTimer__) { clearInterval(window.__timeSummaryTimer__); } } catch (e) {}
  updateTimeSummaries();
  window.__timeSummaryTimer__ = setInterval(updateTimeSummaries, 1000);

  // NTP服务器地址绑定
  const ntpServer = document.getElementById('ntp-server');
  if (ntpServer) {
    ntpServer.value = String(cfg.ntpServer || 'ntp.aliyun.com');
    ntpServer.addEventListener('change', async () => {
      const val = String(ntpServer.value || '').trim() || 'ntp.aliyun.com';
      await window.settingsAPI?.configSet('system', 'ntpServer', val);
    });
  }

  // 在线服务地址绑定与测试
  const marketApiUrl = document.getElementById('market-api-url');
  const marketApiTest = document.getElementById('market-api-test');
  const marketApiSample = document.getElementById('market-api-sample');
  if (marketApiUrl) {
    marketApiUrl.value = String(cfg.serviceBase || cfg.marketApiBase || 'https://orbiboard.3r60.top/');
    marketApiUrl.addEventListener('change', async () => {
      const val = String(marketApiUrl.value || '').trim() || 'https://orbiboard.3r60.top/';
      await window.settingsAPI?.configSet('system', 'serviceBase', val);
    });
  }
  if (marketApiTest) {
    marketApiTest.addEventListener('click', async () => {
      const base = String(marketApiUrl?.value || '').trim() || 'https://orbiboard.3r60.top/';
      try {
        const url = new URL('/api/market/catalog', base).toString();
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('failed');
        const data = await resp.json();
        const count = (Array.isArray(data.plugins) ? data.plugins.length : 0)
          + (Array.isArray(data.automation) ? data.automation.length : 0)
          + (Array.isArray(data.components) ? data.components.length : 0);
        marketApiSample.textContent = `连接成功，可用条目共 ${count} 个`;
      } catch (e) {
        marketApiSample.textContent = '连接失败，请检查地址或服务是否启动。';
      }
    });
  }

  // 清理用户数据：提示确认后调用主进程删除用户数据目录
  const cleanupBtn = document.getElementById('cleanup-user-data');
  if (cleanupBtn && cleanupBtn.dataset.bound !== '1') {
    cleanupBtn.dataset.bound = '1';
    cleanupBtn.addEventListener('click', async () => {
      const confirmed = window.confirm('确认删除所有插件与配置等用户数据？此操作不可恢复。');
      if (!confirmed) return;
      const res = await window.settingsAPI?.cleanupUserData?.();
      if (res?.ok) {
        try { await refreshUserDataSize(); } catch (e) {}
        alert('已清理用户数据。您现在可以从系统中卸载应用。');
      } else {
        alert('清理失败：' + (res?.error || '未知错误'));
      }
    });
  }

  autostartEnabled.addEventListener('change', async () => {
    await window.settingsAPI?.configSet('system', 'autostartEnabled', !!autostartEnabled.checked);
    await window.settingsAPI?.setAutostart?.(!!autostartEnabled.checked, !!autostartHigh.checked);
  });
  autoUpdateEnabled.addEventListener('change', async () => {
    await window.settingsAPI?.configSet('system', 'autoUpdateEnabled', !!autoUpdateEnabled.checked);
  });
  if (autoUpdatePluginsEnabled) {
    autoUpdatePluginsEnabled.addEventListener('change', async () => {
      await window.settingsAPI?.configSet('system', 'autoUpdatePluginsEnabled', !!autoUpdatePluginsEnabled.checked);
    });
  }
  if (showUpdateNotification) {
    showUpdateNotification.addEventListener('change', async () => {
      await window.settingsAPI?.configSet('system', 'showUpdateNotification', !!showUpdateNotification.checked);
    });
  }
  autostartHigh.addEventListener('change', async () => {
    await window.settingsAPI?.configSet('system', 'autostartHigh', !!autostartHigh.checked);
    await window.settingsAPI?.setAutostart?.(!!autostartEnabled.checked, !!autostartHigh.checked);
  });
  preciseTime.addEventListener('change', async () => {
    await window.settingsAPI?.configSet('system', 'preciseTimeEnabled', !!preciseTime.checked);
  });
  semesterStart.addEventListener('change', async () => {
    const val = String(semesterStart.value || '').slice(0, 10);
    await window.settingsAPI?.configSet('system', 'semesterStart', val);
    updateTimeSummaries();
  });
  if (biweekOffset) {
    biweekOffset.addEventListener('change', async () => {
      await window.settingsAPI?.configSet('system', 'biweekOffset', !!biweekOffset.checked);
      updateTimeSummaries();
    });
  }
  timeOffset.addEventListener('change', async () => {
    const val = Number(timeOffset.value || 0);
    await window.settingsAPI?.configSet('system', 'timeOffset', val);
    updateTimeSummaries();
  });
  autoOffsetDaily.addEventListener('change', async () => {
    const val = Number(autoOffsetDaily.value || 0);
    await window.settingsAPI?.configSet('system', 'autoOffsetDaily', val);
    updateTimeSummaries();
  });

  // 数据目录：显示当前路径并绑定打开/更改
  const userDataPathEl = document.getElementById('user-data-path');
  const openUserDataBtn = document.getElementById('open-user-data');
  const changeUserDataBtn = document.getElementById('change-user-data');
  const userDataSizeEl = document.getElementById('user-data-size');
  const formatBytes = (num) => {
    const n = Number(num || 0);
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0; let v = n;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
    return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${units[i]}`;
  };
  const refreshUserDataSize = async () => {
    if (!userDataSizeEl) return;
    try {
      const res = await window.settingsAPI?.getUserDataSize?.();
      const bytes = (res && typeof res === 'object') ? Number(res.bytes || 0) : Number(res || 0);
      userDataSizeEl.textContent = formatBytes(bytes);
    } catch (e) { userDataSizeEl.textContent = '—'; }
  };
  if (userDataPathEl && window.settingsAPI?.getUserDataPath) {
    try {
      const p = await window.settingsAPI.getUserDataPath();
      userDataPathEl.textContent = String(p || '');
    } catch (e) {}
  }
  // 初始化数据目录大小（延后到空闲阶段，避免点击卡顿）
  try {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(() => { try { refreshUserDataSize(); } catch (e) {} }, { timeout: 1000 });
    } else {
      setTimeout(() => { try { refreshUserDataSize(); } catch (e) {} }, 0);
    }
  } catch (e) { refreshUserDataSize(); }
  if (openUserDataBtn && openUserDataBtn.dataset.bound !== '1') {
    openUserDataBtn.dataset.bound = '1';
    openUserDataBtn.addEventListener('click', async () => {
      try { await window.settingsAPI?.openUserData?.(); } catch (e) {}
    });
  }
  if (changeUserDataBtn && changeUserDataBtn.dataset.bound !== '1') {
    changeUserDataBtn.dataset.bound = '1';
    changeUserDataBtn.addEventListener('click', async () => {
      const res = await window.settingsAPI?.changeUserData?.();
      if (res?.ok) {
        const p = await window.settingsAPI?.getUserDataPath?.();
        if (userDataPathEl) userDataPathEl.textContent = String(p || '');
        await refreshUserDataSize();
        alert('已更改数据目录。重启应用后生效。');
      } else if (res && res.error) {
        alert('更改失败：' + res.error);
      }
    });
  }
  // 清理后刷新占用大小由上方绑定统一处理，避免重复绑定
}
