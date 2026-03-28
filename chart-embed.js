// chart-embed.js
// SmartTrader bundle at smarttrader.deriv.com/dist/main.js is no longer available (404).
// Live view uses tick data from TradeTracker (same WebSocket authorize flow).
class DerivChart {
  constructor(containerId, symbol) {
    this.container = document.getElementById(containerId);
    this.symbol = symbol || DERIV_CONFIG.default_symbol;
    this.chart = null;
    this.canvas = null;
    this.ctx = null;
    this.priceHistory = [];
    this.maxPoints = 180;
    this._logicalW = 0;
    this._logicalH = 0;
    this._resizeObserver = null;
    this.isConnected = false;
    this.init();
  }

  handleResize() {
    if (!this.canvas || !this.container) return;
    const rect = this.container.getBoundingClientRect();
    const w = Math.max(200, Math.floor(rect.width));
    const h = Math.max(200, Math.floor(rect.height));
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._logicalW = w;
    this._logicalH = h;
    this.redraw();
  }

  redraw() {
    if (!this.ctx || !this._logicalW) return;
    const w = this._logicalW;
    const h = this._logicalH;
    const ctx = this.ctx;
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const bg = isLight ? '#eef1f5' : '#141820';
    const grid = isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.06)';
    const lineCol = isLight ? '#2563eb' : '#60a5fa';
    const textCol = isLight ? '#475569' : '#94a3b8';

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = 8 + (i / 4) * (h - 56);
      ctx.beginPath();
      ctx.moveTo(12, y);
      ctx.lineTo(w - 12, y);
      ctx.stroke();
    }

    ctx.fillStyle = textCol;
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(this.symbol, 14, 22);

    if (this.priceHistory.length < 2) {
      ctx.font = '14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Waiting for live ticks…', w / 2, h / 2);
      return;
    }

    const prices = this.priceHistory.map((p) => p.price);
    let min = Math.min(...prices);
    let max = Math.max(...prices);
    const span = max - min || Math.abs(min) * 0.0001 || 1;
    const pad = span * 0.12;
    min -= pad;
    max += pad;

    const left = 12;
    const right = w - 12;
    const top = 36;
    const bottom = h - 20;
    const plotH = bottom - top;
    const n = this.priceHistory.length;

    ctx.beginPath();
    ctx.strokeStyle = lineCol;
    ctx.lineWidth = 2;
    this.priceHistory.forEach((pt, i) => {
      const x = left + (i / (n - 1)) * (right - left);
      const y = bottom - ((pt.price - min) / (max - min)) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    const last = this.priceHistory[n - 1].price;
    ctx.fillStyle = textCol;
    ctx.font = '13px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(last.toFixed(2), right, top - 8);
  }
  
  async init() {
    try {
      if (!this.container) {
        throw new Error('Chart container not found');
      }

      this.container.innerHTML = '';
      const surface = document.createElement('div');
      surface.className = 'deriv-chart-surface';
      this.canvas = document.createElement('canvas');
      surface.appendChild(this.canvas);
      this.container.appendChild(surface);

      this._resizeObserver = new ResizeObserver(() => this.handleResize());
      this._resizeObserver.observe(this.container);
      this.handleResize();

      this.setupTradeControls();
      this.observeThemeChanges();

      this.isConnected = true;
      console.log('[DerivChart] Live tick chart ready for', this.symbol);
    } catch (error) {
      console.error('[DerivChart] Failed to initialize:', error);
      this.container.innerHTML = `
        <div class="chart-error">
          <h3>Chart Failed to Load</h3>
          <p>Something went wrong setting up the chart. Try refreshing the page.</p>
          <button onclick="location.reload()" class="retry-btn">Retry</button>
        </div>
      `;
    }
  }
  
  setupTradeControls() {
    // Create buy/sell controls overlay
    const controls = document.createElement('div');
    controls.className = 'chart-trade-controls';
    controls.innerHTML = `
      <div class="trade-buttons">
        <button id="deriv-buy" class="trade-btn buy">
          <span class="btn-icon">▲</span>
          <span class="btn-text">BUY</span>
        </button>
        <button id="deriv-sell" class="trade-btn sell">
          <span class="btn-icon">▼</span>
          <span class="btn-text">SELL</span>
        </button>
      </div>
      <div class="trade-info">
        <div class="price-display">
          <span class="price-label">Current:</span>
          <span id="current-price" class="price-value">--</span>
        </div>
        <div class="status-display">
          <span id="trade-status" class="status-value">Ready</span>
        </div>
      </div>
    `;
    
    this.container.appendChild(controls);
    
    // Add click handlers
    document.getElementById('deriv-buy').addEventListener('click', () => {
      if (!this.isBlocked()) {
        window.openDerivTrade('BUY');
      }
    });
    
    document.getElementById('deriv-sell').addEventListener('click', () => {
      if (!this.isBlocked()) {
        window.openDerivTrade('SELL');
      }
    });
    
    // Subscribe to price updates (will be handled by trade-tracker.js)
    this.subscribeToPriceUpdates();
  }
  
  isBlocked() {
    return document.getElementById('deriv-buy')?.disabled || false;
  }
  
  subscribeToPriceUpdates() {
    // Price updates will be handled by the TradeTracker WebSocket
    // This is a placeholder for price update logic
    if (window.tradeTracker && window.tradeTracker.isConnected) {
      console.log('[DerivChart] Subscribed to price updates');
    }
  }
  
  updatePrice(price) {
    const priceElement = document.getElementById('current-price');
    if (priceElement && price != null && Number.isFinite(Number(price))) {
      const n = Number(price);
      priceElement.textContent = n.toFixed(2);

      priceElement.classList.add('price-updated');
      setTimeout(() => priceElement.classList.remove('price-updated'), 300);

      this.priceHistory.push({ t: Date.now(), price: n });
      if (this.priceHistory.length > this.maxPoints) {
        this.priceHistory.shift();
      }
      this.redraw();
    }
  }
  
  updateStatus(status, type = 'info') {
    const statusElement = document.getElementById('trade-status');
    if (statusElement) {
      statusElement.textContent = status;
      statusElement.className = `status-value status-${type}`;
    }
  }
  
  observeThemeChanges() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          this.redraw();
        }
      });
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
  }
  
  updateSymbol(newSymbol) {
    if (newSymbol && newSymbol !== this.symbol) {
      this.symbol = newSymbol;
      this.priceHistory = [];
      this.redraw();
      console.log('[DerivChart] Changed symbol to', newSymbol);
    }
  }
  
  blockTrading(message = 'Trading blocked by Guardian') {
    const buyBtn = document.getElementById('deriv-buy');
    const sellBtn = document.getElementById('deriv-sell');
    
    if (buyBtn) {
      buyBtn.disabled = true;
      buyBtn.classList.add('blocked');
    }
    
    if (sellBtn) {
      sellBtn.disabled = true;
      sellBtn.classList.add('blocked');
    }
    
    this.updateStatus(message, 'blocked');
  }
  
  unblockTrading() {
    const buyBtn = document.getElementById('deriv-buy');
    const sellBtn = document.getElementById('deriv-sell');
    
    if (buyBtn) {
      buyBtn.disabled = false;
      buyBtn.classList.remove('blocked');
    }
    
    if (sellBtn) {
      sellBtn.disabled = false;
      sellBtn.classList.remove('blocked');
    }
    
    this.updateStatus('Ready', 'info');
  }
  
  destroy() {
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
    this.chart = null;
    this.canvas = null;
    this.ctx = null;
    this.isConnected = false;
  }
}
