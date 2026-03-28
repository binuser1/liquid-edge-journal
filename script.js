
(() => {
  const RED_FLAG_WORDS = ['felt', 'feel', 'hope', 'scared', 'fear', 'emotional', 'gamble', 'revenge', 'praying', 'pray', 'fomo', 'rushed', 'rush', 'rushing'];
  const MARKETS = ['VIX 10','VIX 10s','VIX 25','VIX 50','VIX 75','VIX 100','VIX 10 (1s)','VIX 25 (1s)','VIX 50 (1s)','VIX 75 (1s)','VIX 100 (1s)'];
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  /** True when served by `python app.py` (Flask): SQLite + files in ./uploads */
  const USE_LOCAL_BACKEND =
    window.location.port === '5000' ||
    new URLSearchParams(window.location.search).get('local') === '1';
  window.__LIQUID_EDGE_LOCAL__ = USE_LOCAL_BACKEND;

  let firestoreDb;
  let firebaseStorage;
  let firebaseAppInited = false;

  function firebaseConfigured() {
    const c = window.FIREBASE_CONFIG;
    return !!(c && c.apiKey && !String(c.apiKey).includes('YOUR_API_KEY'));
  }

  function ensureFirebase() {
    if (typeof firebase === 'undefined') throw new Error('Firebase SDK failed to load');
    if (!firebaseConfigured()) throw new Error('Edit firebase-config.js with your Firebase web app keys');
    if (!firebaseAppInited) {
      firebase.initializeApp(window.FIREBASE_CONFIG);
      firebaseAppInited = true;
      firestoreDb = firebase.firestore();
      firebaseStorage = firebase.storage();
    }
  }

  function docCreatedAtToIso(val) {
    if (!val) return new Date().toISOString();
    if (typeof val === 'string') return val;
    if (val.toDate) return val.toDate().toISOString();
    return new Date(val).toISOString();
  }

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
  const saveStatus = document.getElementById('saveStatus');

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
    if (mime.startsWith('image/')) {
      const map = { png: 'png', jpg: 'jpg', jpeg: 'jpg', gif: 'gif', webp: 'webp' };
      return Object.keys(map).find(k => mime.includes(k)) || 'png';
    }
    return 'png';
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to convert image to base64'));
      reader.readAsDataURL(file);
    });
  }

  function setAuthStatus(text) {
    if (authStatus) authStatus.textContent = text;
  }

  function showSaveStatus(msg, type) {
    if (!saveStatus) return;
    saveStatus.textContent = msg;
    saveStatus.className = 'save-status ' + (type || '');
    if (type === 'success') {
      setTimeout(() => {
        saveStatus.textContent = '';
        saveStatus.className = 'save-status';
      }, 3000);
    }
  }

  async function withRetry(action, retries = 2) {
    let lastErr;
    for (let i = 0; i <= retries; i += 1) {
      try {
        return await action();
      } catch (err) {
        lastErr = err;
        if (i === retries) throw err;
        await new Promise((resolve) => setTimeout(resolve, 200 * (i + 1)));
      }
    }
    throw lastErr;
  }

  function updateAuthUI() {
    if (USE_LOCAL_BACKEND) {
      setAuthStatus('Local mode: SQLite (trades.db) + images in uploads/');
      if (signInBtn) signInBtn.disabled = true;
      if (signUpBtn) signUpBtn.disabled = true;
      if (signOutBtn) signOutBtn.disabled = true;
      return;
    }
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
    // Legacy Supabase keys (safe to clear after migrating to Firebase)
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith('sb-')) localStorage.removeItem(k);
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
    if (USE_LOCAL_BACKEND) {
      const res = await fetch('/api/trades');
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || 'Failed to load trades');
      }
      const json = await res.json();
      const rows = json.trades || [];
      state.trades = rows.map((t) => {
        const imageUrl = t.image_url
          ? new URL(t.image_url, window.location.origin).href
          : null;
        const pathFromUrl =
          t.image_url && t.image_url.startsWith('/uploads/')
            ? t.image_url.slice('/uploads/'.length)
            : null;
        return {
          id: t.id,
          created_at: t.created_at,
          market: t.market,
          category: t.category,
          chk1: !!t.chk1,
          chk2: !!t.chk2,
          chk3: !!t.chk3,
          chk4: !!t.chk4,
          notes: t.notes || '',
          entry_price: t.entry_price,
          exit_price: t.exit_price,
          stop_loss: t.stop_loss,
          take_profit: t.take_profit,
          outcome: t.outcome,
          chart_path: pathFromUrl,
          image_signed_url: imageUrl,
        };
      });
      return;
    }

    if (!state.user) {
      state.trades = [];
      return;
    }

    ensureFirebase();
    const snap = await withRetry(() =>
      firestoreDb.collection('trades').where('userId', '==', state.user.id).get()
    );
    const rows = [];
    snap.forEach((doc) => rows.push({ id: doc.id, ...doc.data() }));
    rows.sort(
      (a, b) =>
        new Date(docCreatedAtToIso(b.created_at)).getTime() -
        new Date(docCreatedAtToIso(a.created_at)).getTime()
    );

    state.trades = rows.map((row) => ({
      id: row.id,
      created_at: docCreatedAtToIso(row.created_at),
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
      chart_path: null, // Not using storage anymore
      image_signed_url: row.chartBase64 || null, // Use base64 image directly
    }));
  }

  function renderGallery() {
    const filtered = state.trades.filter((trade) => {
      if (state.selectedFilter !== 'all' && trade.category !== state.selectedFilter) return false;
      // Use local time — UTC dates shift month for users in timezones ahead of UTC
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
      const monthName = MONTHS[state.selectedMonth];
      let msg;
      if (state.trades.length === 0) {
        msg = 'No trades recorded yet. Start trading! 🚀';
      } else {
        const folderPart =
          state.selectedFilter !== 'all'
            ? ` for <strong>${state.selectedFilter}</strong>`
            : '';
        const hint =
          state.selectedFilter !== 'all'
            ? ' Try <strong>All</strong> or pick the matching sidebar folder (Back / Demo / Real).'
            : ' Try another month in the timeline above — your entries may be in a different month.';
        msg = `No trades in <strong>${monthName}</strong>${folderPart}.${hint}`;
      }
      tradeGallery.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px 20px;color:var(--text-secondary);">${msg}</div>`;
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

    if (USE_LOCAL_BACKEND) {
      const res = await fetch(`/api/trades/${encodeURIComponent(trade.id)}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || res.statusText || 'Delete failed');
        return;
      }
      await refreshTradesAndRender();
      closeTradeModal();
      return;
    }

    if (!state.user) {
      alert('Sign in required');
      return;
    }

    ensureFirebase();
    // No need to delete from storage since images are stored as base64 in the document

    await withRetry(() => firestoreDb.collection('trades').doc(String(trade.id)).delete());

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
    if (USE_LOCAL_BACKEND) {
      const fd = new FormData();
      fd.append('market', state.market);
      fd.append('category', state.category);
      fd.append('notes', vaultText.value || '');
      fd.append('chk1', state.checklist.chk1 ? '1' : '0');
      fd.append('chk2', state.checklist.chk2 ? '1' : '0');
      fd.append('chk3', state.checklist.chk3 ? '1' : '0');
      fd.append('chk4', state.checklist.chk4 ? '1' : '0');
      const ep = document.getElementById('entryPrice').value;
      const xp = document.getElementById('exitPrice').value;
      const sl = document.getElementById('stopLoss').value;
      const tp = document.getElementById('takeProfit').value;
      if (ep.trim()) fd.append('entry_price', ep.trim());
      if (xp.trim()) fd.append('exit_price', xp.trim());
      if (sl.trim()) fd.append('stop_loss', sl.trim());
      if (tp.trim()) fd.append('take_profit', tp.trim());
      fd.append('outcome', state.outcome);
      if (state.chartFile) {
        fd.append('image', state.chartFile, state.chartFile.name);
      }
      const res = await fetch('/api/trades', { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || res.statusText || 'Failed to save trade');
      }
      return;
    }

    if (!state.user) throw new Error('Please sign in to save trades');

    ensureFirebase();
    const uid = state.user.id;

    // Convert image to base64 if present
    let chartBase64 = null;
    if (state.chartFile) {
      chartBase64 = await fileToBase64(state.chartFile);
    }

    const docRef = await withRetry(() =>
      firestoreDb.collection('trades').add({
        userId: uid,
        created_at: firebase.firestore.FieldValue.serverTimestamp(),
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
        chartBase64: chartBase64, // Store image as base64 directly in Firestore
      })
    );
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
      if (USE_LOCAL_BACKEND) {
        state.user = { id: 'local', email: 'local@localhost' };
        updateAuthUI();
        await refreshTradesAndRender();
      } else if (!firebaseConfigured()) {
        setAuthStatus('Add your Firebase keys in firebase-config.js');
        tradeGallery.innerHTML =
          '<div style="grid-column:1/-1;text-align:center;padding:40px 20px;color:var(--text-secondary);">Copy firebase-config.example.js to firebase-config.js and paste your Firebase web app config from the Firebase Console.</div>';
      } else {
        ensureFirebase();
        firebase.auth().onAuthStateChanged(async (user) => {
          state.user = user ? { id: user.uid, email: user.email } : null;
          updateAuthUI();
          if (state.user) {
            if (!state.isSaving) {
              try {
                await refreshTradesAndRender();
              } catch (e) {
                tradeGallery.innerHTML =
                  `<div style="grid-column:1/-1;text-align:center;padding:40px 20px;color:var(--text-secondary);">Failed to load trades: ${e.message || 'Unknown error'}</div>`;
              }
            }
          } else {
            state.trades = [];
            renderGallery();
            renderSignedOutMessage();
          }
        });
      }
    } catch (e) {
      tradeGallery.innerHTML =
        `<div style="grid-column:1/-1;text-align:center;padding:40px 20px;color:var(--text-secondary);">Failed to initialize: ${e.message || 'Unknown error'}</div>`;
    }
  });

  // Save
  function onSaveClick(e) {
    console.log('[LiquidEdge] Save clicked');
    if (state.redFlag) {
      saveBtn.style.background = 'linear-gradient(135deg, #ff2d55, #ff6b8a)';
      showSaveStatus('🚨 Red Flag detected. Save blocked — reassess your trade plan first.', 'error');
      return;
    }

    addRipple(e, saveBtn);

    const orig = saveBtn.textContent;
    state.isSaving = true;
    saveBtn.disabled = true;

    (async () => {
      try {
        await saveTrade();
        // New rows use “now”; if the timeline was on another month, the card would seem to disappear.
        state.selectedMonth = new Date().getMonth();
        renderTimeline();
        await refreshTradesAndRender();

        saveBtn.textContent = '✓ Entry Saved!';
        saveBtn.style.background = 'linear-gradient(135deg, var(--accent-green), #00d4a0)';
        showSaveStatus('✓ Trade saved successfully!', 'success');

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
        const msg = err.message || 'Save failed';
        console.error('[LiquidEdge] Save error:', msg, err);
        showSaveStatus('⚠ ' + msg, 'error');
        saveBtn.textContent = '⚠ ' + msg.substring(0, 35);
        saveBtn.style.background = 'linear-gradient(135deg,#ff2d55,#ff6b8a)';
      } finally {
        state.isSaving = false;
        saveBtn.disabled = false;
        setTimeout(() => {
          if (saveBtn.textContent !== orig) {
            saveBtn.textContent = orig;
          }
          if (!state.redFlag) saveBtn.style.background = '';
        }, 2200);
      }
    })();
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', onSaveClick);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      const btn = document.getElementById('saveBtn');
      if (btn) btn.addEventListener('click', onSaveClick);
    });
  }

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
      if (USE_LOCAL_BACKEND || !firebaseConfigured()) return;
      const email = (authEmail?.value || '').trim();
      const password = (authPassword?.value || '').trim();
      if (!email || !password) {
        alert('Enter email and password');
        return;
      }
      setAuthStatus('Signing in...');
      try {
        ensureFirebase();
        await firebase.auth().signInWithEmailAndPassword(email, password);
      } catch (e) {
        alert(e.message || 'Sign in failed');
        updateAuthUI();
      }
    });
  }

  if (signUpBtn) {
    signUpBtn.addEventListener('click', async () => {
      if (USE_LOCAL_BACKEND || !firebaseConfigured()) return;
      const email = (authEmail?.value || '').trim();
      const password = (authPassword?.value || '').trim();
      if (!email || !password) {
        alert('Enter email and password');
        return;
      }
      setAuthStatus('Creating account...');
      try {
        ensureFirebase();
        await firebase.auth().createUserWithEmailAndPassword(email, password);
        alert('Account created. You can sign in if email verification is required by your Firebase settings.');
      } catch (e) {
        alert(e.message || 'Sign up failed');
        updateAuthUI();
        return;
      }
      updateAuthUI();
    });
  }

  if (signOutBtn) {
    signOutBtn.addEventListener('click', async () => {
      if (USE_LOCAL_BACKEND) return;
      setAuthStatus('Signing out...');
      clearLocalAuthStorage();
      try {
        ensureFirebase();
        await firebase.auth().signOut();
      } catch (_) {}
      state.user = null;
      state.trades = [];
      updateAuthUI();
      renderSignedOutMessage();
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
      // Keep save category and sidebar aligned with the folder filter (avoids saving Demo while viewing Backtest filter).
      if (folder !== 'all') {
        state.category = folder;
        setActiveFolderBtn(folder);
      }
      renderFilterPills();
      renderGallery();
    });
  });

  // Modal close
  modalCloseBtn.addEventListener('click', closeTradeModal);
  tradeModal.addEventListener('click', (e) => {
    if (e.target === tradeModal) closeTradeModal();
  });

  window.showSaveStatus = showSaveStatus;
  window.refreshTradesAndRender = refreshTradesAndRender;

  window.saveTradeToSupabase = async function (trade) {
    if (USE_LOCAL_BACKEND || window.__LIQUID_EDGE_LOCAL__) {
      console.warn('[Deriv] Auto-journal disabled in local Flask mode.');
      return;
    }
    if (!firebaseConfigured()) {
      console.warn('[Deriv] Configure firebase-config.js for auto-journal.');
      return;
    }
    if (!state.user) {
      console.warn('[Deriv] User not logged in, cannot save trade');
      return;
    }
    ensureFirebase();
    await firestoreDb.collection('trades').add({
      userId: state.user.id,
      created_at: firebase.firestore.FieldValue.serverTimestamp(),
      market: trade.market,
      category: trade.category || 'synthetic',
      entry_price: trade.entry_price,
      exit_price: trade.exit_price,
      stop_loss: null,
      take_profit: null,
      outcome: trade.outcome,
      notes: trade.notes || '',
      chk1: false,
      chk2: false,
      chk3: false,
      chk4: false,
      auto_trade: true,
      chartBase64: null, // Auto trades don't have charts
    });
  };

  // Initialize Deriv components after DOM is ready
  initializeDerivIntegration();
})();

// Deriv Integration Functions
function initializeDerivIntegration() {
  // Wait for all scripts to load
  if (!window.DERIV_CONFIG) {
    setTimeout(initializeDerivIntegration, 100);
    return;
  }

  // Initialize Guardian Bridge
  if (typeof GuardianBridge !== 'undefined') {
    window.guardianBridge = new GuardianBridge();
    window.guardianBridge.init();
  }

  // Set up Deriv connection button
  const connectBtn = document.getElementById('connect-deriv');
  const statusDiv = document.getElementById('deriv-status');
  
  if (connectBtn) {
    connectBtn.addEventListener('click', connectDerivAccount);
  }

  // Check if already authorized
  const token = localStorage.getItem(DERIV_CONFIG.storage_keys.token);
  if (token) {
    statusDiv.textContent = 'Connected';
    statusDiv.className = 'deriv-status connected';
    connectBtn.textContent = 'Connected';
    connectBtn.disabled = true;
    
    // Initialize chart and tracker
    initializeChartAndTracker(token);
  }

  // Symbol selector
  const symbolSelector = document.getElementById('symbol-selector');
  if (symbolSelector) {
    symbolSelector.addEventListener('change', (e) => {
      if (window.derivChart) {
        window.derivChart.updateSymbol(e.target.value);
      }
      if (window.tradeTracker) {
        window.tradeTracker.changeSymbol(e.target.value);
      }
    });
  }
}

async function connectDerivAccount() {
  const connectBtn = document.getElementById('connect-deriv');
  const statusDiv = document.getElementById('deriv-status');
  
  try {
    statusDiv.textContent = 'Connecting...';
    statusDiv.className = 'deriv-status';
    connectBtn.disabled = true;

    // Demo app_id 1089 does not support custom callback URIs reliably.
    // Fall back to direct API token flow so live tracking can still work.
    if (DERIV_CONFIG.app_id === '1089') {
      const token = await promptForDerivToken();
      if (!token) {
        throw new Error('No API token entered');
      }
      await finalizeDerivConnection(token, connectBtn, statusDiv);
      return;
    }
    
    // Build OAuth URL
    const authUrl = `${DERIV_CONFIG.oauth_url}?app_id=${DERIV_CONFIG.app_id}&l=en&redirect_uri=${encodeURIComponent(DERIV_CONFIG.redirect_uri)}&response_type=code`;
    
    // Open popup for OAuth
    const popup = window.open(
      authUrl,
      'deriv-auth',
      'width=500,height=600,scrollbars=yes,resizable=yes'
    );
    
    // Listen for token from popup
    const messageHandler = async (event) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data.type === 'DERIV_AUTH_SUCCESS') {
        const token = event.data.token;
        await finalizeDerivConnection(token, connectBtn, statusDiv);
        
        // Clean up
        window.removeEventListener('message', messageHandler);
        popup.close();
        
        console.log('[Deriv] Successfully connected');
      }
    };
    
    window.addEventListener('message', messageHandler);
    
    // Check if popup was blocked
    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      throw new Error('Popup was blocked. Please allow popups for this site.');
    }
    
  } catch (error) {
    console.error('[Deriv] Connection failed:', error);
    statusDiv.textContent = 'Connection failed';
    statusDiv.className = 'deriv-status error';
    connectBtn.disabled = false;
    
    // Show error to user
    window.showSaveStatus('Failed to connect: ' + error.message, 'error');
  }
}

async function finalizeDerivConnection(token, connectBtn, statusDiv) {
  localStorage.setItem(DERIV_CONFIG.storage_keys.token, token);
  localStorage.setItem(DERIV_CONFIG.storage_keys.authorized, 'true');

  statusDiv.textContent = 'Connected';
  statusDiv.className = 'deriv-status connected';
  connectBtn.innerHTML = '<span class="btn-icon">✓</span><span class="btn-text">Connected</span>';
  connectBtn.disabled = true;

  await initializeChartAndTracker(token);
}

async function promptForDerivToken() {
  const token = window.prompt(
    'Paste your Deriv API token (create it in Deriv Settings > API Token).',
    ''
  );

  if (!token) return null;

  const trimmed = token.trim();
  if (!trimmed) return null;

  await validateDerivToken(trimmed);
  return trimmed;
}

async function validateDerivToken(token) {
  const wsUrl = DERIV_CONFIG.websocket_url.includes('app_id=')
    ? DERIV_CONFIG.websocket_url
    : `${DERIV_CONFIG.websocket_url}${DERIV_CONFIG.websocket_url.includes('?') ? '&' : '?'}app_id=${encodeURIComponent(DERIV_CONFIG.app_id)}`;

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Deriv token validation timed out'));
    }, 10000);

    ws.onopen = () => {
      ws.send(JSON.stringify({ authorize: token }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.error) {
        clearTimeout(timeout);
        ws.close();
        reject(new Error(data.error.message || 'Invalid Deriv token'));
        return;
      }
      if (data.authorize) {
        clearTimeout(timeout);
        ws.close();
        resolve();
      }
    };

    ws.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('Unable to validate token with Deriv'));
    };
  });
}

async function initializeChartAndTracker(token) {
  try {
    // Initialize chart
    if (typeof DerivChart !== 'undefined') {
      window.derivChart = new DerivChart('deriv-chart-container', DERIV_CONFIG.default_symbol);
    }
    
    // Initialize trade tracker
    if (typeof TradeTracker !== 'undefined') {
      window.tradeTracker = new TradeTracker();
      await window.tradeTracker.connect(token);
    }
    
    console.log('[Deriv] Chart and tracker initialized');
  } catch (error) {
    console.error('[Deriv] Failed to initialize:', error);
    window.showSaveStatus('Failed to initialize chart: ' + error.message, 'error');
  }
}

// Global function to open trades (called from chart buttons)
window.openDerivTrade = async function(type) {
  if (!window.tradeTracker || !window.tradeTracker.isConnected) {
    window.showSaveStatus('Please connect to Deriv first', 'error');
    return;
  }
  
  // Check Guardian
  if (window.guardianBridge && window.guardianBridge.isBlocking) {
    window.showSaveStatus('Trading blocked by Guardian', 'error');
    return;
  }
  
  try {
    // Open trade with default stake (you can make this configurable)
    window.tradeTracker.openTrade(type, 10, '5t');
    console.log(`[Deriv] Opening ${type} trade`);
  } catch (error) {
    console.error('[Deriv] Failed to open trade:', error);
    window.showSaveStatus('Failed to open trade: ' + error.message, 'error');
  }
};

// Handle OAuth callback on page load
window.addEventListener('load', () => {
  // Check if we're returning from OAuth
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  
  if (code && !window.opener) {
    // We're in the callback window
    // The deriv-callback.html will handle this
    console.log('[Deriv] OAuth callback detected');
  }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (window.tradeTracker) {
    window.tradeTracker.disconnect();
  }
});

