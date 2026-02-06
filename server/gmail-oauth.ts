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
export function loadCredentials(): Credentials {
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
export function loadSavedToken(): TokenData | null {
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

  // Use provided redirect URI, env var, or first from credentials
  const envRedirectUri = process.env.GMAIL_REDIRECT_URI;
  const finalRedirectUri =
    redirectUri ||
    envRedirectUri ||
    redirectUris[0] ||
    'http://localhost/api/gmail/oauth2callback';

  return new google.auth.OAuth2(clientId, clientSecret, finalRedirectUri);
}

/**
 * Get authorization URL for OAuth2 flow
 */
export function getAuthUrl(redirectUri?: string): { url: string; redirectUri: string } {
  // Priority for redirect URI:
  // 1. Explicit parameter
  // 2. GMAIL_REDIRECT_URI environment variable (for VPS/production)
  // 3. First URI from credentials file
  // 4. Default localhost
  const envRedirectUri = process.env.GMAIL_REDIRECT_URI;
  
  const finalRedirectUri =
    redirectUri ||
    envRedirectUri ||
    'http://localhost/api/gmail/oauth2callback';

  const oauth2Client = createOAuth2Client(finalRedirectUri);

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
      access_token: tokens.access_token || undefined,
      refresh_token: tokens.refresh_token || undefined,
      scope: tokens.scope || undefined,
      token_type: tokens.token_type || undefined,
      expiry_date: tokens.expiry_date || undefined,
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
        access_token: credentials.access_token || undefined,
        refresh_token: (savedToken.refresh_token || credentials.refresh_token) || undefined, // Preserve refresh token
        scope: (credentials.scope || savedToken.scope) || undefined,
        token_type: (credentials.token_type || savedToken.token_type) || undefined,
        expiry_date: credentials.expiry_date || undefined,
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

/**
 * Get the authenticated user's email profile
 */
export async function getUserProfile() {
  try {
    const gmail = await getGmailClient();
    const response = await gmail.users.getProfile({ userId: 'me' });
    return response.data;
  } catch (error: any) {
    console.error('❌ Error fetching user profile:', error.message);
    throw error;
  }
}

/**
 * Get a fresh access token (refreshes if needed)
 * Returns the current valid access token
 */
export async function getFreshAccessToken(): Promise<string> {
  const oauth2Client = await getAuthenticatedClient();
  const credentials = oauth2Client.credentials;
  
  if (!credentials.access_token) {
    throw new Error('No access token available after refresh');
  }
  
  return credentials.access_token;
}

/**
 * Send email using Gmail API (more reliable than SMTP with OAuth2)
 */
export async function sendEmailViaGmailApi(options: {
  to: string[];
  cc?: string[];
  subject: string;
  htmlContent: string;
  textContent: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType: string;
  }>;
}): Promise<{ messageId: string; threadId: string }> {
  const gmail = await getGmailClient();
  const profile = await gmail.users.getProfile({ userId: 'me' });
  const fromEmail = profile.data.emailAddress;

  if (!fromEmail) {
    throw new Error('Could not determine sender email address');
  }

  // Search for an existing thread with the same subject and recipient to enable threading
  let existingThreadId: string | undefined;
  let existingMessageId: string | undefined;
  try {
    const query = `subject:"${options.subject}" to:${options.to[0]} in:sent`;
    const searchResult = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 1,
    });

    if (searchResult.data.messages && searchResult.data.messages.length > 0) {
      const lastMsg = searchResult.data.messages[0];
      existingThreadId = lastMsg.threadId || undefined;

      // Get the Message-ID header from the last message for In-Reply-To/References
      const msgDetail = await gmail.users.messages.get({
        userId: 'me',
        id: lastMsg.id!,
        format: 'metadata',
        metadataHeaders: ['Message-ID'],
      });

      const messageIdHeader = msgDetail.data.payload?.headers?.find(
        (h: any) => h.name?.toLowerCase() === 'message-id'
      );
      if (messageIdHeader?.value) {
        existingMessageId = messageIdHeader.value;
      }
      console.log(`🔗 Found existing thread ${existingThreadId} for "${options.subject}"`);
    }
  } catch (searchError: any) {
    console.log(`⚠️ Thread search failed, sending as new thread: ${searchError.message}`);
  }

  // Build the email message
  const boundary = `boundary_${Date.now().toString(16)}`;
  const hasAttachments = options.attachments && options.attachments.length > 0;

  let emailLines: string[] = [];

  // Headers
  emailLines.push(`From: ${fromEmail}`);
  emailLines.push(`To: ${options.to.join(', ')}`);
  if (options.cc && options.cc.length > 0) {
    emailLines.push(`Cc: ${options.cc.join(', ')}`);
  }
  emailLines.push(`Subject: =?UTF-8?B?${Buffer.from(options.subject).toString('base64')}?=`);

  // Add threading headers if replying to an existing thread
  if (existingMessageId) {
    emailLines.push(`In-Reply-To: ${existingMessageId}`);
    emailLines.push(`References: ${existingMessageId}`);
  }

  emailLines.push('MIME-Version: 1.0');

  if (hasAttachments) {
    emailLines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    emailLines.push('');
    emailLines.push(`--${boundary}`);
    emailLines.push('Content-Type: multipart/alternative; boundary="alt_boundary"');
    emailLines.push('');
    
    // Plain text part
    emailLines.push('--alt_boundary');
    emailLines.push('Content-Type: text/plain; charset=UTF-8');
    emailLines.push('Content-Transfer-Encoding: base64');
    emailLines.push('');
    emailLines.push(Buffer.from(options.textContent).toString('base64'));
    emailLines.push('');
    
    // HTML part
    emailLines.push('--alt_boundary');
    emailLines.push('Content-Type: text/html; charset=UTF-8');
    emailLines.push('Content-Transfer-Encoding: base64');
    emailLines.push('');
    emailLines.push(Buffer.from(options.htmlContent).toString('base64'));
    emailLines.push('');
    emailLines.push('--alt_boundary--');

    // Attachments
    for (const attachment of options.attachments!) {
      emailLines.push('');
      emailLines.push(`--${boundary}`);
      emailLines.push(`Content-Type: ${attachment.contentType}; name="${attachment.filename}"`);
      emailLines.push('Content-Transfer-Encoding: base64');
      emailLines.push(`Content-Disposition: attachment; filename="${attachment.filename}"`);
      emailLines.push('');
      
      const contentBuffer = typeof attachment.content === 'string' 
        ? Buffer.from(attachment.content, 'base64')
        : attachment.content;
      emailLines.push(contentBuffer.toString('base64'));
    }
    
    emailLines.push('');
    emailLines.push(`--${boundary}--`);
  } else {
    emailLines.push('Content-Type: multipart/alternative; boundary="alt_boundary"');
    emailLines.push('');
    
    // Plain text part
    emailLines.push('--alt_boundary');
    emailLines.push('Content-Type: text/plain; charset=UTF-8');
    emailLines.push('Content-Transfer-Encoding: base64');
    emailLines.push('');
    emailLines.push(Buffer.from(options.textContent).toString('base64'));
    emailLines.push('');
    
    // HTML part
    emailLines.push('--alt_boundary');
    emailLines.push('Content-Type: text/html; charset=UTF-8');
    emailLines.push('Content-Transfer-Encoding: base64');
    emailLines.push('');
    emailLines.push(Buffer.from(options.htmlContent).toString('base64'));
    emailLines.push('');
    emailLines.push('--alt_boundary--');
  }

  const rawEmail = emailLines.join('\r\n');
  const encodedEmail = Buffer.from(rawEmail)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // Send via Gmail API (include threadId if replying to existing thread)
  const requestBody: any = { raw: encodedEmail };
  if (existingThreadId) {
    requestBody.threadId = existingThreadId;
  }

  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody,
  });

  if (!response.data.id) {
    throw new Error('Failed to send email - no message ID returned');
  }

  console.log(`✅ Email sent via Gmail API. Message ID: ${response.data.id}`);
  
  return {
    messageId: response.data.id,
    threadId: response.data.threadId || response.data.id,
  };
}
