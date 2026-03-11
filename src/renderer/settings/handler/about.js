
function initAboutPage() {
  const vEl = document.getElementById('about-version');
  const eEl = document.getElementById('about-electron');
  const nEl = document.getElementById('about-node');
  const cEl = document.getElementById('about-chrome');
  const pEl = document.getElementById('about-platform');
  const copyBtn = document.getElementById('about-copy');
  const openDataBtn = document.getElementById('about-open-data');
  const versionEl = document.getElementById('about-version');

  (async () => {
    try {
      const info = await window.settingsAPI?.getAppInfo?.();
      if (info?.appVersion) vEl.textContent = info.appVersion;
      const ev = info?.electronVersion || (navigator.userAgent.match(/Electron\/([\d.]+)/)?.[1] || '—');
      eEl.textContent = ev;
      const nv = info?.nodeVersion || (process?.versions?.node || '—');
      const cv = info?.chromeVersion || (process?.versions?.chrome || '—');
      const pv = info?.platform || (process?.platform || navigator?.platform || '—');
      if (nEl) nEl.textContent = nv;
      if (cEl) cEl.textContent = cv;
      if (pEl) pEl.textContent = pv;
    } catch (e) {
      vEl.textContent = vEl.textContent || '—';
      eEl.textContent = eEl.textContent || (navigator.userAgent.match(/Electron\/([\d.]+)/)?.[1] || '—');
      if (nEl) nEl.textContent = process?.versions?.node || '—';
      if (cEl) cEl.textContent = process?.versions?.chrome || '—';
      if (pEl) pEl.textContent = process?.platform || navigator?.platform || '—';
    }
  })();

  copyBtn?.addEventListener('click', async () => {
    const merged = [
      `OrbiBoard ${vEl?.textContent || '—'}`,
      `Electron ${eEl?.textContent || '—'}`,
      `Node ${nEl?.textContent || '—'}`,
      `Chrome ${cEl?.textContent || '—'}`,
      `平台 ${pEl?.textContent || '—'}`
    ].join(' | ');
    try { await navigator.clipboard?.writeText(merged); } catch (e) {}
  });

  if (openDataBtn) {
    if (window.settingsAPI?.openUserData) {
      openDataBtn.hidden = false;
      if (openDataBtn.dataset.bound !== '1') {
        openDataBtn.dataset.bound = '1';
        openDataBtn.addEventListener('click', () => window.settingsAPI.openUserData());
      }
    } else {
      openDataBtn.hidden = true;
    }
  }

  const debugNavBtn = Array.from(document.querySelectorAll('.nav-item')).find(b => b.dataset.page === 'debug');
  if (versionEl && versionEl.dataset.devToggleBound !== '1') {
    versionEl.dataset.devToggleBound = '1';
    let tapCount = 0; let tapTimer = null;
    versionEl.addEventListener('click', async () => {
      try {
        tapCount += 1;
        if (tapTimer) clearTimeout(tapTimer);
        tapTimer = setTimeout(() => { tapCount = 0; }, 1200);
        if (tapCount < 5) return;
        tapCount = 0; clearTimeout(tapTimer); tapTimer = null;
        const current = await window.settingsAPI?.configGet?.('system', 'developerMode');
        const enable = !current;
        if (enable) {
          const ok = await showConfirm('开发者模式将显示调试功能，操作有风险，请谨慎使用。', '开启开发者模式');
          if (!ok) return;
          await window.settingsAPI?.configSet?.('system', 'developerMode', true);
          if (debugNavBtn) { debugNavBtn.style.display = ''; debugNavBtn.click(); }
          showToast('开发者模式已开启', { type: 'success', duration: 2000 });
        } else {
          await window.settingsAPI?.configSet?.('system', 'developerMode', false);
          if (debugNavBtn) { debugNavBtn.style.display = 'none'; }
          showToast('开发者模式已关闭', { type: 'info', duration: 2000 });
        }
      } catch (e) {}
    });
  }

  const checkBtn = document.getElementById('about-check-update');
  const updateStatus = document.getElementById('update-status');
  const updateInfo = document.getElementById('update-info');
  const updateDetails = document.getElementById('update-details');
  const newVersionEl = document.getElementById('update-new-version');
  const notesEl = document.getElementById('update-notes');
  const performBtn = document.getElementById('about-perform-update');
  const progressWrap = document.getElementById('update-progress-wrap');
  const progressBar = document.getElementById('update-progress-bar');
  const progressText = document.getElementById('update-progress-text');

  let isManualUpdating = false;
  let autoUpdateOff = null;

  async function checkAndShowAutoUpdateStatus() {
    try {
      const status = await window.settingsAPI?.getAutoUpdateStatus?.();
      if (status && status.isAutoUpdating && status.currentUpdateInfo) {
        const info = status.currentUpdateInfo;
        updateStatus.textContent = '正在自动更新...';
        newVersionEl.textContent = info.remoteVersion;
        const notes = info.notes || '暂无更新日志';
        notesEl.innerHTML = notes.replace(/\n/g, '<br/>');
        updateDetails.hidden = false;
        progressWrap.style.display = 'flex';
        performBtn.style.display = 'none';
        
        if (autoUpdateOff) autoUpdateOff();
        autoUpdateOff = window.settingsAPI.onProgress((payload) => {
          if (payload && payload.stage === 'update' && payload.isAuto === true) {
            const msg = String(payload.message || '');
            const m = msg.match(/(\d+)%/);
            if (m) {
              const pct = parseInt(m[1], 10);
              progressBar.style.width = pct + '%';
              progressText.textContent = pct + '%';
            }
            if (msg.includes('应用更新包') || msg.includes('启动安装程序')) {
              progressBar.style.width = '100%';
              progressText.textContent = '100%';
              updateStatus.textContent = '更新完成，正在重启...';
            }
          }
        });
      }
    } catch (e) {}
  }

  checkAndShowAutoUpdateStatus();

  if (checkBtn) {
    checkBtn.addEventListener('click', async () => {
      if (checkBtn.disabled) return;
      checkBtn.disabled = true;
      checkBtn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> 检查中...';
      updateStatus.textContent = '正在检查更新...';
      updateDetails.hidden = true;
      
      try {
        let res;
        const appInfo = await window.settingsAPI?.getAppInfo?.();
        if (appInfo && appInfo.isDev) {
          await new Promise(r => setTimeout(r, 1000));
          res = {
            ok: true,
            hasUpdate: true,
            remoteVersion: '1.2.3-preview',
            notes: '这是一条模拟的更新日志（仅开发模式可见）。\n\n1. 修复了若干问题\n2. 优化了用户体验\n3. 新增了模拟更新功能\n\n点击"立即更新"将演示进度条效果。'
          };
        } else {
          res = await window.settingsAPI.checkUpdate(true);
        }

        const now = new Date();
        updateInfo.textContent = `最后检查时间：${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
        
        if (!res.ok) {
          updateStatus.textContent = '检查更新失败';
          updateStatus.innerHTML += `<span class="muted" style="font-size:13px; margin-left:8px;">${res.error || '未知错误'}</span>`;
        } else if (res.hasUpdate) {
          updateStatus.textContent = '发现新版本';
          newVersionEl.textContent = res.remoteVersion;
          const notes = res.notes || '暂无更新日志';
          notesEl.innerHTML = notes.replace(/\n/g, '<br/>');
          updateDetails.hidden = false;
          progressWrap.style.display = 'none';
          performBtn.style.display = 'inline-flex';
          performBtn.disabled = false;
        } else {
          updateStatus.textContent = '当前已是最新版本';
        }
      } catch (e) {
        updateStatus.textContent = '检查更新出错';
        console.error(e);
      } finally {
        checkBtn.disabled = false;
        checkBtn.innerHTML = '<i class="ri-refresh-line"></i> 检查更新';
      }
    });
  }

  if (performBtn) {
    performBtn.addEventListener('click', async () => {
      performBtn.disabled = true;
      performBtn.style.display = 'none';
      progressWrap.style.display = 'flex';
      isManualUpdating = true;

      const appInfo = await window.settingsAPI?.getAppInfo?.();
      if (appInfo && appInfo.isDev) {
        let p = 0;
        const timer = setInterval(() => {
          p += 5;
          if (p > 100) p = 100;
          progressBar.style.width = p + '%';
          progressText.textContent = p + '%';
          if (p === 100) {
            clearInterval(timer);
            updateStatus.textContent = '模拟更新完成，正在重启...';
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          }
        }, 200);
        return;
      }
      
      const off = window.settingsAPI.onProgress((payload) => {
        if (payload && payload.stage === 'update') {
          if (payload.isAuto === true && isManualUpdating) {
            return;
          }
          const msg = String(payload.message || '');
          const m = msg.match(/(\d+)%/);
          if (m) {
            const pct = parseInt(m[1], 10);
            progressBar.style.width = pct + '%';
            progressText.textContent = pct + '%';
          }
          if (msg.includes('应用更新包') || msg.includes('启动安装程序')) {
             progressBar.style.width = '100%';
             progressText.textContent = '100%';
             updateStatus.textContent = '更新完成，正在重启...';
          }
        }
      });
      
      try {
        const res = await window.settingsAPI.performUpdate();
        if (res && res.ok && res.updated) {
          updateStatus.textContent = '更新完成，正在重启...';
        } else if (res && !res.ok) {
          updateStatus.textContent = '更新失败: ' + (res.error || '未知错误');
          performBtn.style.display = 'inline-flex';
          performBtn.disabled = false;
          progressWrap.style.display = 'none';
          isManualUpdating = false;
        }
      } catch (e) {
        updateStatus.textContent = '更新失败: ' + (e.message || String(e));
        performBtn.style.display = 'inline-flex';
        performBtn.disabled = false;
        progressWrap.style.display = 'none';
        isManualUpdating = false;
      } finally {
        if (off) off(); 
      }
    });
  }

  const toggleBtn = document.getElementById('about-toggle-details');
  const detailsArea = document.getElementById('about-details-area');
  if (toggleBtn && detailsArea && toggleBtn.dataset.bound !== '1') {
    toggleBtn.dataset.bound = '1';
    toggleBtn.addEventListener('click', () => {
      const isHidden = detailsArea.hidden;
      detailsArea.hidden = !isHidden;
      toggleBtn.classList.toggle('active', !isHidden);
    });
  }

  const repoBtn = document.getElementById('about-repo');
  if (repoBtn && repoBtn.dataset.bound !== '1') {
    repoBtn.dataset.bound = '1';
    repoBtn.addEventListener('click', async () => {
      const url = 'https://github.com/OrbiBoard/OrbiBoard';
      try {
        if (window.settingsAPI?.openExternal) {
          await window.settingsAPI.openExternal(url);
        } else {
          window.open(url, '_blank');
        }
      } catch (e) {
        window.open(url, '_blank');
      }
    });
  }
}
