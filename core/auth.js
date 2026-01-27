// OAuth configuration for storage providers
// Note: In production, you should create your own OAuth apps for each provider

export const OAUTH_CONFIG = {
  dropbox: {
    clientId: 'lgtet4ml5qp0qo8',
    redirectUri: window.location.origin + '/auth-callback.html',
    authEndpoint: 'https://www.dropbox.com/oauth2/authorize',
    scopes: 'files.content.write files.content.read'
  },
  
  onedrive: {
    clientId: '460ec8b8-1a36-4565-bd95-6d88726e7b65',
    redirectUri: window.location.origin + '/auth-callback.html',
    authority: 'https://login.microsoftonline.com/common',
    scopes: ['Files.ReadWrite', 'User.Read']
  },
  
  googledrive: {
    clientId: '813636040653-ub690hjmd47hknlb9g6pu5bet9d5mv0v.apps.googleusercontent.com',
    redirectUri: window.location.origin,
    authEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    scopes: 'https://www.googleapis.com/auth/drive.file',
    discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
  }
};

// Storage keys
export const PROVIDER_KEY = 'noteel_selected_provider_v1';
export const TOKENS_KEY = 'noteel_oauth_tokens_v1';

// Get selected storage provider
export function getSelectedProvider() {
  return localStorage.getItem(PROVIDER_KEY) || null;
}

// Set selected storage provider
export function setSelectedProvider(provider) {
  localStorage.setItem(PROVIDER_KEY, provider);
}

// Get OAuth tokens for a provider
export function getTokens(provider) {
  const tokens = localStorage.getItem(TOKENS_KEY);
  if (!tokens) return null;
  try {
    const parsed = JSON.parse(tokens);
    return parsed[provider] || null;
  } catch {
    return null;
  }
}

// Save OAuth tokens for a provider
export function saveTokens(provider, tokens) {
  let allTokens = {};
  const existing = localStorage.getItem(TOKENS_KEY);
  if (existing) {
    try {
      allTokens = JSON.parse(existing);
    } catch {
      // ignore
    }
  }
  allTokens[provider] = tokens;
  localStorage.setItem(TOKENS_KEY, JSON.stringify(allTokens));
}

// Clear OAuth tokens for a provider
export function clearTokens(provider) {
  const existing = localStorage.getItem(TOKENS_KEY);
  if (!existing) return;
  try {
    const allTokens = JSON.parse(existing);
    delete allTokens[provider];
    localStorage.setItem(TOKENS_KEY, JSON.stringify(allTokens));
  } catch {
    // ignore
  }
}

// Generate random state for OAuth
export function generateState() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Generate PKCE code verifier
export function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
}

// Generate PKCE code challenge from verifier
export async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64URLEncode(new Uint8Array(hash));
}

// Base64 URL encoding helper
function base64URLEncode(buffer) {
  const base64 = btoa(String.fromCharCode(...buffer));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Parse OAuth callback hash/query parameters
export function parseOAuthCallback() {
  const hash = window.location.hash.substring(1);
  const query = window.location.search.substring(1);
  const params = new URLSearchParams(hash || query);
  return {
    accessToken: params.get('access_token'),
    code: params.get('code'),
    state: params.get('state'),
    error: params.get('error'),
    errorDescription: params.get('error_description')
  };
}
