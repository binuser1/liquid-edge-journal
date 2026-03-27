
(() => {
  const RED_FLAG_WORDS = ['felt', 'feel', 'hope', 'scared', 'fear', 'emotional', 'gamble', 'revenge', 'praying', 'pray', 'fomo', 'rushed', 'rush', 'rushing'];
  const MARKETS = ['VIX 10','VIX 10s','VIX 25','VIX 50','VIX 75','VIX 100','VIX 10 (1s)','VIX 25 (1s)','VIX 50 (1s)','VIX 75 (1s)','VIX 100 (1s)'];
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const SUPABASE_URL = 'https://nadmrvvtumipncvfrywh.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_5RE7Uspr0r2VDRqd1A4Qjw_rwAaEq1G';
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      multiTab: false,
    },
  });

  const state = {
    theme: localStorage.getItem('liquid_edge_theme') || 'light',
    user: null,
    category: 'backtest',
    market: 'VIX 10',
    checklist: { chk1: false, chk2: false, chk3: false, chk4: false },
    redFlag: false,
    isSaving: false,
    chartFile: null,
    chartPreviewUrl: null,
    hasNotes: false,
    outcome: 'win',
    selectedMonth: new Date().getMonth(),
    selectedView: 'daily',
    selectedFilter: 'all',
    trades: []
  };

  // DOM References
  const html = document.documentElement;
  const themeToggle = document.getElementById('themeToggle');
  const themeLabel = document.getElementById('themeLabel');
  const guardianFill = document.getElementById('guardianFill');
  const guardianStatus = document.getElementById('guardianStatus');
  const vaultText = document.getElementById('vaultText');
  const redFlagWarn = document.getElementById('redFlagWarn');
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const dzInner = document.getElementById('dzInner');
  const saveBtn = document.getElementById('saveBtn');
  const marketScroll = document.getElementById('marketScroll');
  const appTitleEl = document.getElementById('appTitleEl');
  const timelineNav = document.getElementById('timelineNav');
  const tradeGallery = document.getElementById('tradeGallery');
  const tradeModal = document.getElementById('tradeModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalDeleteBtn = document.getElementById('modalDeleteBtn');
  const modalExportBtn = document.getElementById('modalExportBtn');
  const modalChartContainer = document.getElementById('modalChartContainer');
  const winRateValue = document.getElementById('winRateValue');
  const outcomeWinBtn = document.getElementById('outcomeWinBtn');
  const outcomeLossBtn = document.getElementById('outcomeLossBtn');
  const authEmail = document.getElementById('authEmail');
  const authPassword = document.getElementById('authPassword');
  const signInBtn = document.getElementById('signInBtn');
  const signUpBtn = document.getElementById('signUpBtn');
  const signOutBtn = document.getElementById('signOutBtn');
  const authStatus = document.getElementById('authStatus');

  function formatShortDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function toNumberOrNull(raw) {
    const v = (raw || '').trim();
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function getFileExtension(file) {
    const fromName = file.name && file.name.includes('.') ? file.name.split('.').pop() : '';
    if (fromName) return fromName.toLowerCase();
    const mime = (file.type || '').toLowerCase();
    if (mime.includes('png')) return 'png';
    if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
    if (mime.includes('webp')) return 'webp';
    if (mime.includes('gif')) return 'gif';
    return 'png';
  }

  function setAuthStatus(text) {
    if (authStatus) authStatus.textContent = text;
  }

  function updateAuthUI() {
    if (state.user) {
      setAuthStatus(`Signed in: ${state.user.email || 'User'}`);
      if (signOutBtn) signOutBtn.disabled = false;
    } else {
      setAuthStatus('Not signed in');
      if (signOutBtn) signOutBtn.disabled = true;
    }
  }

  function renderSignedOutMessage() {
    tradeGallery.innerHTML =
      '<div style="grid-column:1/-1;text-align:center;padding:40px 20px;color:var(--text-secondary);">Sign in to load your private journal data.</div>';
  }

  function clearLocalAuthStorage() {
    const projectRef = 'nadmrvvtumipncvfrywh';
    const keyPrefix = `sb-${projectRef}-auth-token`;
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith(keyPrefix)) localStorage.removeItem(k);
    });
    Object.keys(sessionStorage).forEach((k) => {
      if (k.startsWith(keyPrefix)) sessionStorage.removeItem(k);
    });
  }

  function resetDropZone() {
    if (state.chartPreviewUrl) {
      URL.revokeObjectURL(state.chartPreviewUrl);
    }
    state.chartFile = null;
    state.chartPreviewUrl = null;
    dzInner.innerHTML = `
      <div class="dz-icon-wrap"><i data-lucide="upload-cloud" class="dz-icon" style="width:26px;height:26px;"></i></div>
      <div class="dz-text"><strong>Drop chart screenshot</strong><br>or click to browse</div>
    `;
    lucide.createIcons();
  }

  function handleImageFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    if (state.chartPreviewUrl) URL.revokeObjectURL(state.chartPreviewUrl);
    state.chartFile = file;
    state.chartPreviewUrl = URL.createObjectURL(file);
    dzInner.innerHTML = `
      <img src="${state.chartPreviewUrl}" class="dz-preview" alt="Chart screenshot" style="max-width:100%;max-height:120px;border-radius:12px;">
      <div class="dz-text" style="font-size:11px;">Click to replace</div>
    `;
  }

  function addRipple(e, el) {
    const rect = el.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.2;
    const x = (e.clientX || rect.left + rect.width / 2) - rect.left - size / 2;
    const y = (e.clientY || rect.top + rect.height / 2) - rect.top - size / 2;
    const circle = document.createElement('span');
    circle.className = 'ripple-circle';
    circle.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px;position:absolute;`;
    el.appendChild(circle);
    circle.addEventListener('animationend', () => circle.remove());
  }

  function updateGuardian() {
    const checks = Object.values(state.checklist);
    const trueCount = checks.filter(Boolean).length;
    const totalChecks = checks.length;
    const allChecksYes = trueCount === totalChecks;
    const isDanger = !allChecksYes && state.hasNotes;

    if (allChecksYes) {
      guardianFill.style.width = '100%';
      guardianFill.classList.remove('danger');
      guardianFill.classList.add('safe');
      guardianStatus.className = 'guardian-status safe';
      guardianStatus.textContent = '✅ All Conditions Met — Engage!';
      return;
    }

    if (isDanger) {
      guardianFill.style.width = '100%';
      guardianFill.classList.add('danger');
      guardianFill.classList.remove('safe');
      guardianStatus.className = 'guardian-status danger';
      guardianStatus.textContent = '🚨 Incomplete Conditions — Risk Alert';
      return;
    }

    const pct = (trueCount / totalChecks) * 100;
    guardianFill.style.width = pct + '%';
    guardianFill.classList.remove('danger', 'safe');
    guardianStatus.className = 'guardian-status neutral';
    guardianStatus.textContent = 'Awaiting conditions…';
  }

  function renderMarkets() {
    marketScroll.innerHTML = '';
    MARKETS.forEach((m) => {
      const chip = document.createElement('button');
      chip.className = 'market-chip' + (m === state.market ? ' selected' : '');
      chip.textContent = m;
      chip.addEventListener('click', (e) => {
        addRipple(e, chip);
        state.market = m;
        renderMarkets();
      });
      marketScroll.appendChild(chip);
    });
  }

  function renderTimeline() {
    timelineNav.innerHTML = '';
    MONTHS.forEach((m, idx) => {
      const btn = document.createElement('button');
      btn.className = 'timeline-month' + (idx === state.selectedMonth ? ' active' : '');
      btn.textContent = m;
      btn.addEventListener('click', () => {
        state.selectedMonth = idx;
        renderTimeline();
        renderGallery();
      });
      timelineNav.appendChild(btn);
    });
  }

  async function loadTrades() {
    if (!state.user) {
      state.trades = [];
      return;
    }

    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message || 'Failed to load trades');

    const rows = data || [];
    state.trades = await Promise.all(
      rows.map(async (row) => {
        let image_signed_url = null;
        if (row.chart_path) {
          const signed = await supabase.storage.from('charts').createSignedUrl(row.chart_path, 3600);
          image_signed_url = signed.error ? null : (signed.data?.signedUrl || null);
        }

        return {
          id: row.id,
          created_at: row.created_at,
          market: row.market,
          category: row.category,
          chk1: !!row.chk1,
          chk2: !!row.chk2,
          chk3: !!row.chk3,
          chk4: !!row.chk4,
          notes: row.notes || '',
          entry_price: row.entry_price,
          exit_price: row.exit_price,
          stop_loss: row.stop_loss,
          take_profit: row.take_profit,
          outcome: row.outcome,
          chart_path: row.chart_path,
          image_signed_url,
        };
      })
    );
  }

  function renderGallery() {
    const filtered = state.trades.filter((trade) => {
      if (state.selectedFilter !== 'all' && trade.category !== state.selectedFilter) return false;
      const tradeDate = new Date(trade.created_at);
      if (tradeDate.getMonth() !== state.selectedMonth) return false;
      return true;
    });

    const decided = filtered.filter((t) => t.outcome === 'win' || t.outcome === 'loss');
    const wins = decided.filter((t) => t.outcome === 'win').length;
    if (winRateValue) {
      if (decided.length === 0) winRateValue.textContent = '—';
      else winRateValue.textContent = `${Math.round((wins / decided.length) * 100)}%`;
    }

    tradeGallery.innerHTML = '';
    if (filtered.length === 0) {
      tradeGallery.innerHTML =
        '<div style="grid-column:1/-1;text-align:center;padding:40px 20px;color:var(--text-secondary);">No trades recorded yet. Start trading! 🚀</div>';
      return;
    }

    filtered.forEach((trade) => {
      const card = document.createElement('div');
      card.className =
        'trade-card' +
        (trade.outcome === 'win' ? ' is-win' : '') +
        (trade.outcome === 'loss' ? ' is-loss' : '');

      const dateStr = formatShortDate(trade.created_at);
      const allChecksYes = trade.chk1 && trade.chk2 && trade.chk3 && trade.chk4;
      const statusClass = !allChecksYes && trade.notes ? 'danger' : 'safe';
      const statusIcon = allChecksYes ? '✓' : (trade.notes ? '⚠' : '—');

      const thumb = trade.image_signed_url
        ? `<img src="${trade.image_signed_url}" alt="Chart" style="width:100%;height:100%;object-fit:cover;">`
        : 'Chart';

      card.innerHTML = `
        <div class="card-chart">${thumb}</div>
        <div class="card-footer">
          <div class="card-market">${trade.market}</div>
          <div class="card-meta">
            <span class="card-date">${dateStr}</span>
            <span class="card-status ${statusClass}">${statusIcon}</span>
          </div>
        </div>
      `;

      card.addEventListener('click', (e) => {
        addRipple(e, card);
        openTradeModal(trade);
      });

      tradeGallery.appendChild(card);
    });
  }

  function openTradeModal(trade) {
    document.getElementById('modalTitle').textContent = new Date(trade.created_at).toLocaleDateString();
    document.getElementById('modalMarketTag').textContent = trade.market;
    document.getElementById('modalEntry').textContent = Number.isFinite(trade.entry_price) ? trade.entry_price.toFixed(2) : '—';
    document.getElementById('modalExit').textContent = Number.isFinite(trade.exit_price) ? trade.exit_price.toFixed(2) : '—';
    document.getElementById('modalSL').textContent = Number.isFinite(trade.stop_loss) ? trade.stop_loss.toFixed(2) : '—';
    document.getElementById('modalTP').textContent = Number.isFinite(trade.take_profit) ? trade.take_profit.toFixed(2) : '—';
    document.getElementById('modalChk1').innerHTML = `4H Zone: <strong>${trade.chk1 ? '✓' : '✗'}</strong>`;
    document.getElementById('modalChk2').innerHTML = `Equal H/L: <strong>${trade.chk2 ? '✓' : '✗'}</strong>`;
    document.getElementById('modalChk3').innerHTML = `Sweep: <strong>${trade.chk3 ? '✓' : '✗'}</strong>`;
    document.getElementById('modalChk4').innerHTML = `Target: <strong>${trade.chk4 ? '✓' : '✗'}</strong>`;
    document.getElementById('modalNotes').textContent = trade.notes || '—';
    document.getElementById('modalTimestamp').textContent = new Date(trade.created_at).toLocaleString();

    if (trade.image_signed_url) {
      modalChartContainer.innerHTML = `<img src="${trade.image_signed_url}" alt="Chart" style="width:100%;height:100%;object-fit:contain;">`;
    } else {
      modalChartContainer.textContent = 'Chart Preview';
    }

    tradeModal.classList.add('active');
    modalDeleteBtn.onclick = () => deleteTradeFromModal(trade);
    modalExportBtn.onclick = () => exportTradeData(trade);
  }

  function closeTradeModal() {
    tradeModal.classList.remove('active');
  }

  async function deleteTradeFromModal(trade) {
    if (!confirm('Are you sure you want to delete this trade?')) return;

    if (!state.user) {
      alert('Sign in required');
      return;
    }

    if (trade.chart_path) {
      const removeResult = await supabase.storage.from('charts').remove([trade.chart_path]);
      if (removeResult.error) {
        alert(removeResult.error.message || 'Failed to delete chart');
        return;
      }
    }

    const { error } = await supabase.from('trades').delete().eq('id', trade.id);
    if (error) {
      alert(error.message || 'Delete failed');
      return;
    }

    await refreshTradesAndRender();
    closeTradeModal();
  }

  function exportTradeData(trade) {
    const csv = `Trade Export\nDate,${new Date(trade.created_at).toLocaleString()}\nMarket,${trade.market}\nCategory,${trade.category}\nNotes,"${(trade.notes || '').replaceAll('"', '""')}"\n`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trade_${trade.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function refreshTradesAndRender() {
    await loadTrades();
    renderGallery();
  }

  async function saveTrade() {
    if (!state.user) throw new Error('Please sign in to save trades');

    const payload = {
      user_id: state.user.id,
      market: state.market,
      category: state.category,
      chk1: !!state.checklist.chk1,
      chk2: !!state.checklist.chk2,
      chk3: !!state.checklist.chk3,
      chk4: !!state.checklist.chk4,
      notes: vaultText.value || '',
      entry_price: toNumberOrNull(document.getElementById('entryPrice').value),
      exit_price: toNumberOrNull(document.getElementById('exitPrice').value),
      stop_loss: toNumberOrNull(document.getElementById('stopLoss').value),
      take_profit: toNumberOrNull(document.getElementById('takeProfit').value),
      outcome: state.outcome,
    };

    const insertResult = await supabase.from('trades').insert(payload).select('id').single();
    if (insertResult.error) {
      throw new Error(insertResult.error.message || 'Failed to save trade');
    }

    const tradeId = insertResult.data?.id;
    if (state.chartFile && tradeId) {
      const ext = getFileExtension(state.chartFile);
      const objectPath = `${state.user.id}/${tradeId}.${ext}`;
      const uploadResult = await supabase.storage
        .from('charts')
        .upload(objectPath, state.chartFile, { cacheControl: '3600', upsert: true, contentType: state.chartFile.type });

      if (uploadResult.error) {
        throw new Error(uploadResult.error.message || 'Failed to upload chart');
      }

      const updateResult = await supabase.from('trades').update({ chart_path: objectPath }).eq('id', tradeId);
      if (updateResult.error) {
        throw new Error(updateResult.error.message || 'Failed to link chart to trade');
      }
    }
  }

  function setActiveFolderBtn(id) {
    document.querySelectorAll('.nav-folder').forEach((b) => b.classList.remove('active'));
    const btn = document.getElementById('nav-' + id);
    if (btn) btn.classList.add('active');
  }

  function renderFilterPills() {
    document.querySelectorAll('.filter-pill').forEach((btn) => {
      const folder = btn.dataset.folder;
      if (folder === state.selectedFilter) btn.classList.add('active');
      else btn.classList.remove('active');
    });
  }

  // Init
  document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();

    html.setAttribute('data-theme', state.theme);
    themeLabel.textContent = state.theme === 'light' ? 'Dark Mode' : 'Light Mode';

    renderMarkets();
    renderTimeline();
    renderFilterPills();
    updateGuardian();
    updateAuthUI();

    try {
      const authResult = await supabase.auth.getUser();
      if (authResult.error) throw authResult.error;
      state.user = authResult.data?.user || null;
      updateAuthUI();

      if (state.user) {
        await refreshTradesAndRender();
      } else {
        renderSignedOutMessage();
      }
    } catch (e) {
      tradeGallery.innerHTML =
        `<div style="grid-column:1/-1;text-align:center;padding:40px 20px;color:var(--text-secondary);">Failed to initialize Supabase: ${e.message || 'Unknown error'}</div>`;
    }
  });

  supabase.auth.onAuthStateChange(async (_event, session) => {
    state.user = session?.user || null;
    updateAuthUI();
    if (state.user) {
      try {
        await refreshTradesAndRender();
      } catch (e) {
        tradeGallery.innerHTML =
          `<div style="grid-column:1/-1;text-align:center;padding:40px 20px;color:var(--text-secondary);">Failed to load trades: ${e.message || 'Unknown error'}</div>`;
      }
    } else {
      state.trades = [];
      renderGallery();
      renderSignedOutMessage();
    }
  });

  function setOutcome(outcome) {
    state.outcome = outcome;
    if (outcomeWinBtn && outcomeLossBtn) {
      outcomeWinBtn.classList.toggle('active', outcome === 'win');
      outcomeLossBtn.classList.toggle('active', outcome === 'loss');
    }
  }

  if (outcomeWinBtn) {
    outcomeWinBtn.addEventListener('click', () => setOutcome('win'));
  }
  if (outcomeLossBtn) {
    outcomeLossBtn.addEventListener('click', () => setOutcome('loss'));
  }

  if (signInBtn) {
    signInBtn.addEventListener('click', async () => {
      const email = (authEmail?.value || '').trim();
      const password = (authPassword?.value || '').trim();
      if (!email || !password) {
        alert('Enter email and password');
        return;
      }
      setAuthStatus('Signing in...');
      const result = await supabase.auth.signInWithPassword({ email, password });
      if (result.error) {
        alert(result.error.message || 'Sign in failed');
        updateAuthUI();
      }
    });
  }

  if (signUpBtn) {
    signUpBtn.addEventListener('click', async () => {
      const email = (authEmail?.value || '').trim();
      const password = (authPassword?.value || '').trim();
      if (!email || !password) {
        alert('Enter email and password');
        return;
      }
      setAuthStatus('Creating account...');
      const result = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });
      if (result.error) {
        alert(result.error.message || 'Sign up failed');
        updateAuthUI();
        return;
      }
      alert('Account created. If email confirmation is enabled, verify your email then sign in.');
      updateAuthUI();
    });
  }

  if (signOutBtn) {
    signOutBtn.addEventListener('click', async () => {
      setAuthStatus('Signing out...');
      const result = await supabase.auth.signOut({ scope: 'local' });
      if (result.error) {
        alert(result.error.message || 'Sign out failed');
        const check = await supabase.auth.getSession();
        if (!check.data?.session) {
          state.user = null;
          state.trades = [];
          updateAuthUI();
          renderSignedOutMessage();
          clearLocalAuthStorage();
          window.location.reload();
        } else {
          updateAuthUI();
        }
        return;
      }

      state.user = null;
      state.trades = [];
      updateAuthUI();
      renderSignedOutMessage();
      clearLocalAuthStorage();
      window.location.reload();
    });
  }

  // Theme Toggle
  themeToggle.addEventListener('click', (e) => {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', state.theme);
    themeLabel.textContent = state.theme === 'light' ? 'Dark Mode' : 'Light Mode';
    localStorage.setItem('liquid_edge_theme', state.theme);
    addRipple(e, themeToggle);
  });

  // Sidebar navigation
  ['backtest', 'demo', 'real'].forEach((id) => {
    const btn = document.getElementById('nav-' + id);
    btn.addEventListener('click', (e) => {
      addRipple(e, btn);
      state.category = id;
      state.selectedFilter = id;
      setActiveFolderBtn(id);
      renderFilterPills();
      renderGallery();
    });
  });

  // Checklist toggles
  [1, 2, 3, 4].forEach((n) => {
    const track = document.getElementById('track' + n);
    const input = document.getElementById('chk' + n);
    const lbl = document.getElementById('chk' + n + '-lbl');

    function toggle() {
      const key = 'chk' + n;
      const val = !state.checklist[key];
      state.checklist[key] = val;
      input.checked = val;
      track.setAttribute('aria-checked', val);
      lbl.textContent = val ? 'Yes' : 'No';
      updateGuardian();
    }

    track.addEventListener('click', toggle);
    track.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        toggle();
      }
    });
  });

  // Mental vault red flag detection
  vaultText.addEventListener('input', () => {
    const txt = vaultText.value.toLowerCase();
    state.hasNotes = txt.trim().length > 0;
    state.redFlag = RED_FLAG_WORDS.some((w) => new RegExp('\\b' + w + '\\b').test(txt));

    if (state.redFlag) {
      vaultText.classList.add('red-flag');
      redFlagWarn.classList.add('visible');
      if (!state.isSaving) {
        saveBtn.style.background = 'linear-gradient(135deg, #ff2d55, #ff6b8a)';
      }
    } else {
      vaultText.classList.remove('red-flag');
      redFlagWarn.classList.remove('visible');
      if (!state.isSaving) {
        saveBtn.style.background = '';
      }
    }
    updateGuardian();
  });

  // Drop zone / upload
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') fileInput.click();
  });
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleImageFile(file);
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleImageFile(fileInput.files[0]);
  });

  // View toggle
  document.querySelectorAll('.view-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.selectedView = btn.dataset.view;
      document.querySelectorAll('.view-toggle').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderGallery();
    });
  });

  // Filter pills
  document.querySelectorAll('.filter-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      const folder = btn.dataset.folder;
      state.selectedFilter = folder;
      renderFilterPills();
      renderGallery();
    });
  });

  // Modal close
  modalCloseBtn.addEventListener('click', closeTradeModal);
  tradeModal.addEventListener('click', (e) => {
    if (e.target === tradeModal) closeTradeModal();
  });

  // Save
  saveBtn.addEventListener('click', async (e) => {
    if (state.redFlag) {
      saveBtn.style.background = 'linear-gradient(135deg, #ff2d55, #ff6b8a)';
      alert('Red Flag detected. Save blocked — reassess your trade plan first.');
      return;
    }

    addRipple(e, saveBtn);

    const orig = saveBtn.textContent;
    state.isSaving = true;
    saveBtn.disabled = true;

    try {
      await saveTrade();
      await refreshTradesAndRender();

      saveBtn.textContent = '✓ Entry Saved!';
      saveBtn.style.background = 'linear-gradient(135deg, var(--accent-green), #00d4a0)';

      document.getElementById('entryPrice').value = '';
      document.getElementById('exitPrice').value = '';
      document.getElementById('stopLoss').value = '';
      document.getElementById('takeProfit').value = '';
      vaultText.value = '';
      state.hasNotes = false;
      state.redFlag = false;
      vaultText.classList.remove('red-flag');
      redFlagWarn.classList.remove('visible');
      resetDropZone();
      setOutcome('win');
      updateGuardian();
    } catch (err) {
      alert(err.message || 'Save failed');
    } finally {
      setTimeout(() => {
        state.isSaving = false;
        saveBtn.textContent = orig;
        if (!state.redFlag) saveBtn.style.background = '';
        saveBtn.disabled = false;
      }, 2200);
    }
  });
})();

