// guardian-bridge.js
class GuardianBridge {
  constructor() {
    // Red flag words that block trading
    this.redFlagWords = [
      'fomo', 'revenge', 'scared', 'greedy', 'impulsive',
      'chasing', 'panic', 'desperate', 'angry', 'frustrated',
      'all-in', 'blow-up', 'margin', 'over-leveraged', 'yolo'
    ];
    
    this.isBlocking = false;
    this.vaultText = null;
    this.lastCheck = '';
    this.checkTimeout = null;
  }
  
  init() {
    // Get reference to Mental Vault
    this.vaultText = document.getElementById('vaultText');
    
    if (!this.vaultText) {
      console.error('[GuardianBridge] Mental Vault not found');
      return;
    }
    
    // Monitor input with debouncing
    this.vaultText.addEventListener('input', (e) => {
      clearTimeout(this.checkTimeout);
      this.checkTimeout = setTimeout(() => {
        this.checkGuardian(e.target.value);
      }, 500); // Wait 500ms after typing stops
    });
    
    // Also check on paste
    this.vaultText.addEventListener('paste', (e) => {
      setTimeout(() => {
        this.checkGuardian(e.target.value);
      }, 100);
    });
    
    // Initial check
    if (this.vaultText.value) {
      this.checkGuardian(this.vaultText.value);
    }
    
    console.log('[GuardianBridge] Initialized with red flags:', this.redFlagWords);
  }
  
  checkGuardian(text) {
    // Avoid duplicate checks
    if (text === this.lastCheck) return;
    this.lastCheck = text;
    
    const lowerText = text.toLowerCase();
    const foundWords = [];
    
    // Check for red flag words
    for (const word of this.redFlagWords) {
      if (lowerText.includes(word)) {
        foundWords.push(word);
      }
    }
    
    if (foundWords.length > 0 && !this.isBlocking) {
      this.blockTrading(foundWords);
    } else if (foundWords.length === 0 && this.isBlocking) {
      this.unblockTrading();
    }
    
    // Update existing Guardian system
    this.updateExistingGuardian(foundWords);
  }
  
  blockTrading(foundWords) {
    this.isBlocking = true;
    console.warn('[Guardian] Trading blocked due to:', foundWords);
    
    // Block Deriv chart trading buttons
    if (window.derivChart) {
      const message = `Blocked: "${foundWords.join(', ')}" detected`;
      window.derivChart.blockTrading(message);
    }
    
    // Show blocking overlay
    this.showBlockingOverlay(foundWords);
    
    // Log the event
    this.logGuardianEvent('BLOCKED', foundWords);
  }
  
  unblockTrading() {
    this.isBlocking = false;
    console.log('[Guardian] Trading unblocked - safe to trade');
    
    // Unblock Deriv chart trading buttons
    if (window.derivChart) {
      window.derivChart.unblockTrading();
    }
    
    // Hide blocking overlay
    this.hideBlockingOverlay();
    
    // Log the event
    this.logGuardianEvent('UNBLOCKED', []);
  }
  
  updateExistingGuardian(foundWords) {
    // Update the original Guardian system in script.js
    if (window.state) {
      window.state.redFlag = foundWords.length > 0;
      window.updateGuardian();
    }
  }
  
  showBlockingOverlay(foundWords) {
    // Remove existing overlay
    this.hideBlockingOverlay();
    
    const overlay = document.createElement('div');
    overlay.id = 'guardian-blocking-overlay';
    overlay.className = 'guardian-block-overlay';
    overlay.innerHTML = `
      <div class="guardian-block-modal">
        <div class="guardian-icon">🛡️</div>
        <h2>Guardian Active</h2>
        <p>Trading has been blocked for your protection</p>
        <div class="detected-words">
          <strong>Detected words:</strong>
          <div class="words-list">
            ${foundWords.map(word => `<span class="red-flag-word">${word}</span>`).join('')}
          </div>
        </div>
        <p class="guidance">Please review your trading mindset and remove emotional language before continuing.</p>
        <button class="guardian-acknowledge" onclick="this.closest('.guardian-block-overlay').remove()">
          I Understand
        </button>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Add entrance animation
    requestAnimationFrame(() => {
      overlay.classList.add('show');
    });
  }
  
  hideBlockingOverlay() {
    const overlay = document.getElementById('guardian-blocking-overlay');
    if (overlay) {
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 300);
    }
  }
  
  logGuardianEvent(action, words) {
    // Log to console for debugging
    const event = {
      timestamp: new Date().toISOString(),
      action: action,
      words: words,
      vaultContent: this.vaultText?.value || ''
    };
    
    console.log('[Guardian] Event:', event);
    
    // Could send to Supabase for analytics in the future
    if (window.supabase && window.state?.user) {
      // Optional: Log guardian events to database
      // this.saveGuardianLog(event);
    }
  }
  
  // Public method to manually check
  manualCheck() {
    if (this.vaultText) {
      this.checkGuardian(this.vaultText.value);
    }
  }
  
  // Add custom red flag words
  addRedFlagWord(word) {
    if (!this.redFlagWords.includes(word.toLowerCase())) {
      this.redFlagWords.push(word.toLowerCase());
      console.log('[Guardian] Added red flag word:', word);
      this.manualCheck();
    }
  }
  
  // Remove red flag word
  removeRedFlagWord(word) {
    const index = this.redFlagWords.indexOf(word.toLowerCase());
    if (index > -1) {
      this.redFlagWords.splice(index, 1);
      console.log('[Guardian] Removed red flag word:', word);
      this.manualCheck();
    }
  }
  
  // Get current status
  getStatus() {
    return {
      isBlocking: this.isBlocking,
      redFlagWords: [...this.redFlagWords],
      vaultLength: this.vaultText?.value.length || 0
    };
  }
}
