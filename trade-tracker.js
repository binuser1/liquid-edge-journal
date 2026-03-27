// trade-tracker.js
class TradeTracker {
  constructor() {
    this.ws = null;
    this.trades = new Map(); // Track open trades by contract_id
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnect = 5;
    this.reconnectDelay = 5000;
    this.heartbeatInterval = null;
    this.currentPrice = null;
    this.currentSymbol = DERIV_CONFIG.default_symbol;
  }
  
  async connect(token) {
    try {
      console.log('[TradeTracker] Connecting to WebSocket...');
      
      // Close existing connection
      if (this.ws) {
        this.ws.close();
      }
      
      this.ws = new WebSocket(DERIV_CONFIG.websocket_url);
      
      this.ws.onopen = () => {
        console.log('[TradeTracker] WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        // Authorize with token
        this.send('authorize', { authorize: token });
        
        // Start heartbeat
        this.startHeartbeat();
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('[TradeTracker] Failed to parse message:', error);
        }
      };
      
      this.ws.onclose = (event) => {
        console.log('[TradeTracker] WebSocket closed:', event.code, event.reason);
        this.isConnected = false;
        this.stopHeartbeat();
        this.reconnect();
      };
      
      this.ws.onerror = (error) => {
        console.error('[TradeTracker] WebSocket error:', error);
      };
      
    } catch (error) {
      console.error('[TradeTracker] Connection failed:', error);
    }
  }
  
