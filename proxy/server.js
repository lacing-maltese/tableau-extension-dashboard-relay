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

// Config store — in production, move this to environment variables or a secrets manager.
// Each entry maps a config_id to a webhook destination and HMAC secret.
//
// To add a new route:
//   1. Add an entry here with a unique id, the real webhook URL, and a secret
//   2. Configure the extension with your proxy URL and this config_id
//   3. Set the same secret in your webhook receiver to verify signatures
//
// Example for Zapier: paste the Zapier webhook URL as `destination`.
// Example for MuleSoft: paste the Mule HTTP listener URL as `destination`.
const CONFIG = {
  // 'my-config-id': {
  //   destination: 'https://hooks.zapier.com/hooks/catch/...',
  //   secret: 'your-hmac-secret-here',
  // },
};

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
app.listen(PORT, () => console.log(`Webhook Bridge proxy running on port ${PORT}`));
