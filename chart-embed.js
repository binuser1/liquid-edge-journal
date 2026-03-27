// chart-embed.js
class DerivChart {
  constructor(containerId, symbol) {
    this.container = document.getElementById(containerId);
    this.symbol = symbol || DERIV_CONFIG.default_symbol;
    this.chart = null;
    this.isConnected = false;
    this.init();
  }
  
  async init() {
    try {
      // Show loading state
      this.container.innerHTML = '<div class="chart-loading">Loading chart...</div>';
      
      // Load Deriv chart script
      await this.loadChartScript();
      
      // Initialize chart
      this.chart = new SmartChart({
        container: this.container,
        symbol: this.symbol,
        theme: document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark',
        locale: 'en',
        overlays: [],
        studyMarket: ['synthetic_index'],
        timePeriod: '1t', // 1 tick for synthetic indices
        chartType: 'candlestick',
        enableDrawing: true,
        enableIndicators: true,
        height: 500
      });
      
      // Add event listeners
      this.setupTradeControls();
      
      // Monitor theme changes
      this.observeThemeChanges();
      
      this.isConnected = true;
      console.log('[DerivChart] Chart initialized for', this.symbol);
      
    } catch (error) {
      console.error('[DerivChart] Failed to initialize:', error);
      this.container.innerHTML = `
        <div class="chart-error">
          <h3>Chart Failed to Load</h3>
          <p>Please check your connection and Deriv authorization</p>
          <button onclick="location.reload()" class="retry-btn">Retry</button>
        </div>
      `;
    }
  }
  
  loadChartScript() {
    return new Promise((resolve, reject) => {
      if (window.SmartChart) {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://smarttrader.deriv.com/dist/main.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load SmartChart script'));
      document.head.appendChild(script);
    });
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
    if (priceElement && price) {
      priceElement.textContent = price.toFixed(2);
      
      // Add animation for price change
      priceElement.classList.add('price-updated');
      setTimeout(() => priceElement.classList.remove('price-updated'), 300);
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
          const theme = document.documentElement.getAttribute('data-theme');
          if (this.chart && this.chart.setTheme) {
            this.chart.setTheme(theme === 'light' ? 'light' : 'dark');
          }
        }
      });
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
  }
  
  updateSymbol(newSymbol) {
    if (this.chart && newSymbol !== this.symbol) {
      this.symbol = newSymbol;
      this.chart.changeSymbol(newSymbol);
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
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
    this.isConnected = false;
  }
}
