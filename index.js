#!/usr/bin/env node

const express = require('express');
const https = require('https');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { log } = require('./src/logger');
const { rewriteSystemForBillingClassifier } = require('./src/rewrite');

const app = express();
const PORT = process.env.PORT || 4523;
const CREDENTIALS_PATH=*** '.claude', '.credentials.json');

let cachedCredentials = null;
let refreshInProgress = null;

function readCredentialsFromKeychain() {
  try {
    const raw = execFileSync('security', [
      'find-generic-password',
      '-s', 'Claude Code-credentials',
      '-w'
    ], { encoding: 'utf8' }).trim();

    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);
      if (parsed.claudeAiOauth?.accessToken) return parsed.claudeAiOauth;
      if (parsed.accessToken) return parsed;
    } catch {
      if (raw.startsWith('sk-ant-')) {
        return { accessToken: raw, refreshToken: null, expiresAt: Date.now() + 8 * 60 * 60 * 1000 };
      }
    }
    return null;
  } catch {
    return null;
  }
}

function readCredentials() {
  try {
    const raw = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    cachedCredentials = parsed.claudeAiOauth;
    if (cachedCredentials?.accessToken) return cachedCredentials;
  } catch {}

  const keychainCreds = readCredentialsFromKeychain();
  if (keychainCreds) {
    cachedCredentials = keychainCreds;
    return cachedCredentials;
  }

  return null;
}

function isTokenExpired(creds) {
  if (!creds?.expiresAt) return true;
  return Date.now() + 300_000 >= creds.expiresAt;
}

async function refreshToken(creds) {
  if (!creds?.refreshToken) throw new Error('No refresh token');

  if (refreshInProgress) return refreshInProgress;

  refreshInProgress = (async () => {
    log('Refreshing OAuth token...');
    const body = JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: creds.refreshToken,
      client_id: '9d1c252f5e',
      scope: 'user:inference user:sessions:claude_code'
    });

    const res = await fetch('https://api.anthropic.com/v1/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    });

    if (!res.ok) {
      throw new Error(`Refresh failed: ${res.status}`);
    }

    const data = await res.json();
    cachedCredentials = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || creds.refreshToken,
      expiresAt: Date.now() + data.expires_in * 1000
    };

    try {
      fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify({ claudeAiOauth: cachedCredentials }, null, 2), { mode: 0o600 });
    } catch {}

    return cachedCredentials;
  })();

  try { return await refreshInProgress; } finally { refreshInProgress = null; }
}

function getAccessToken() {
  if (!cachedCredentials) readCredentials();
  if (cachedCredentials && isTokenExpired(cachedCredentials)) {
    refreshToken(cachedCredentials).catch(e => log('Refresh failed:', e.message));
  }
  return cachedCredentials?.accessToken || null;
}

app.use(express.json({ limit: '50mb' }));

app.post('/v1/messages', async (req, res) => {
  try {
    const rewritten = rewriteSystemForBillingClassifier(req.body);
    const token = getAccessToken();

    if (!token) {
      return res.status(401).json({ error: 'No valid Claude OAuth token' });
    }

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'anthropic-version': '2023-06-01',
        'x-app': 'cli'
      }
    };

    const proxyReq = https.request(options, (proxyRes) => {
      if (proxyRes.statusCode >= 400) {
        let body = '';
        proxyRes.on('data', chunk => body += chunk);
        proxyRes.on('end', () => log(`Anthropic ${proxyRes.statusCode}:`, body));
      }
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', err => {
      log('Proxy error:', err.message);
      res.status(500).json({ error: err.message });
    });

    proxyReq.write(JSON.stringify(rewritten));
    proxyReq.end();

  } catch (err) {
    log('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => {
  const creds = readCredentials();
  res.json({
    status: 'ok',
    version: '0.1.0-hermes',
    token_loaded: !!creds?.accessToken,
    source: creds ? (fs.existsSync(CREDENTIALS_PATH) ? 'file' : 'keychain') : 'none'
  });
});

app.listen(PORT, () => {
  log(`Hermes Claude Proxy listening on port ${PORT}`);
  readCredentials();
});