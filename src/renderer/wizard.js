const presetColors = ['#238f4a', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#ef4444', '#14b8a6', '#6366f1'];

const steps = ['welcome', 'appearance', 'splash', 'semester', 'market', 'complete'];
let currentStep = 0;
let selectedColor = '#238f4a';
let marketItems = [];

function init() {
  renderStepIndicators();
  renderColorPicker();
  renderSemesterOptions();
  loadMarketItems();
  bindEvents();
  updateUI();
}

function renderStepIndicators() {
  const container = document.getElementById('step-indicators');
  container.innerHTML = '';
  steps.forEach((step, index) => {
    if (step === 'welcome' || step === 'complete') return;
    const dot = document.createElement('div');
    dot.className = 'step-dot';
    dot.dataset.step = step;
    container.appendChild(dot);
  });
}

function renderColorPicker() {
  const container = document.getElementById('color-picker');
  container.innerHTML = '';
  
  presetColors.forEach(color => {
    const dot = document.createElement('div');
    dot.className = 'color-dot';
    dot.style.backgroundColor = color;
    if (color === selectedColor) dot.classList.add('selected');
    dot.addEventListener('click', () => {
      document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('selected'));
      dot.classList.add('selected');
      selectedColor = color;
      applyThemePreview();
    });
    container.appendChild(dot);
  });
}

function renderSemesterOptions() {
  const container = document.getElementById('semester-options');
  container.innerHTML = '';
  
  const options = window.lunarUtils.getSemesterOptions();
  
  if (options.length === 0) {
    container.innerHTML = '<p class="form-hint">暂无可用的学期选项</p>';
    return;
  }
  
  options.forEach((opt, index) => {
    const option = document.createElement('div');
    option.className = 'semester-option';
    option.dataset.value = opt.value;
    option.innerHTML = `
      <div class="radio-dot"></div>
      <span class="option-label">${opt.label}</span>
    `;
    option.addEventListener('click', () => {
      document.querySelectorAll('.semester-option').forEach(o => o.classList.remove('selected'));
      option.classList.add('selected');
      document.getElementById('semester-start').value = opt.value;
    });
    container.appendChild(option);
  });
}

async function loadMarketItems() {
  const container = document.getElementById('market-grid');
  
  try {
    const cfg = await window.wizardAPI?.configGetAll?.('system');
    const baseUrl = cfg?.serviceBase || cfg?.marketApiBase || 'https://orbiboard.3r60.top/';
    const url = new URL('/api/market/catalog', baseUrl).toString();
    
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('Failed to load');
    
    const data = await resp.json();
    const allItems = [
      ...(data.plugins || []),
      ...(data.automation || []),
      ...(data.components || [])
    ];
    
    marketItems = allItems.filter(item => item.recommended).slice(0, 6);
    
    if (marketItems.length === 0) {
      marketItems = allItems.slice(0, 6);
    }
    
    renderMarketItems();
  } catch (e) {
    container.innerHTML = `
      <div class="market-loading">
        <i class="ri-information-line"></i> 暂时无法加载推荐功能，您可以稍后在功能市场中浏览
      </div>
    `;
  }
}

function renderMarketItems() {
  const container = document.getElementById('market-grid');
  container.innerHTML = '';
  
  if (marketItems.length === 0) {
    container.innerHTML = `
      <div class="market-loading">
        <i class="ri-information-line"></i> 暂无推荐功能
      </div>
    `;
    return;
  }
  
  marketItems.forEach(item => {
    const card = document.createElement('div');
    card.className = 'market-card';
    card.innerHTML = `
      <i class="card-icon ${item.icon || 'ri-puzzle-line'}"></i>
      <div class="card-title">${item.name}</div>
      <div class="card-desc">${item.description || ''}</div>
      <div class="card-action">
        <button class="btn small primary" data-action="install">
          <i class="ri-download-2-line"></i> 安装
        </button>
      </div>
    `;
    
    const btn = card.querySelector('button[data-action="install"]');
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await installMarketItem(item, btn);
    });
    
    container.appendChild(card);
  });
}

async function installMarketItem(item, btn) {
  try {
    btn.disabled = true;
    btn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> 安装中...';
    
    if (item.zip) {
      const cfg = await window.wizardAPI?.configGetAll?.('system');
      const baseUrl = cfg?.serviceBase || cfg?.marketApiBase || 'https://orbiboard.3r60.top/';
      const url = new URL(item.zip, baseUrl).toString();
      
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('下载失败');
      
      const buf = await resp.arrayBuffer();
      const name = item.name || item.id || 'plugin';
      const result = await window.wizardAPI?.installPluginZipData?.(name, new Uint8Array(buf));
      
      if (result?.ok) {
        btn.innerHTML = '<i class="ri-checkbox-circle-line"></i> 已安装';
        btn.classList.remove('primary');
        btn.classList.add('secondary');
      } else {
        throw new Error(result?.error || '安装失败');
      }
    } else if (item.npm) {
      const versions = await window.wizardAPI?.npmGetVersions?.(item.npm);
      const verList = versions?.versions || [];
      const latest = verList.length ? verList[verList.length - 1] : null;
      
      if (!latest) throw new Error('无可用版本');
      
      const result = await window.wizardAPI?.npmDownload?.(item.npm, latest);
      if (result?.ok) {
        btn.innerHTML = '<i class="ri-checkbox-circle-line"></i> 已安装';
        btn.classList.remove('primary');
        btn.classList.add('secondary');
      } else {
        throw new Error(result?.error || '安装失败');
      }
    } else {
      throw new Error('无可用的安装源');
    }
  } catch (e) {
    btn.disabled = false;
    btn.innerHTML = '<i class="ri-download-2-line"></i> 安装';
    console.error('Install failed:', e);
  }
}

