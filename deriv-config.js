// deriv-config.js
window.DERIV_CONFIG = {
  // Use Deriv's demo App ID for testing
  app_id: '1089',
  
  // WebSocket endpoint
  websocket_url: 'wss://ws.derivws.com/websockets/v3',
  
  // API endpoint
  api_url: 'https://api.deriv.com/api/v3',
  
  // OAuth endpoints
  oauth_url: 'https://oauth.deriv.com/oauth2/authorize',
  
  // Default symbol (V75)
  default_symbol: 'R_75',
  
  // Account types
  account_type: 'demo', // Start with demo to test
  
  // Storage keys
  storage_keys: {
    token: 'deriv_token',
    account: 'deriv_account',
    authorized: 'deriv_authorized'
  },
  
  // Vercel URL for OAuth callback
  redirect_uri: 'https://liquid-edge-journal-hk3x.vercel.app/deriv-callback',
  
  // Available symbols
  symbols: {
    'R_75': 'Volatility 75',
    'R_100': 'Volatility 100',
    'BOOM_1000': 'Boom 1000',
    'BOOM_500': 'Boom 500',
    'BOOM_300': 'Boom 300',
    'CRASH_1000': 'Crash 1000',
    'CRASH_500': 'Crash 500',
    'CRASH_300': 'Crash 300',
    'R_10': 'Volatility 10',
    'R_25': 'Volatility 25',
    'R_50': 'Volatility 50'
  }
};
