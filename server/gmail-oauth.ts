import { google } from 'googleapis';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import type { OAuth2Client } from 'google-auth-library';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify', // For applying labels
  'https://www.googleapis.com/auth/gmail.send', // For sending emails (if needed)
];

const TOKEN_PATH = join(process.cwd(), 'token.json');

/**
 * Get the path to the credentials file (checks both @credentials.json and credentials.json)
 */
function getCredentialsPath(): string {
  const withAt = join(process.cwd(), '@credentials.json');
  const withoutAt = join(process.cwd(), 'credentials.json');
  
  if (existsSync(withAt)) {
    return withAt;
  }
  if (existsSync(withoutAt)) {
    return withoutAt;
  }
  
  // Return default path for error message
  return withAt;
}

interface Credentials {
  installed?: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };
  web?: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };
}

interface TokenData {
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  expiry_date?: number;
}

/**
 * Load credentials from credentials.json or @credentials.json file
 */
function loadCredentials(): Credentials {
  try {
    const credentialsPath = getCredentialsPath();
    
    if (!existsSync(credentialsPath)) {
      throw new Error(
        `Credentials file not found. Please ensure credentials.json or @credentials.json exists in the root directory.`
      );
    }

    const content = readFileSync(credentialsPath, 'utf8');
    const credentials = JSON.parse(content) as Credentials;

    // Support both 'installed' and 'web' credential types
    if (!credentials.installed && !credentials.web) {
      throw new Error(
        'Invalid credentials format. Expected "installed" or "web" property.'
      );
    }

    return credentials;
  } catch (error: any) {
    if (error.code === 'ENOENT' || error.message.includes('not found')) {
      throw new Error(
        `Credentials file not found. Please ensure credentials.json or @credentials.json exists in the root directory.`
      );
    }
    throw new Error(`Failed to load credentials: ${error.message}`);
  }
}

/**
 * Load saved token from token.json
 */
function loadSavedToken(): TokenData | null {
  try {
    if (!existsSync(TOKEN_PATH)) {
      return null;
    }

    const content = readFileSync(TOKEN_PATH, 'utf8');
    return JSON.parse(content) as TokenData;
  } catch (error) {
    console.warn('⚠️ Failed to load saved token:', error);
    return null;
  }
}

/**
 * Save token to token.json
 */
function saveToken(token: TokenData): void {
  try {
    writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
    console.log('✅ Token saved to', TOKEN_PATH);
  } catch (error: any) {
    console.error('❌ Failed to save token:', error.message);
    throw error;
  }
}

/**
 * Create OAuth2 client from credentials
 */
function createOAuth2Client(redirectUri?: string): OAuth2Client {
  const credentials = loadCredentials();
  const creds = credentials.installed || credentials.web;

  if (!creds) {
    throw new Error('Invalid credentials format');
  }

  const clientId = creds.client_id;
  const clientSecret = creds.client_secret;
  const redirectUris = creds.redirect_uris || [];

  // Use provided redirect URI or first from credentials, or default
  const finalRedirectUri =
    redirectUri ||
    redirectUris[0] ||
    'http://localhost:5000/api/gmail/oauth2callback';

  return new google.auth.OAuth2(clientId, clientSecret, finalRedirectUri);
}

/**
 * Get authorization URL for OAuth2 flow
 */
export function getAuthUrl(redirectUri?: string): { url: string; redirectUri: string } {
  const oauth2Client = createOAuth2Client(redirectUri);
  const finalRedirectUri = oauth2Client.redirectUri || redirectUri || 'http://localhost:5000/api/gmail/oauth2callback';

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Required to get refresh token
    scope: SCOPES,
    prompt: 'consent', // Force consent screen to get refresh token
  });

  return {
    url: authUrl,
    redirectUri: finalRedirectUri,
  };
}

/**
 * Exchange authorization code for tokens
 */
export async function getTokenFromCode(
  code: string,
  redirectUri?: string
): Promise<TokenData> {
  const oauth2Client = createOAuth2Client(redirectUri);

  try {
    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens.refresh_token && !tokens.access_token) {
      throw new Error('No tokens received from Google');
    }

    const tokenData: TokenData = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      scope: tokens.scope,
      token_type: tokens.token_type,
      expiry_date: tokens.expiry_date,
    };

    // Save token for future use
    saveToken(tokenData);

    return tokenData;
  } catch (error: any) {
    console.error('❌ Error getting token from code:', error.message);
    throw new Error(`Failed to exchange authorization code: ${error.message}`);
  }
}

/**
 * Get authenticated OAuth2 client
 * Automatically refreshes token if expired
 */
export async function getAuthenticatedClient(redirectUri?: string): Promise<OAuth2Client> {
  const oauth2Client = createOAuth2Client(redirectUri);
  const savedToken = loadSavedToken();

  if (!savedToken) {
    throw new Error(
      'No saved token found. Please complete OAuth2 authorization flow first by visiting /api/gmail/auth'
    );
  }

  oauth2Client.setCredentials(savedToken);

  // Check if token is expired and refresh if needed
  if (savedToken.expiry_date && savedToken.expiry_date <= Date.now()) {
    console.log('🔄 Token expired, refreshing...');
    
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      const updatedToken: TokenData = {
        access_token: credentials.access_token,
        refresh_token: savedToken.refresh_token || credentials.refresh_token, // Preserve refresh token
        scope: credentials.scope || savedToken.scope,
        token_type: credentials.token_type || savedToken.token_type,
        expiry_date: credentials.expiry_date,
      };

      saveToken(updatedToken);
      oauth2Client.setCredentials(updatedToken);
      
      console.log('✅ Token refreshed successfully');
    } catch (error: any) {
      console.error('❌ Failed to refresh token:', error.message);
      throw new Error(
        'Token expired and refresh failed. Please re-authorize by visiting /api/gmail/auth'
      );
    }
  }

  return oauth2Client;
}

/**
 * Get authenticated Gmail client
 */
export async function getGmailClient(redirectUri?: string) {
  const auth = await getAuthenticatedClient(redirectUri);
  return google.gmail({ version: 'v1', auth });
}

/**
 * Check if user is authenticated (has valid token)
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const savedToken = loadSavedToken();
    if (!savedToken || !savedToken.refresh_token) {
      return false;
    }

    // Try to get authenticated client (will refresh if needed)
    await getAuthenticatedClient();
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Revoke token and delete token.json
 */
export async function revokeAuth(): Promise<void> {
  try {
    const savedToken = loadSavedToken();
    if (savedToken && savedToken.access_token) {
      const oauth2Client = createOAuth2Client();
      oauth2Client.setCredentials(savedToken);
      await oauth2Client.revokeCredentials();
    }

    // Delete token file
    if (existsSync(TOKEN_PATH)) {
      unlinkSync(TOKEN_PATH);
      console.log('✅ Token revoked and deleted');
    }
  } catch (error: any) {
    console.error('❌ Error revoking token:', error.message);
    throw error;
  }
}
