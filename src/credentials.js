const fs = require('fs');
const { execFileSync } = require('child_process');
const { detectTokenType } = require('./auth');

const REFRESH_SKEW_MS = 5 * 60 * 1000;
const PROACTIVE_REFRESH_SKEW_MS = 10 * 60 * 1000;

function normalizeExpiresAt(value) {
  if (!value) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
}

function tokenPreview(token) {
  if (!token) return null;
  return `${token.slice(0, 8)}...${token.slice(-4)}`;
}

function normalizeCredentials(raw, source) {
  if (!raw || typeof raw !== 'object') return null;
  const accessToken = raw.accessToken || raw.access_token;
  if (!accessToken) return null;

  return {
    accessToken,
    refreshToken: raw.refreshToken || raw.refresh_token || null,
    expiresAt: normalizeExpiresAt(raw.expiresAt || raw.expires_at) || Date.now() + 8 * 60 * 60 * 1000,
    source,
    scopes: raw.scopes || raw.scope || null,
    subscriptionType: raw.subscriptionType,
    rateLimitTier: raw.rateLimitTier,
    tokenType: detectTokenType(accessToken),
  };
}

class CredentialManager {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.cachedCredentials = null;
    this.refreshInProgress = null;
    this.lastError = null;
    this.lastLoadAt = null;
    this.lastRefreshAt = null;
    this.proactiveRefreshTimer = null;
  }

  readCredentialsFromKeychain() {
    if (process.platform !== 'darwin') return null;

    try {
      const raw = execFileSync('security', [
        'find-generic-password',
        '-s',
        'Claude Code-credentials',
        '-w',
      ], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();

      if (!raw) return null;

      try {
        const parsed = JSON.parse(raw);
        return normalizeCredentials(parsed.claudeAiOauth || parsed, 'keychain');
      } catch {
        if (raw.startsWith('sk-ant-') || raw.startsWith('cc-') || raw.startsWith('eyJ')) {
          return normalizeCredentials({ accessToken: raw }, 'keychain');
        }
      }
    } catch {
      return null;
    }

    return null;
  }

  readCredentialsFromFile() {
    try {
      const raw = fs.readFileSync(this.config.credentialsPath, 'utf8');
      const parsed = JSON.parse(raw);
      return normalizeCredentials(parsed.claudeAiOauth || parsed, 'file');
    } catch (err) {
      this.logger.debug('credentials.file', 'Credentials file not available', {
        path: this.config.credentialsPath,
        error: err.message,
      });
      return null;
    }
  }

  readCredentials(options = {}) {
    if (!options.force && this.cachedCredentials) return this.cachedCredentials;

    let creds = null;
    if (this.config.tokenOverride) {
      creds = normalizeCredentials({ accessToken: this.config.tokenOverride }, 'env');
      this.logger.info('credentials.env', 'Using token from ANTHROPIC_TOKEN');
    } else {
      creds = this.readCredentialsFromFile() || this.readCredentialsFromKeychain();
    }

    this.cachedCredentials = creds;
    this.lastLoadAt = Date.now();
    if (creds) {
      this.lastError = null;
      this.logger.debug('credentials.loaded', 'Credentials loaded', {
        source: creds.source,
        token_type: creds.tokenType,
        expires_at: new Date(creds.expiresAt).toISOString(),
      });
    } else {
      this.lastError = 'No Claude credentials found';
      this.logger.warn('credentials.missing', 'No Claude credentials found');
    }
    return creds;
  }

  needsRefresh(creds) {
    if (!creds?.expiresAt) return true;
    return Date.now() + REFRESH_SKEW_MS >= creds.expiresAt;
  }

  isHardExpired(creds) {
    if (!creds?.expiresAt) return true;
    return Date.now() >= creds.expiresAt;
  }

  async initialize() {
    const creds = this.readCredentials({ force: true });
    if (!creds) return null;

    if (this.config.startupValidate && this.needsRefresh(creds) && creds.refreshToken) {
      try {
        await this.refreshToken(creds);
      } catch (err) {
        this.lastError = err.message;
        this.logger.warn('credentials.startup_refresh_failed', 'Startup token refresh failed', {
          error: err.message,
        });
      }
    }

    this.scheduleProactiveRefresh();
    return this.cachedCredentials;
  }

  async refreshToken(creds) {
    if (!creds?.refreshToken) throw new Error('No refresh token available');
    if (this.refreshInProgress) return this.refreshInProgress;

    this.refreshInProgress = (async () => {
      this.logger.info('credentials.refresh', 'Refreshing OAuth token');
      const body = JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: creds.refreshToken,
        client_id: this.config.oauthClientId,
        scope: this.config.oauthScopes,
      });

      const response = await fetch(this.config.oauthTokenUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => response.statusText);
        throw new Error(`Token refresh failed (${response.status}): ${text}`);
      }

      const data = await response.json();
      const nextCredentials = normalizeCredentials({
        accessToken: data.access_token,
        refreshToken: data.refresh_token || creds.refreshToken,
        expiresAt: Date.now() + data.expires_in * 1000,
        scope: data.scope,
        subscriptionType: creds.subscriptionType,
        rateLimitTier: creds.rateLimitTier,
      }, creds.source);

      this.cachedCredentials = nextCredentials;
      this.lastRefreshAt = Date.now();
      this.lastError = null;

      if (!this.config.tokenOverride) {
        try {
          const fileCredentials = {
            accessToken: nextCredentials.accessToken,
            refreshToken: nextCredentials.refreshToken,
            expiresAt: nextCredentials.expiresAt,
            scopes: nextCredentials.scopes,
            subscriptionType: nextCredentials.subscriptionType,
            rateLimitTier: nextCredentials.rateLimitTier,
          };
          fs.writeFileSync(
            this.config.credentialsPath,
            JSON.stringify({ claudeAiOauth: fileCredentials }, null, 2),
            { mode: 0o600 },
          );
        } catch (err) {
          this.logger.debug('credentials.writeback_failed', 'Could not write refreshed credentials', {
            error: err.message,
          });
        }
      }

      this.logger.info('credentials.refreshed', 'Token refreshed', {
        expires_at: new Date(nextCredentials.expiresAt).toISOString(),
      });
      this.scheduleProactiveRefresh();
      return nextCredentials;
    })();

    try {
      return await this.refreshInProgress;
    } finally {
      this.refreshInProgress = null;
    }
  }

  async forceRefresh() {
    const creds = this.readCredentials({ force: true });
    if (!creds) throw new Error('No credentials available');
    return this.refreshToken(creds);
  }

  async getAccessToken() {
    let creds = this.readCredentials();
    if (!creds) throw new Error('No valid Claude OAuth token');

    if (this.needsRefresh(creds)) {
      if (creds.refreshToken) {
        creds = await this.refreshToken(creds);
      } else if (this.isHardExpired(creds)) {
        throw new Error('Claude OAuth token is expired and has no refresh token');
      }
    }

    return creds.accessToken;
  }

  scheduleProactiveRefresh() {
    if (this.proactiveRefreshTimer) clearTimeout(this.proactiveRefreshTimer);
    const creds = this.cachedCredentials;
    if (!creds?.expiresAt || !creds.refreshToken) return;

    const refreshAt = creds.expiresAt - PROACTIVE_REFRESH_SKEW_MS;
    const delayMs = Math.max(refreshAt - Date.now(), 60_000);
    this.proactiveRefreshTimer = setTimeout(async () => {
      try {
        await this.refreshToken(this.cachedCredentials);
      } catch (err) {
        this.lastError = err.message;
        this.logger.warn('credentials.proactive_refresh_failed', 'Proactive token refresh failed', {
          error: err.message,
        });
        this.scheduleProactiveRefresh();
      }
    }, delayMs);
    this.proactiveRefreshTimer.unref();
  }

  stop() {
    if (this.proactiveRefreshTimer) clearTimeout(this.proactiveRefreshTimer);
    this.proactiveRefreshTimer = null;
  }

  getStatus(options = {}) {
    const creds = options.reload ? this.readCredentials({ force: true }) : (this.cachedCredentials || this.readCredentials());
    const now = Date.now();
    const expiresInMs = creds?.expiresAt ? creds.expiresAt - now : null;
    const hardExpired = creds ? this.isHardExpired(creds) : true;

    return {
      token_loaded: !!creds?.accessToken,
      ready: !!creds?.accessToken && !hardExpired,
      source: creds?.source || 'none',
      token_type: creds?.tokenType || 'none',
      token_preview: tokenPreview(creds?.accessToken),
      refreshable: !!creds?.refreshToken,
      expired: hardExpired,
      needs_refresh: creds ? this.needsRefresh(creds) : false,
      expires_at: creds?.expiresAt ? new Date(creds.expiresAt).toISOString() : null,
      expires_in_seconds: expiresInMs === null ? null : Math.floor(expiresInMs / 1000),
      last_load_at: this.lastLoadAt ? new Date(this.lastLoadAt).toISOString() : null,
      last_refresh_at: this.lastRefreshAt ? new Date(this.lastRefreshAt).toISOString() : null,
      last_error: this.lastError,
    };
  }
}

module.exports = {
  CredentialManager,
  normalizeCredentials,
  normalizeExpiresAt,
  tokenPreview,
};