  send(method, data = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = { [method]: data };
      this.ws.send(JSON.stringify(message));
      console.log('[TradeTracker] Sent:', method, data);
    } else {
      console.warn('[TradeTracker] Cannot send - WebSocket not connected');
    }
  }
  
  handleMessage(data) {
    // Handle different message types
    if (data.error) {
      console.error('[TradeTracker] Error received:', data.error.message);
      return;
    }
    
    // Authorization response
    if (data.authorize) {
      console.log('[TradeTracker] Authorized successfully');
      this.subscribeToEvents();
      return;
    }
    
    // Ping/Pong for heartbeat
    if (data.ping) {
      this.send('pong');
      return;
    }
    
    // Open contract updates
    if (data.proposal_open_contract) {
      this.handleContractUpdate(data.proposal_open_contract);
    }
    
    // Transaction history
    if (data.transaction) {
      this.handleTransaction(data.transaction);
    }
    
    // Tick stream for price updates
    if (data.tick) {
      this.handleTick(data.tick);
    }
    
    // History stream for price updates
    if (data.history) {
      this.handleHistory(data.history);
    }
    
    // Balance updates
    if (data.balance) {
      this.handleBalance(data.balance);
    }
    
    // Portfolio updates (open positions)
    if (data.portfolio) {
      this.handlePortfolio(data.portfolio);
    }
  }
  
  subscribeToEvents() {
    // Subscribe to ticks for current symbol
    this.send('ticks', { 
      ticks: this.currentSymbol,
      subscribe: 1 
    });
    
    // Subscribe to open contracts
    this.send('proposal_open_contract', { 
      proposal_open_contract: 1,
      subscribe: 1 
    });
    
    // Subscribe to transactions
    this.send('transaction', { 
      transaction: 1,
      subscribe: 1 
    });
    
    // Subscribe to portfolio (open positions)
    this.send('portfolio', { 
      portfolio: 1,
      subscribe: 1 
    });
    
    // Get account info
    this.send('balance', { balance: 1, subscribe: 1 });
    
    console.log('[TradeTracker] Subscribed to all trade events');
  }
  
  handleTick(tick) {
    if (tick.symbol === this.currentSymbol) {
      this.currentPrice = parseFloat(tick.quote);
      
      // Update chart price display
      if (window.derivChart) {
        window.derivChart.updatePrice(this.currentPrice);
      }
      
      // Update open trades with current price
      this.updateOpenTradesWithPrice(this.currentPrice);
    }
  }
  
  handleHistory(history) {
    if (history.prices && history.prices.length > 0) {
      const latestPrice = parseFloat(history.prices[history.prices.length - 1]);
      this.currentPrice = latestPrice;
      
      if (window.derivChart) {
        window.derivChart.updatePrice(this.currentPrice);
      }
    }
  }
  
  handleContractUpdate(contract) {
    const contractId = contract.contract_id;
    
    if (contract.is_sold) {
      // Trade closed - process and save
      this.processClosedTrade(contract);
      this.trades.delete(contractId);
    } else if (contract.is_valid_to_buy) {
      // New trade opened
      this.trades.set(contractId, {
        contract_id: contractId,
        entry_price: parseFloat(contract.entry_price || contract.buy_price),
        buy_price: parseFloat(contract.buy_price),
        symbol: contract.underlying,
        type: contract.contract_type.includes('CALL') ? 'BUY' : 'SELL',
        stake: parseFloat(contract.buy_price),
        opened: new Date(contract.purchase_time * 1000),
        barrier: contract.barrier,
        expiry: new Date(contract.date_expiry * 1000)
      });
      
      console.log('[TradeTracker] Trade opened:', contractId);
      this.updateTradeStatus('Position Open');
    }
  }
  
  handleTransaction(transaction) {
    // Log transactions for debugging
    if (transaction.action_type === 'buy' || transaction.action_type === 'sell') {
      console.log('[TradeTracker] Transaction:', transaction.action_type, transaction.amount);
    }
  }
  
  handleBalance(balance) {
    // Update account balance display if needed
    console.log('[TradeTracker] Balance updated:', balance.balance);
  }
  
  handlePortfolio(portfolio) {
    // Portfolio gives real-time updates on open positions
    if (portfolio.contracts) {
      portfolio.contracts.forEach(contract => {
        if (!contract.is_sold) {
          this.updateOpenTradeProfitLoss(contract);
        }
      });
    }
  }
  
  updateOpenTradesWithPrice(currentPrice) {
    this.trades.forEach(trade => {
      // Calculate unrealized P&L
      const priceDiff = trade.type === 'BUY' 
        ? currentPrice - trade.entry_price
        : trade.entry_price - currentPrice;
      
      trade.unrealized_pnl = priceDiff;
      trade.current_price = currentPrice;
    });
  }
  
  updateOpenTradeProfitLoss(contract) {
    const trade = this.trades.get(contract.contract_id);
    if (trade) {
      trade.current_price = parseFloat(contract.current_spot);
      trade.unrealized_pnl = parseFloat(contract.current_spot) - trade.entry_price;
      
      // Update status with P&L
      const pnlPercent = ((trade.unrealized_pnl / trade.stake) * 100).toFixed(2);
      this.updateTradeStatus(`P&L: ${pnlPercent}%`);
    }
  }
  
  updateTradeStatus(status) {
    if (window.derivChart) {
      window.derivChart.updateStatus(status);
    }
  }
  
  async processClosedTrade(contract) {
    const trade = this.trades.get(contract.contract_id);
    if (!trade) return;
    
    // Calculate final P&L
    const profitLoss = parseFloat(contract.sell_price) - trade.buy_price;
    const outcome = profitLoss > 0 ? 'win' : 'loss';
    
    // Create trade entry for journal
    const tradeEntry = {
      market: contract.underlying,
      category: 'synthetic',
      entry_price: trade.entry_price,
      exit_price: parseFloat(contract.exit_price || contract.sell_price),
      profit_loss: profitLoss,
      outcome: outcome,
      notes: `Auto-journaled ${trade.type} trade | ` +
              `Duration: ${Math.round((contract.sell_time - contract.purchase_time) / 1000)}s | ` +
              `Stake: ${trade.stake} | P&L: ${profitLoss.toFixed(2)}`,
      auto_trade: true,
      contract_id: contract.contract_id,
      chart_path: null, // No image for auto trades
      created_at: new Date(contract.sell_time * 1000).toISOString()
    };
    
    // Save to Supabase
    try {
      if (window.saveTradeToSupabase) {
        await window.saveTradeToSupabase(tradeEntry);
        console.log('[TradeTracker] Trade auto-saved:', tradeEntry);
        
        // Update UI
        if (window.refreshTradesAndRender) {
          await window.refreshTradesAndRender();
        }
        
        // Show notification
        this.showTradeNotification(tradeEntry);
      }
    } catch (error) {
      console.error('[TradeTracker] Failed to save trade:', error);
    }
    
    this.updateTradeStatus('Position Closed');
  }
  
  showTradeNotification(trade) {
    // Create a notification element
    const notification = document.createElement('div');
    notification.className = `trade-notification ${trade.outcome}`;
    notification.innerHTML = `
      <div class="notification-content">
        <h4>Trade Auto-Saved</h4>
        <p>${trade.market} - ${trade.outcome.toUpperCase()}</p>
        <p>P&L: ${trade.profit_loss > 0 ? '+' : ''}${trade.profit_loss.toFixed(2)}</p>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
  
  openTrade(type, stake = 10, duration = '5t') {
    if (!this.isConnected) {
      console.error('[TradeTracker] Not connected');
      return;
    }
    
    // Get current price for barrier
    if (!this.currentPrice) {
      console.error('[TradeTracker] No current price available');
      return;
    }
    
    // Create contract proposal
    const proposal = {
      proposal: 1,
      amount: stake,
      barrier: 0, // No barrier for simple trades
      basis: 'stake',
      contract_type: type === 'BUY' ? 'CALL' : 'PUT',
      currency: 'USD',
      duration: parseInt(duration),
      duration_unit: duration.includes('t') ? 't' : 's',
      symbol: this.currentSymbol
    };
    
    this.send('proposal', proposal);
  }
  
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.send('ping');
      }
    }, 30000); // Ping every 30 seconds
  }
  
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
  
  reconnect() {
    if (this.reconnectAttempts < this.maxReconnect) {
      this.reconnectAttempts++;
      console.log(`[TradeTracker] Reconnecting... (${this.reconnectAttempts}/${this.maxReconnect})`);
      
      setTimeout(() => {
        const token = localStorage.getItem(DERIV_CONFIG.storage_keys.token);
        if (token) {
          this.connect(token);
        }
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('[TradeTracker] Max reconnection attempts reached');
      this.updateTradeStatus('Connection Lost');
    }
  }
  
  changeSymbol(newSymbol) {
    if (newSymbol !== this.currentSymbol) {
      this.currentSymbol = newSymbol;
      
      if (this.isConnected) {
        // Unsubscribe from old symbol
        this.send('forget_all', { forget_all: 'ticks' });
        
        // Subscribe to new symbol
        this.send('ticks', { 
          ticks: newSymbol,
          subscribe: 1 
        });
      }
    }
  }
  
  disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.trades.clear();
  }
}
