async function main() {
  if (window.__settingsMainRan) return;
  window.__settingsMainRan = true;

  // 立即加载主题
  try { window.initTheme?.(); } catch (e) {}

  // 移除加载遮罩
  setTimeout(() => {
    const mask = document.getElementById('loading-mask');
    if (mask) {
      mask.classList.add('hidden');
      setTimeout(() => mask.remove(), 400); // 动画结束后移除 DOM
    }
  }, 1200); // 稍微延迟以展示动画效果

  // Alpha Banner Close Logic
  const alphaBanner = document.querySelector('.alpha-banner');
  const closeAlphaBtn = document.getElementById('close-alpha-banner');
  if (alphaBanner && closeAlphaBtn) {
    const isHidden = localStorage.getItem('hideAlphaBanner') === 'true';
    if (isHidden) {
      alphaBanner.style.display = 'none';
    } else {
      closeAlphaBtn.addEventListener('click', () => {
        alphaBanner.style.display = 'none';
        localStorage.setItem('hideAlphaBanner', 'true');
      });
    }
  }

  // 水印时间戳
  const tsEl = document.getElementById('build-timestamp');
  if (tsEl) {
    const updateTime = () => {
      const now = new Date();
      tsEl.textContent = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
    };
    updateTime(); // 立即执行一次
    setInterval(updateTime, 1000); // 每秒更新
  }

  // 获取开发环境标记
  let isDev = true;
  try {
    const info = await window.settingsAPI?.getAppInfo?.();
    isDev = !!info?.isDev;
  } catch (e) {}
  window.__isDev__ = isDev;

  // 左侧导航切换
  const navItems = document.querySelectorAll('.nav-item');
  const pages = {
    plugins: document.getElementById('page-plugins'),
    market: document.getElementById('page-market'),
    components: document.getElementById('page-components'),
    general: document.getElementById('page-general'),
    config: document.getElementById('page-config'),
    defaults: document.getElementById('page-defaults'),
    automation: document.getElementById('page-automation'),
    npm: document.getElementById('page-npm'),
    debug: document.getElementById('page-debug'),
    about: document.getElementById('page-about')
  };
  // 根据配置显示/隐藏调试页，并可默认进入运行管理
  try {
    const devMode = await window.settingsAPI?.configGet?.('system', 'developerMode');
    const debugBtn = Array.from(navItems).find(b => b.dataset.page === 'debug');
    if (debugBtn) {
      debugBtn.style.display = devMode ? '' : 'none';
      if (devMode) {
        // 默认进入调试页
        debugBtn.click();
      }
    }
  } catch (e) {}
  navItems.forEach((btn) => {
    btn.addEventListener('click', async () => {
      navItems.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const page = btn.dataset.page;
      for (const key of Object.keys(pages)) {
        pages[key].hidden = key !== page;
      }
      document.querySelectorAll('.no-fade-in').forEach(el => el.classList.remove('no-fade-in'));
      if (page === 'npm') {
        window.renderInstalled?.();
      } else if (page === 'general') {
        initGeneralSettings();
      } else if (page === 'config') {
        try { initConfigOverview(); } catch (e) {}
      } else if (page === 'automation') {
        initAutomationSettings();
      } else if (page === 'debug') {
        initDebugSettings();
      } else if (page === 'market') {
        initMarketPage();
      } else if (page === 'plugins') {
        try { await window.initPluginsPage?.(); } catch (e) {}
      } else if (page === 'components') {
        try { window.initComponentsPage?.(); } catch (e) {}
      } else if (page === 'defaults') {
        try { window.initDefaultsPage?.(); } catch (e) {}
      } else if (page === 'about') {
        initAboutPage();
      }
    });
  });

  // 已移除全局安装进度展示（global-progress）

  const navigateToPage = async (page) => {
    try {
      const btn = Array.from(navItems).find(b => b.dataset.page === page);
      navItems.forEach((b) => b.classList.remove('active'));
      if (btn) btn.classList.add('active');
      for (const key of Object.keys(pages)) {
        pages[key].hidden = key !== page;
      }

      const content = document.getElementById('content');
      if (content) content.classList.remove('scroll-mask-top', 'scroll-mask-bottom', 'scroll-mask-both');

      if (page === 'npm') {
    window.renderInstalled?.();
  } else if (page === 'general') {
    initGeneralSettings();
  } else if (page === 'config') {
    try { initConfigOverview(); } catch (e) {}
  } else if (page === 'automation') {
    initAutomationSettings();
  } else if (page === 'debug') {
    initDebugSettings();
  } else if (page === 'market') {
      initMarketPage();
    } else if (page === 'plugins') {
      try { await window.initPluginsPage?.(); } catch (e) {}
    } else if (page === 'components') {
      try { window.initComponentsPage?.(); } catch (e) {}
    } else if (page === 'defaults') {
      try { window.initDefaultsPage?.(); } catch (e) {}
    } else if (page === 'about') {
      initAboutPage();
    }
    } catch (e) {}
  };
  window.settingsAPI?.onNavigate?.((page) => { try { navigateToPage(page); } catch (e) {} });
  window.settingsAPI?.onOpenPluginInfo?.(async (pluginKey) => {
    try {
      await navigateToPage('plugins');
      const list = await fetchPlugins();
      const filtered = list.filter((p) => String(p.type || 'plugin').toLowerCase() === 'plugin' && Array.isArray(p.actions) && p.actions.length > 0);
      const item = filtered.find((p) => (p.id || p.name) === pluginKey);
      if (item) {
        showPluginAboutModal(item);
      } else {
        await showAlert(`未找到插件：${pluginKey}`);
      }
    } catch (e) {}
  });

  window.settingsAPI?.onOpenStoreItem?.(async (payload) => {
    try {
      await navigateToPage('market');
      const base = await getMarketBase();
      const catlog = await fetchMarket('/api/market/catalog');
      const type = String(payload?.type || 'plugin');
      const id = String(payload?.id || '').trim();
      const arr = type === 'automation' ? (catlog.automation || []) : (type === 'component' || type === 'components' ? (catlog.components || []) : (catlog.plugins || []));
      const item = arr.find((x) => String(x.id || x.name) === id);
      if (item) {
        showStorePluginModal(item);
      } else {
        await showAlert(`未找到：${id}`);
      }
    } catch (e) {}
  });

  window.settingsAPI?.onMarketInstall?.(async (payload) => {
    try {
      await navigateToPage('market');
      const catlog = await fetchMarket('/api/market/catalog');
      const type = String(payload?.type || 'plugin');
      const id = String(payload?.id || '').trim();
      const arr = type === 'automation' ? (catlog.automation || []) : (type === 'component' || type === 'components' ? (catlog.components || []) : (catlog.plugins || []));
      const item = arr.find((x) => String(x.id || x.name) === id);
      if (!item) { await showAlert(`未找到：${id}`); return; }
      
      const ok = await showConfirm(`检测到缺失插件/功能：${item.name || id}，是否查看详情并安装？`);
      if (ok) {
        showStorePluginModal(item);
      }
    } catch (e) {}
  });

  // 渲染插件列表
  const container = document.getElementById('plugins');
  try { await window.initPluginsPage?.(); } catch (e) {}

  // 打开设置页时检查缺失依赖并提示安装（避免占用启动时间）
  let depsPrompted = false;
  async function checkMissingDepsPrompt() {
    if (depsPrompted) return;
    depsPrompted = true;
    try {
      const all = await window.settingsAPI?.getPlugins?.();
      const enabledList = (all || []).filter(p => p.enabled);
      for (const p of enabledList) {
        const res = await window.settingsAPI?.pluginDepsStatus?.(p.id || p.name);
        const st = Array.isArray(res?.status) ? res.status : [];
        const missing = st.filter(s => !Array.isArray(s.installed) || s.installed.length === 0).map(s => s.name);
        if (missing.length) {
          const ok = await showConfirm(`插件 ${p.name} 缺少依赖：${missing.join('，')}，是否现在安装？`);
          if (!ok) continue;
          // 显示安装进度并绑定事件
          const progressModal = showProgressModal('安装依赖', `准备安装 ${p.name} 依赖...`);
          const handler = (payload) => {
            try {
              if (payload && String(payload.stage).toLowerCase() === 'npm') {
                progressModal.update(payload);
              }
            } catch (e) {}
          };
          let unsubscribe = null;
          try { unsubscribe = window.settingsAPI?.onProgress?.(handler); } catch (e) {}
          const ensure = await window.settingsAPI?.pluginEnsureDeps?.(p.id || p.name);
          try { unsubscribe && unsubscribe(); } catch (e) {}
          try { progressModal?.close?.(); } catch (e) {}
          if (ensure?.ok) {
            await showToast(`已安装 ${p.name} 依赖`);
          } else {
            await showAlert(`安装失败：${ensure?.error || '未知错误'}`);
          }
        }
      }
    } catch (e) {}
  }
  // 触发一次检查
  checkMissingDepsPrompt();

  // 自定义标题栏按钮
  document.querySelectorAll('.win-btn').forEach((b) => {
    b.addEventListener('click', () => {
      const act = b.dataset.act;
      if (act === 'menu') {
        try {
          const r = b.getBoundingClientRect();
          window.showAppMenu({ x: r.right - 180, y: r.bottom + 6 });
        } catch (e) {}
      } else {
        window.settingsAPI?.windowControl(act);
      }
    });
  });

  // 窗口图标点击菜单（模拟 Win32 窗口左上角行为）
  try {
    const winIcon = document.querySelector('.sidebar .logo');
    const logoNormal = winIcon?.querySelector('.logo-normal');
    const logoActive = winIcon?.querySelector('.logo-active');
    const closeBtn = winIcon?.querySelector('.close-win');
    const collapseBtn = winIcon?.querySelector('.collapse-menu');

    if (winIcon && logoNormal && logoActive) {
      let isMenuActive = false;

      // 打开菜单逻辑
      const openMenu = () => {
        if (isMenuActive) return;
        isMenuActive = true;
        
        // 切换 UI 状态
        winIcon.classList.add('active');
        logoNormal.hidden = true;
        logoActive.hidden = false;

        // 计算位置：直接位于 Logo 下方，且宽度对齐
        const r = winIcon.getBoundingClientRect();
        // 传递 onClose 回调
        window.showAppMenu({ x: 0, y: r.bottom }, () => {
          // 菜单关闭时的回调：恢复状态
          isMenuActive = false;
          winIcon.classList.remove('active');
          logoNormal.hidden = false;
          logoActive.hidden = true;
        }, 'logo-menu');
      };

      // 单击 Logo (Normal 状态) -> 打开菜单
      logoNormal.addEventListener('click', (e) => {
        e.stopPropagation();
        openMenu();
      });

      // 激活状态下的按钮事件
      closeBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        // 尝试关闭菜单（如果已打开）
        if (isMenuActive) {
            // 模拟点击遮罩层以关闭菜单
            document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        }
        // 执行关闭窗口
        window.settingsAPI?.windowControl('close');
      });

      collapseBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        // 模拟点击遮罩层以关闭菜单（因为 showAppMenu 绑定了 mousedown 关闭）
        document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      });

      // 设置鼠标手势
      winIcon.style.cursor = 'default'; // 容器默认
      logoNormal.style.cursor = 'pointer'; // 仅普通状态可点击
      winIcon.style.webkitAppRegion = 'no-drag';
    }
  } catch (e) {}

  try {
    const titlebar = document.querySelector('.titlebar');
    titlebar?.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      window.showAppMenu({ x: e.clientX, y: e.clientY });
    });
  } catch (e) {}

  // 标题栏版本显示与跳转关于
  try {
    const info = await window.settingsAPI?.getAppInfo?.();
    const v = info?.appVersion || '';
    const vEl = document.getElementById('title-version');
    if (vEl) vEl.textContent = v || '—';
    const pill = document.getElementById('title-version-pill');
    pill?.addEventListener('click', () => {
      const btn = Array.from(document.querySelectorAll('.nav-item')).find(b => b.dataset.page === 'about');
      if (btn) btn.click();
    });
    // 启动时检查是否有更新，若有则在版本 pill 显示“旧版本→新版本”，并高亮为绿色白字
    try {
      const res = await window.settingsAPI?.checkUpdate?.(true);
      if (res?.ok && res.hasUpdate) {
        if (vEl) vEl.textContent = `${res.currentVersion} → ${res.remoteVersion}`;
        if (pill) {
          pill.classList.add('primary');
          pill.style.background = 'var(--accent)';
          pill.style.color = '#ffffff';
        }
      }
    } catch (e) {}
  } catch (e) {}

  // 监听窗口状态变化，更新最大化按钮图标
  window.settingsAPI?.onWindowStateChanged?.((state) => {
    const isMax = !!state.maximized;
    const btns = document.querySelectorAll('.win-btn[data-act="maximize"]');
    btns.forEach(btn => {
      const icon = btn.querySelector('i');
      if (icon) icon.className = isMax ? 'ri-checkbox-multiple-blank-line' : 'ri-checkbox-blank-line';
      btn.title = isMax ? '还原' : '最大化';
    });
  });

  // 监听 #content 滚动以更新 Mask 样式
  const content = document.getElementById('content');
  if (content) {
    const updateContentScrollMask = () => {
      const isTop = content.scrollTop <= 0;
      const isBottom = content.scrollTop + content.clientHeight >= content.scrollHeight - 1; // 容差1px
      
      content.classList.remove('scroll-mask-top', 'scroll-mask-bottom', 'scroll-mask-both');

      if (content.scrollHeight > content.clientHeight) {
        if (isTop && !isBottom) content.classList.add('scroll-mask-bottom');
        else if (!isTop && isBottom) content.classList.add('scroll-mask-top');
        else if (!isTop && !isBottom) content.classList.add('scroll-mask-both');
      }
    };
    
    content.addEventListener('scroll', updateContentScrollMask);
    // 监听窗口大小变化
    window.addEventListener('resize', updateContentScrollMask);
    
    // 由于内容动态加载，使用 MutationObserver 监听子元素变化
    const observer = new MutationObserver(() => {
        // 稍微延迟以等待布局更新
        setTimeout(updateContentScrollMask, 50);
    });
    observer.observe(content, { childList: true, subtree: true });
    
    // 初始化检测
    setTimeout(updateContentScrollMask, 100);
  }

  // NPM 管理逻辑（仅展示已安装列表）
  const installedEl = document.getElementById('npm-installed');
  const versionsEl = document.getElementById('npm-versions');
  const searchInput = document.getElementById('npm-search-input');
  const searchBtn = document.getElementById('npm-search-btn');

  async function renderInstalled() {
    installedEl.innerHTML = '加载已安装模块...';
    const res = await window.settingsAPI?.npmListInstalled();
    if (!res?.ok) {
      installedEl.innerHTML = `<div class="panel">获取失败：${res?.error || '未知错误'}</div>`;
      return;
    }
    const { packages } = res;
    installedEl.innerHTML = '';
    packages.forEach((pkg) => {
      const div = document.createElement('div');
      div.className = 'pkg';
      div.innerHTML = `
        <div class="pkg-header">
          <div class="pkg-name"><i class="ri-box-3-line"></i> ${pkg.name}</div>
          <div class="count">${pkg.versions.length} 个版本</div>
          <div class="spacer"></div>
          <button class="btn danger small" data-act="delete">删除</button>
        </div>
        <div class="versions">${pkg.versions.map(v => `<span class="pill">v${v}</span>`).join(' ')}</div>
        <div class="pkg-actions" hidden></div>
      `;
      const delBtn = div.querySelector('button[data-act="delete"]');
      const actions = div.querySelector('.pkg-actions');
      delBtn.addEventListener('click', async () => {
        // 展示版本选择并检查占用
        const name = pkg.name;
        actions.hidden = false;
        actions.innerHTML = '正在加载占用信息...';
        const usesRes = await window.settingsAPI?.npmModuleUsers?.(name);
        const usedMap = new Map();
        if (usesRes?.ok && Array.isArray(usesRes.users)) {
          usesRes.users.forEach(u => {
            if (u.version) usedMap.set(String(u.version), (usedMap.get(String(u.version)) || 0) + 1);
          });
        }
        actions.innerHTML = `
          <div class="inline" style="gap:8px;align-items:center;margin-top:8px;">
            <span class="muted">选择要删除的版本：</span>
            ${pkg.versions.map(v => {
              const used = usedMap.has(String(v));
              const hint = used ? `（被${usedMap.get(String(v))}个插件占用）` : '';
              return `<label class="inline" style="gap:6px;">
                <input type="checkbox" name="ver" value="${v}" ${used ? 'disabled' : ''} />
                <span>v${v} ${hint}</span>
              </label>`;
            }).join(' ')}
            <div class="spacer"></div>
            <button class="btn secondary small" data-act="cancel">取消</button>
            <button class="btn danger small" data-act="confirm">确认删除</button>
          </div>
        `;
        const cancelBtn = actions.querySelector('button[data-act="cancel"]');
        const confirmBtn = actions.querySelector('button[data-act="confirm"]');
        cancelBtn.addEventListener('click', () => { actions.hidden = true; actions.innerHTML = ''; });
        confirmBtn.addEventListener('click', async () => {
          const selected = Array.from(actions.querySelectorAll('input[name="ver"]:checked')).map(i => i.value);
          if (!selected.length) { await showAlert('请至少选择一个可删除的版本'); return; }
          const rmRes = await window.settingsAPI?.npmRemove?.(name, selected);
          if (!rmRes?.ok) {
            await showAlert(`删除失败：${rmRes?.error || (rmRes?.errors?.[0]?.error) || '未知错误'}`);
            return;
          }
          if (rmRes.blocked?.length) {
            await showAlert(`以下版本当前被插件占用，未删除：${rmRes.blocked.join('，')}`);
          }
          if (rmRes.removed?.length) {
            await showToast(`已删除版本：${rmRes.removed.join('，')}`);
          }
          actions.hidden = true; actions.innerHTML = '';
          await renderInstalled();
        });
      });
      installedEl.appendChild(div);
    });
  }
  // 初次进入NPM页面时加载
  const activeNav = document.querySelector('.nav-item.active');
  if (activeNav?.dataset.page === 'npm') {
    renderInstalled();
  }

  // 版本搜索与下载
  async function renderVersions(name) {
    versionsEl.innerHTML = '';
    const res = await window.settingsAPI?.npmGetVersions?.(name);
    if (!res?.ok) {
      versionsEl.innerHTML = `<div class="panel">获取版本失败：${res?.error || '未知错误'}</div>`;
      return;
    }
    const { versions } = res;
    if (!Array.isArray(versions) || versions.length === 0) {
      versionsEl.innerHTML = `<div class="muted">未查询到版本</div>`;
      return;
    }
    versionsEl.innerHTML = `<div class="muted">找到 ${versions.length} 个版本，点击下载所需版本</div>`;
    const grid = document.createElement('div');
    grid.className = 'versions-grid';
    grid.style.display = 'flex';
    grid.style.flexWrap = 'wrap';
    grid.style.gap = '8px';
    versions.forEach(v => {
      const pill = document.createElement('button');
      pill.className = 'btn small';
      pill.textContent = `v${v}`;
      pill.addEventListener('click', async () => {
        const ok = await showConfirm(`下载 ${name}@${v} 吗？`);
        if (!ok) return;
        try {
          // 显示下载/安装进度模态框，并绑定进度事件
          const progressModal = showProgressModal('下载/安装进度', `准备下载 ${name}@${v} ...`);
          const handler = (payload) => {
            try {
              // 仅处理 npm 阶段，且信息包含当前包名与版本，避免串扰
              if (payload && String(payload.stage).toLowerCase() === 'npm') {
                const msg = String(payload.message || '');
                if (msg.includes(`${name}@${v}`) || msg.includes(name)) {
                  progressModal.update(payload);
                }
              }
            } catch (e) {}
          };
          const unsubscribe = window.settingsAPI?.onProgress?.(handler);
          const dl = await window.settingsAPI?.npmDownload?.(name, v);
          // 解绑进度并关闭模态框
          try { unsubscribe && unsubscribe(); } catch (e) {}
          try { progressModal?.close?.(); } catch (e) {}
          if (!dl?.ok) {
            await showAlert(`下载失败：${dl?.error || '未知错误'}`);
            return;
          }
          await showToast(`已下载 ${name}@${v}`);
          await renderInstalled();
        } catch (e) { await showAlert(`下载异常：${e?.message || String(e)}`); }
      });
      grid.appendChild(pill);
    });
    versionsEl.appendChild(grid);
  }
  if (searchBtn) {
    searchBtn.addEventListener('click', async () => {
      const name = searchInput?.value?.trim();
      if (!name) { await showAlert('请输入 NPM 包名'); return; }
      await renderVersions(name);
    });
  }

  

  // 拖拽安装ZIP
  const drop = document.getElementById('drop-install');
  // 安装确认由统一入口处理，不再直接使用本地模态框
  let pendingZipPath = null;
  let pendingZipData = null; // { name, data: Uint8Array }
  let pendingItemMeta = null; // 用于统一入口的依赖引导与展示
  ['dragenter','dragover'].forEach(evt => drop.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); drop.classList.add('dragover'); }));
  ['dragleave','drop'].forEach(evt => drop.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); drop.classList.remove('dragover'); }));
  drop.addEventListener('drop', async (e) => {
    const files = e.dataTransfer?.files || [];
    const file = files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.zip')) { showAlert('请拖入ZIP插件安装包'); return; }
    pendingZipPath = file.path || null;
    pendingZipData = null;
    if (!pendingZipPath) {
      // 回退：读取数据并通过IPC传输安装，避免路径不可用导致失败
      try {
        const buf = new Uint8Array(await file.arrayBuffer());
        pendingZipData = { name: file.name, data: buf };
      } catch (err) {
        await showAlert('读取文件失败，请重试或手动选择安装');
        return;
      }
    }
    // 安装前检查ZIP以展示依赖与安全提示，并记录元信息供统一入口使用
    try {
      let inspect = null;
      if (pendingZipPath) inspect = await window.settingsAPI?.inspectPluginZip?.(pendingZipPath);
      else inspect = await window.settingsAPI?.inspectPluginZipData?.(pendingZipData.name, pendingZipData.data);
      if (inspect?.ok) {
        const name = inspect.name || file.name.replace(/\.zip$/i, '');
        const author = (typeof inspect.author === 'object') ? (inspect.author?.name || JSON.stringify(inspect.author)) : (inspect.author || '未知作者');
        const pluginDepends = Array.isArray(inspect.dependencies) ? inspect.dependencies : [];
        const depsObj = (typeof inspect.npmDependencies === 'object' && !Array.isArray(inspect.npmDependencies) && inspect.npmDependencies) ? inspect.npmDependencies : null;
        const depNames = depsObj ? Object.keys(depsObj) : [];
        // 记录供统一入口使用的元信息
        pendingItemMeta = {
          id: inspect.id || name,
          name,
          icon: 'ri-puzzle-line',
          dependencies: pluginDepends,
          npmDependencies: depsObj || null,
        };
        // 计算插件依赖的安装状态（支持 name@version 范式）
        const list = await window.settingsAPI?.getPlugins?.();
        const installed = Array.isArray(list) ? list : [];
        const parseVer = (v) => {
          const m = String(v || '0.0.0').split('.').map(x => parseInt(x, 10) || 0);
          return { m: m[0]||0, n: m[1]||0, p: m[2]||0 };
        };
        const cmp = (a, b) => {
          if (a.m !== b.m) return a.m - b.m;
          if (a.n !== b.n) return a.n - b.n;
          return a.p - b.p;
        };
        const satisfies = (ver, range) => {
          if (!range) return !!ver;
          const v = parseVer(ver);
          const r = String(range).trim();
          const plain = r.replace(/^[~^]/, '');
          const base = parseVer(plain);
          if (r.startsWith('^')) return (v.m === base.m) && (cmp(v, base) >= 0);
          if (r.startsWith('~')) return (v.m === base.m) && (v.n === base.n) && (cmp(v, base) >= 0);
          if (r.startsWith('>=')) return cmp(v, parseVer(r.slice(2))) >= 0;
          if (r.startsWith('>')) return cmp(v, parseVer(r.slice(1))) > 0;
          if (r.startsWith('<=')) return cmp(v, parseVer(r.slice(2))) <= 0;
          if (r.startsWith('<')) return cmp(v, parseVer(r.slice(1))) < 0;
          // 精确匹配 x.y.z
          const exact = parseVer(r);
          return cmp(v, exact) === 0;
        };
        const depPills = pluginDepends.map(d => {
          const [depName, depRange] = String(d).split('@');
          const target = installed.find(pp => (pp.id === depName) || (pp.name === depName));
          const ok = !!target && satisfies(target?.version, depRange);
          const hint = !target ? '（未安装）' : (!satisfies(target?.version, depRange) ? `（版本不满足，已装${target?.version || '未知'}）` : '');
          return `<span class="pill small${ok ? '' : ' danger'}">${depName}${depRange ? '@'+depRange : ''}${hint}</span>`;
        }).join(' ');
        const npmPills = depNames.map(k => `<span class="pill small">${k}</span>`).join(' ');
        const msg = `
将安装：${name}
作者：${author}
插件依赖：${pluginDepends.length ? pluginDepends.join('，') : '无'}
NPM依赖：${depNames.length ? depNames.join('，') : '无'}
`;
        // 风险确认与依赖选择将由统一安装入口统一处理
      }
    } catch (e) {}
    // 直接调用统一安装入口，交由其处理确认与依赖引导
    try {
      if (pendingZipPath) {
        await window.unifiedPluginInstall({ kind: 'zipPath', item: pendingItemMeta || {}, zipPath: pendingZipPath });
      } else if (pendingZipData) {
        await window.unifiedPluginInstall({ kind: 'zipData', item: pendingItemMeta || {}, zipName: pendingZipData.name, zipData: pendingZipData.data });
      }
    } finally {
      pendingZipPath = null; pendingZipData = null; pendingItemMeta = null;
    }
  });

  // Check for Main Program Update and Plugin Auto-Update Notification
  async function checkUpdateNotifications() {
    try {
      // 1. Main Program Update
      const justUpdated = await window.settingsAPI?.configGet?.('system', 'justUpdated');
      const showNotif = await window.settingsAPI?.configGet?.('system', 'showUpdateNotification');
      
      if (justUpdated) {
        // Reset the flag
        await window.settingsAPI?.configSet?.('system', 'justUpdated', false);
        
        if (showNotif !== false) {
           const prevVer = await window.settingsAPI?.configGet?.('system', 'previousVersion');
           const currentVer = await window.settingsAPI?.getAppInfo?.().then(i => i.appVersion);
           const changelog = await window.settingsAPI?.checkUpdate?.(true).then(r => r.notes);

           showUpdateNotification('主程序已更新', 
             `版本：v${prevVer || '?'} → v${currentVer || '?'}<br>点击查看详细更新日志`,
             () => {
               // Show changelog modal
               showLogModal(`更新日志 v${currentVer}`, changelog || '暂无详细日志');
             }
           );
        }
      }

      // 2. Plugin Auto-Update
      if (showNotif !== false) {
         const updatedPlugins = await window.settingsAPI?.pluginGetLastAutoUpdateResult?.();
         
         if (updatedPlugins && updatedPlugins.length > 0) {
            const listHtml = updatedPlugins.map(p => `<li>${p.name} (v${p.oldVersion} -> v${p.newVersion})</li>`).join('');
            showUpdateNotification('插件自动更新完成', 
              `已自动更新以下插件：<ul>${listHtml}</ul>`,
              () => {
                 navigateToPage('plugins');
              }
            );
         }
      }

    } catch(e) { console.error(e); }
  }
  
  // Delay slightly to ensure UI is ready
  // setTimeout(checkUpdateNotifications, 1500); // Disabled: Now handled by Main Process NotificationWindow

  // Global handler for Range Input progress fill
  document.addEventListener('input', (e) => {
    if (e.target && e.target.type === 'range') {
      const el = e.target;
      const min = parseFloat(el.min || 0);
      const max = parseFloat(el.max || 100);
      const val = parseFloat(el.value || 0);
      const ratio = (val - min) / (max - min) * 100;
      el.style.setProperty('--progress', ratio + '%');
    }
  });
  // Initialize existing ranges
  document.querySelectorAll('input[type="range"]').forEach(el => {
    const min = parseFloat(el.min || 0);
    const max = parseFloat(el.max || 100);
    const val = parseFloat(el.value || 0);
    const ratio = (val - min) / (max - min) * 100;
    el.style.setProperty('--progress', ratio + '%');
  });

  // 帮助文档功能

  // 帮助文档内容
  const helpDocs = {
    plugins: `
# 插件管理

## 功能说明
插件管理页面允许您对已安装的插件进行管理和配置。

## 视图切换
- **卡片视图**：以卡片形式展示插件，包含插件名称、描述、版本等信息
- **图标视图**：以图标形式展示插件，更加简洁直观

## 操作说明
- **启用/禁用**：点击插件卡片上的开关可以启用或禁用插件
- **配置**：点击插件卡片上的配置按钮可以打开插件的配置页面
- **更新**：当插件有新版本时，会显示更新按钮
- **卸载**：点击插件卡片上的卸载按钮可以移除插件

## 插件状态
- **已启用**：插件正常运行中
- **已禁用**：插件已安装但未运行
- **需更新**：插件有可用的新版本
- **依赖缺失**：插件缺少必要的依赖项
    `,
    components: `
# 组件管理

## 功能说明
组件管理页面允许您管理并预览已安装的组件，所有组件按组归类展示。

## 组件分类
组件根据其功能和用途被分为不同的组，便于您快速找到需要的组件。

## 预览功能
您可以点击组件卡片查看组件的详细信息和预览效果，了解组件的功能和使用方法。

## 组件状态
- **已安装**：组件已成功安装到系统中
- **可用**：组件可以正常使用
    `,
    market: `
# 功能市场

## 功能说明
功能市场是您浏览、发现与获取功能模块的地方，包括插件、自动化任务和组件。

## 分类浏览
- **综合**：展示所有类型的功能模块
- **插件**：专门展示插件模块
- **自动化**：展示自动化任务模板
- **组件**：展示可用于插件的组件
- **功能更新**：展示有更新的功能模块

## 搜索与筛选
- **搜索**：通过关键词搜索功能模块
- **筛选**：根据类别、状态等条件筛选功能模块

## 安装流程
1. 浏览或搜索找到需要的功能模块
2. 点击模块卡片查看详细信息
3. 点击安装按钮开始安装
4. 等待安装完成并启用模块
    `,
    general: `
# 通用设置

## 功能说明
通用设置页面包含应用的基础设置、启动页与名言配置等内容。

## 基本设置
- **自动更新主程序**：允许在启动时自动检查并应用主程序更新
- **自动更新插件**：允许在启动时自动检查并更新已安装的插件
- **显示更新日志提示**：在更新后显示更新日志提示框
- **开机自启动**：系统登录后自动启动应用
- **在线服务地址**：用于加载在线服务（功能市场/更新等）

## 外观与主题
- **主题模式**：选择应用的深色或浅色外观
- **主题强调色**：自定义应用的主色调

## 启动页面
- **启用启动页**：开启后应用启动时显示加载页面
- **背景样式**：选择启动页的背景样式
- **程序名称**：设置启动页显示的程序名称
- **副标题/描述**：设置启动页显示的副标题或描述

## 名言设置
- **显示名言**：控制是否在启动页显示名言
- **名言来源**：选择名言的来源（Hitokoto、EngQuote、本地列表或自定义地址）
- **本地名言列表**：编辑本地名言列表

## 时间与日期
- **使用精确时间**：为插件提供精确当前时间接口
- **学期开始日期**：用于单双周判断与时间偏移基准
- **时间偏移值**：对当前时间进行加减调整
- **自动时间偏移**：每天自动叠加该偏移值
- **时区**：用于时间显示的时区
- **NTP服务器地址**：启用精确时间后，将从该NTP服务获取时间

## 数据目录
- **数据目录占用**：显示用户数据目录当前磁盘占用大小
- **数据目录**：打开或更改应用数据目录
- **清理用户数据**：删除插件与配置等用户数据
    `,
    config: `
# 配置总览

## 功能说明
配置总览页面按插件与主程序聚合并快速编辑配置项。

## 搜索功能
通过搜索框可以按插件或键名搜索配置项，快速找到需要修改的配置。

## 配置编辑
- **文本配置**：直接在输入框中修改文本类型的配置
- **数值配置**：在输入框中修改数值类型的配置
- **布尔配置**：通过开关控制布尔类型的配置
- **选择配置**：通过下拉菜单选择配置值

## 配置分组
配置项按插件和主程序分组展示，便于您管理不同模块的配置。
    `,
    defaults: `
# 默认行为

## 功能说明
默认行为页面允许您为动作名选择默认执行的插件。

## 动作管理
当多个插件都提供相同的动作时，您可以在此页面设置默认使用哪个插件来执行该动作。

## 设置方法
1. 找到需要设置默认插件的动作
2. 从下拉菜单中选择默认插件
3. 保存设置

## 应用场景
当您有多个插件提供类似功能时，设置默认行为可以确保系统使用您偏好的插件来执行特定动作。
    `,
    automation: `
# 自动执行

## 功能说明
自动执行页面允许您根据触发与条件自动执行任务。

## 任务创建
1. 点击"新建任务"按钮
2. 填写任务名称和描述
3. 设置触发条件
4. 添加执行动作
5. 保存任务

## 触发类型
- **定时触发**：在指定时间执行任务
- **事件触发**：当特定事件发生时执行任务
- **手动触发**：通过快捷方式或其他方式手动触发任务

## 条件设置
您可以为任务设置条件，只有当条件满足时，任务才会执行。

## 动作配置
为任务添加需要执行的动作，并配置动作的参数。

## 任务管理
- **启用/禁用**：控制任务是否启用
- **编辑**：修改任务的设置
- **删除**：移除不需要的任务
    `,
    debug: `
# 调试

## 功能说明
调试页面在开发者模式下提供运行管理与图标工具。

## 运行管理
- **程序基本信息**：查看当前版本与运行环境信息
- **快速重启程序**：快速重启应用
- **启动时同步插件**：每次启动时从开发工作区强制同步插件
- **拖拽安装**：拖入插件ZIP安装包以开始安装

## 图标工具
- **图标参数**：输入RemixIcon类名与颜色，渲染预览并保存为PNG
- **输出目录**：查看图标输出目录

## 后端日志
- **Node后端日志**：查看后端运行日志，仅在开发者模式开启时自动保存与记录

## 更新测试
- **更新提示框测试**：测试主程序与插件更新后的通知样式与逻辑
- **UI样式预览**：直接触发前端通知组件
- **启动行为模拟**：修改配置标记，使下次启动时触发真实的更新检测逻辑
    `,
    npm: `
# 依赖管理

## 功能说明
依赖管理页面允许您管理插件依赖的Node模块：搜索、下载与删除版本。

## 已安装模块
展示当前已安装的Node模块及其版本。

## 版本搜索
1. 在搜索框中输入NPM包名
2. 点击"搜索版本"按钮
3. 从搜索结果中选择需要的版本进行下载

## 版本管理
- **下载版本**：下载指定包的特定版本
- **删除版本**：删除已安装的版本（被插件占用的版本无法删除）

## 依赖关系
当插件依赖于特定版本的Node模块时，系统会自动管理这些依赖关系，确保插件能够正常运行。
    `
  };

  // 为所有帮助按钮添加点击事件
  document.querySelectorAll('.help-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.page;
      const doc = helpDocs[page] || '暂无帮助文档';
      
      // 使用通用模态框
      const content = document.createElement('div');
      content.className = 'modal-readme custom-scroll';
      content.style.maxHeight = '60vh';
      content.style.overflowY = 'auto';
      content.innerHTML = marked.parse(doc);
      
      showModal({
        title: '帮助文档',
        message: content,
        confirmText: '确定',
        cancelText: '关闭',
        boxClass: 'help-modal'
      });
    });
  });
}

main();
