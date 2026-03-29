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
  
  // OAuth callback URI. Must match exactly in Deriv app settings.
  redirect_uri: 'https://liquid-edge.app/deriv-callback.html',

  // Available symbols (Volatility Index only)
  symbols: {
    'R_10':   'Volatility 10 Index',
    '1HZ10V': 'Volatility 10 (1s) Index',
    '1HZ15V': 'Volatility 15 (1s) Index',
    'R_25':   'Volatility 25 Index',
    '1HZ25V': 'Volatility 25 (1s) Index',
    '1HZ30V': 'Volatility 30 (1s) Index',
    'R_50':   'Volatility 50 Index',
    '1HZ50V': 'Volatility 50 (1s) Index',
    'R_75':   'Volatility 75 Index',
    '1HZ75V': 'Volatility 75 (1s) Index',
    '1HZ90V': 'Volatility 90 (1s) Index',
    'R_100':  'Volatility 100 Index',
    '1HZ100V':'Volatility 100 (1s) Index'
  }
};
