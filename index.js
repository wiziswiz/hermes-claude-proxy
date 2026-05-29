#!/usr/bin/env node

const express = require('express');
const https = require('https');
const { log } = require('./src/logger');
const { rewriteSystemForBillingClassifier } = require('./src/rewrite');

const app = express();
const PORT = process.env.PORT || 4523;
const ANTHROPIC_BASE = 'https://api.anthropic.com';

app.use(express.json({ limit: '50mb' }));

app.post('/v1/messages', async (req, res) => {
  try {
    const originalBody = req.body;

    // Rewrite system prompt for billing classifier
    const rewrittenBody = rewriteSystemForBillingClassifier(originalBody);

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ANTHROPIC_TOKEN || ''}`,
        'anthropic-version': '2023-06-01',
        'x-api-key': req.headers['x-api-key'] || 'dummy'
      }
    };

    const proxyReq = https.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      log('Proxy error:', err.message);
      res.status(500).json({ error: err.message });
    });

    proxyReq.write(JSON.stringify(rewrittenBody));
    proxyReq.end();

  } catch (err) {
    log('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '0.1.0-hermes',
    mode: 'hermes-optimized'
  });
});

app.listen(PORT, () => {
  log(`Hermes Claude Proxy listening on port ${PORT}`);
});