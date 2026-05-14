const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// CORS — allow requests from any Tableau extension origin
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Config is loaded from the ROUTES environment variable — a JSON object mapping
// config_id → { destination, secret }. Set this in your hosting platform's
// environment variables, never in code.
//
// Example value for ROUTES:
// {"test":{"destination":"https://webhook.site/...","secret":"your-secret"}}
//
// To add a new route, add a new key to the ROUTES object and redeploy.
let CONFIG = {};
try {
  CONFIG = JSON.parse(process.env.ROUTES || '{}');
} catch {
  console.error('Failed to parse ROUTES env var — check that it is valid JSON');
}

function sign(secret, body) {
  return crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
}

app.post('/trigger', async (req, res) => {
  const { config_id } = req.body?.meta || {};

  if (!config_id) {
    return res.status(400).json({ error: 'meta.config_id is required' });
  }

  const route = CONFIG[config_id];
  if (!route) {
    return res.status(404).json({ error: `Unknown config_id: ${config_id}` });
  }

  const body = JSON.stringify(req.body);
  const signature = sign(route.secret, body);

  try {
    const response = await fetch(route.destination, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': `sha256=${signature}`,
        'X-Webhook-Bridge-Config': config_id,
      },
      body,
    });

    res.status(response.ok ? 200 : 502).json({
      ok: response.ok,
      status: response.status,
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/health', (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Webhook Bridge proxy running on port ${PORT}`));