function bindEvents() {
  document.getElementById('btn-start').addEventListener('click', () => {
    currentStep = 1;
    updateUI();
  });
  
  document.getElementById('btn-prev').addEventListener('click', () => {
    if (currentStep > 1) {
      currentStep--;
      updateUI();
    }
  });
  
  document.getElementById('btn-next').addEventListener('click', async () => {
    if (currentStep < steps.length - 1) {
      await saveCurrentStepSettings();
      currentStep++;
      updateUI();
    }
  });
  
  document.getElementById('btn-finish').addEventListener('click', async () => {
    await saveCurrentStepSettings();
    await window.wizardAPI?.completeWizard?.();
  });
  
  document.querySelectorAll('input[name="themeMode"]').forEach(radio => {
    radio.addEventListener('change', applyThemePreview);
  });
  
  document.getElementById('semester-start').addEventListener('change', () => {
    document.querySelectorAll('.semester-option').forEach(o => o.classList.remove('selected'));
  });
}

async function saveCurrentStepSettings() {
  const step = steps[currentStep];
  
  if (step === 'appearance') {
    const themeMode = document.querySelector('input[name="themeMode"]:checked')?.value || 'system';
    await window.wizardAPI?.configSet?.('system', 'themeMode', themeMode);
    await window.wizardAPI?.configSet?.('system', 'themeColor', selectedColor);
  } else if (step === 'splash') {
    const splashEnabled = document.getElementById('splash-enabled').checked;
    const splashQuoteEnabled = document.getElementById('splash-quote-enabled').checked;
    const splashBgStyle = document.querySelector('input[name="splashBgStyle"]:checked')?.value || 'black';
    
    await window.wizardAPI?.configSet?.('system', 'splashEnabled', splashEnabled);
    await window.wizardAPI?.configSet?.('system', 'splashQuoteEnabled', splashQuoteEnabled);
    await window.wizardAPI?.configSet?.('system', 'splashBgStyle', splashBgStyle);
  } else if (step === 'semester') {
    const semesterStart = document.getElementById('semester-start').value;
    const biweekOffset = document.getElementById('biweek-offset').checked;
    
    if (semesterStart) {
      await window.wizardAPI?.configSet?.('system', 'semesterStart', semesterStart);
      await window.wizardAPI?.configSet?.('system', 'offsetBaseDate', semesterStart);
    }
    await window.wizardAPI?.configSet?.('system', 'biweekOffset', biweekOffset);
  }
}

function applyThemePreview() {
  const mode = document.querySelector('input[name="themeMode"]:checked')?.value || 'system';
  const root = document.documentElement;
  
  let actualMode = mode;
  if (mode === 'system') {
    actualMode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  
  if (actualMode === 'light') {
    root.style.setProperty('--bg', '#f5f5f5');
    root.style.setProperty('--fg', '#1a1a1a');
    root.style.setProperty('--muted', '#6b7280');
    root.style.setProperty('--panel', 'rgba(0, 0, 0, 0.04)');
    root.style.setProperty('--border', 'rgba(0, 0, 0, 0.12)');
    root.style.setProperty('--bg-modal', '#ffffff');
  } else {
    root.style.setProperty('--bg', '#121621');
    root.style.setProperty('--fg', '#ededed');
    root.style.setProperty('--muted', '#94a3b8');
    root.style.setProperty('--panel', 'rgba(255, 255, 255, 0.04)');
    root.style.setProperty('--border', 'rgba(255, 255, 255, 0.12)');
    root.style.setProperty('--bg-modal', '#1b1f2a');
  }
  
  root.style.setProperty('--accent', selectedColor);
  const hexToRgb = (hex) => {
    const bigint = parseInt(hex.slice(1), 16);
    return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
  };
  root.style.setProperty('--accent-rgb', hexToRgb(selectedColor).join(', '));
}

function updateUI() {
  const progressFill = document.getElementById('progress-fill');
  const footer = document.getElementById('wizard-footer');
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  
  const progressSteps = steps.filter(s => s !== 'welcome' && s !== 'complete');
  const progressIndex = currentStep === 0 ? -1 : 
                        currentStep === steps.length - 1 ? progressSteps.length :
                        currentStep - 1;
  
  progressFill.style.width = `${((progressIndex + 1) / progressSteps.length) * 100}%`;
  
  document.querySelectorAll('.step-dot').forEach((dot, index) => {
    dot.classList.remove('active', 'completed');
    if (index < progressIndex) {
      dot.classList.add('completed');
    } else if (index === progressIndex) {
      dot.classList.add('active');
    }
  });
  
  steps.forEach((step, index) => {
    const section = document.getElementById(`step-${step}`);
    if (section) {
      section.hidden = index !== currentStep;
      section.classList.toggle('active', index === currentStep);
    }
  });
  
  if (currentStep === 0 || currentStep === steps.length - 1) {
    footer.hidden = true;
  } else {
    footer.hidden = false;
    btnPrev.disabled = currentStep <= 1;
    btnNext.innerHTML = currentStep === steps.length - 2 
      ? '完成 <i class="ri-check-line"></i>' 
      : '下一步 <i class="ri-arrow-right-line"></i>';
  }
}

document.addEventListener('DOMContentLoaded', init);
