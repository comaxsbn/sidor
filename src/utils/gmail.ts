import { GmailMessage } from '../types';

/**
 * Fetches a list of Gmail messages for the current user using our server proxy (or direct Google API fallback).
 */
export async function listGmailMessages(
  accessToken: string,
  query: string = 'label:INBOX',
  maxResults: number = 15
): Promise<GmailMessage[]> {
  if (!accessToken) {
    return [];
  }

  try {
    // 1. Try server proxy route first (prevents CORS & browser iframe origin issues)
    const proxyUrl = `/api/gmail/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
    const proxyRes = await fetch(proxyUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (proxyRes.ok) {
      const json = await proxyRes.json();
      if (json.success && Array.isArray(json.messages)) {
        return json.messages;
      }
    }

    // 2. Direct client-side fetch fallback
    const listUrl = `https://gmail.googleapis.com/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
    const response = await fetch(listUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`Gmail API returned HTTP ${response.status}: ${errText}`);
      return [];
    }

    const data = await response.json();
    if (!data.messages || !Array.isArray(data.messages)) {
      return [];
    }

    // Fetch details for each message in parallel
    const detailsPromises = data.messages.map((m: { id: string }) => 
      getGmailMessageDetails(accessToken, m.id)
    );

    const messages = await Promise.all(detailsPromises);
    return messages.filter((m): m is GmailMessage => m !== null);
  } catch (error) {
    console.warn('Note on Gmail message fetching:', error);
    return [];
  }
}

/**
 * Fetches full details for a single Gmail message.
 */
export async function getGmailMessageDetails(
  accessToken: string,
  messageId: string
): Promise<GmailMessage | null> {
  try {
    const url = `https://gmail.googleapis.com/v1/users/me/messages/${messageId}?format=full`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const headers = data.payload?.headers || [];

    const getHeader = (name: string) => {
      const h = headers.find((item: { name: string; value: string }) => 
        item.name.toLowerCase() === name.toLowerCase()
      );
      return h ? h.value : '';
    };

    const subject = getHeader('Subject') || 'ללא נושא';
    const from = getHeader('From') || 'לא ידוע';
    const to = getHeader('To') || '';
    const date = getHeader('Date') || new Date().toISOString();

    // Extract body text
    let bodyText = data.snippet || '';
    if (data.payload) {
      bodyText = extractBodyFromPayload(data.payload) || data.snippet || '';
    }

    // Check for PDF / File attachments
    const hasAttachments = checkHasAttachments(data.payload);

    return {
      id: data.id,
      threadId: data.threadId,
      snippet: data.snippet || '',
      subject,
      from,
      to,
      date,
      body: bodyText,
      hasAttachments
    };
  } catch (error) {
    console.error(`Error getting details for message ${messageId}:`, error);
    return null;
  }
}

/**
 * Recursively extracts body text from Gmail payload parts.
 */
function extractBodyFromPayload(payload: any): string {
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  if (payload.parts && Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
    }
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        const html = decodeBase64Url(part.body.data);
        return html.replace(/<[^>]+>/g, ' '); // Strip HTML tags for clean text preview
      }
      if (part.parts) {
        const nested = extractBodyFromPayload(part);
        if (nested) return nested;
      }
    }
  }
  return '';
}

/**
 * Checks if payload contains attachments.
 */
function checkHasAttachments(payload: any): boolean {
  if (!payload) return false;
  if (payload.filename && payload.filename.length > 0) return true;
  if (payload.parts && Array.isArray(payload.parts)) {
    return payload.parts.some((part: any) => checkHasAttachments(part));
  }
  return false;
}

/**
 * Decodes base64url encoded string from Gmail API.
 */
function decodeBase64Url(base64UrlStr: string): string {
  try {
    let base64 = base64UrlStr.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return decodeURIComponent(
      Array.prototype.map
        .call(atob(base64), (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  } catch {
    return base64UrlStr;
  }
}

/**
 * Sends an email using the Gmail REST API (users/me/messages/send).
 */
export async function sendGmailMessage(
  accessToken: string,
  params: {
    to: string;
    subject: string;
    body: string;
  }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // 1. Try server proxy route first
    const proxyRes = await fetch('/api/gmail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    });

    if (proxyRes.ok) {
      const json = await proxyRes.json();
      if (json.success) {
        return { success: true, messageId: json.messageId };
      }
    }

    // 2. Direct fallback
    const { to, subject, body } = params;

    const mimeLines = [
      `To: ${to}`,
      `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      btoa(unescape(encodeURIComponent(body)))
    ];

    const rawMime = mimeLines.join('\r\n');
    const base64UrlMime = btoa(unescape(encodeURIComponent(rawMime)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await fetch('https://gmail.googleapis.com/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw: base64UrlMime })
    });

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: `Gmail API send failed: ${errText}` };
    }

    const json = await response.json();
    return { success: true, messageId: json.id };
  } catch (error: any) {
    console.error('Error sending email via Gmail API:', error);
    return { success: false, error: error.message || String(error) };
  }
}
