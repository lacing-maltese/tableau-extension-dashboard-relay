# Webhook Bridge

A Tableau dashboard extension that lets users select marks and trigger any automation platform — Zapier, Make, Power Automate, n8n, MuleSoft, or any webhook endpoint — without leaving the dashboard.

## What it does

Dashboard authors configure a webhook URL, field mappings, and an optional button label. Dashboard viewers select marks and click the button. The selected data POSTs as a structured JSON array to the configured endpoint. Configuration is author-only — end users in view mode see only the trigger button.

**Example payload:**
```json
{
  "marks": [
    { "customer_name": "Hunter Lopez", "sales": "12,873" },
    { "customer_name": "Sanjit Chand", "sales": "14,142" }
  ],
  "instructions": "Research each customer's recent activity and draft a personalized outreach email.",
  "meta": {
    "worksheet": "Sales by Region",
    "triggered_by": "ben.hart",
    "config_id": "sales-outreach",
    "timestamp": "2026-05-14T17:02:55.664Z"
  }
}
```

`instructions` and `config_id` are optional — present only when configured. `triggered_by` is populated on Tableau Server; see Limitations for Tableau Cloud behavior.

## Why this exists

Tableau already supports triggering Salesforce Flows from dashboard mark selections — a powerful capability for customers on the Salesforce platform. Webhook Bridge extends that same pattern to the broader automation ecosystem: Zapier, Make, Power Automate, n8n, MuleSoft, or any endpoint that accepts an HTTP POST.

The result is that any Tableau customer, regardless of their automation stack, can turn a dashboard into a trigger for operational workflows. The dashboard stops being a place to observe data and becomes a place to act on it — without leaving Tableau.

## Deploy in 10 minutes

No backend required for basic use. The extension runs entirely in the browser and is hosted as a static site.

**1. Download the manifest**

Download [`manifest.trex`](https://bhartsf.github.io/tableau-webook-bridge/manifest.trex) — this is the only file you need locally.

**2. Allowlist on Tableau Cloud**

In Tableau Cloud: **Settings → Extensions → Add Extension by URL**

Paste: `https://bhartsf.github.io/tableau-webook-bridge/index.html`

Enable **Allow to run with network access**.

**3. Add to a dashboard**

In a dashboard (edit mode), drag an **Extension** object onto the canvas. Select **My Extensions**, choose the `manifest.trex` file, and accept the prompt.

**4. Configure**

Click the **Configure** button that appears in the extension zone (only visible in edit mode). Set:
- **Worksheet** — the worksheet whose selected marks will be sent
- **Webhook URL** — your Zapier/Make/Power Automate/n8n/MuleSoft endpoint (or leave blank if using a proxy)
- **Proxy URL** *(optional)* — URL of your Webhook Bridge proxy instance; see [Proxy](#proxy) below
- **Config ID** *(optional)* — identifier used by the proxy to look up the real destination
- **Button label** — what the button says to dashboard viewers
- **Agent instructions** *(optional)* — natural language description of what an AI agent should do with the data; included in the payload as `instructions`
- **Field mapping** — select a mark on your worksheet first, then click **Load Fields** to pull the schema and map Tableau field names to clean JSON keys

Click **Save**. The extension zone will show your configured button. Viewers in published dashboards will see only the button — no access to configuration or URLs.

## Supported platforms

Any platform that accepts an HTTP POST with a JSON body. Tested with:

| Platform | Notes |
|---|---|
| Zapier | Works out of the box |
| Make (formerly Integromat) | Works out of the box |
| Power Automate | Works out of the box |
| n8n | Works out of the box |
| webhook.site | Works for testing |
| MuleSoft Anypoint | Requires CORS headers on the Mule flow, or use the proxy |

## Proxy

For production use, deploy the included proxy service instead of posting directly to webhook URLs from the browser. The proxy:

- Keeps real webhook URLs off the browser and out of the workbook
- Signs every outbound request with HMAC-SHA256 (`X-Webhook-Signature` header)
- Returns a real HTTP response status (unlike `no-cors` direct mode)
- Eliminates CORS issues for platforms like MuleSoft that require server-to-server calls

**Deploy to Railway (or any Node host):**

1. Fork this repo
2. Create a new Railway project from your fork, using `proxy/` as the service root
3. Set the `ROUTES` environment variable — a JSON object mapping config IDs to destinations:
   ```
   {"my-config-id":{"destination":"https://hooks.zapier.com/hooks/catch/...","secret":"your-hmac-secret"}}
   ```
4. Set `PORT` to match Railway's public networking port
5. Configure the extension with your Railway URL as the **Proxy URL** and your config ID

The proxy exposes a `/health` endpoint for uptime checks.

## How it works

The extension uses the [Tableau Extensions API](https://tableau.github.io/extensions-api/) to access selected mark data via `getSelectedMarksAsync()`. On button click it builds a payload from the configured field mappings and either:
- POSTs directly to the webhook URL using `fetch` in `no-cors` mode (direct mode), or
- POSTs to the proxy, which signs and forwards the request server-side (proxy mode)

Configuration is persisted in `tableau.extensions.settings` and travels with the workbook. The configure UI is only shown to dashboard authors (edit mode); published viewers see only the trigger button.

## Self-hosting the extension

The shared instance at `bhartsf.github.io` is suitable for testing and internal use. To host your own:

1. Fork this repo
2. Enable GitHub Pages on your fork (Settings → Pages → Deploy from branch → main)
3. Update the `<url>` in `manifest.trex` to your Pages URL
4. Allowlist your URL on Tableau Cloud

## Limitations

- Values are sent as formatted strings (e.g. `"12,873"` not `12873`) — Tableau's Extensions API returns formatted values from mark selections. Type coercion can be handled downstream in your automation platform.
- `no-cors` direct mode means the extension cannot confirm whether the webhook accepted the request — the button shows "Sent" if the request was dispatched, regardless of server response. This limitation does not apply when using the proxy.
- Empty selections are silently ignored — clicking the button with no marks selected does nothing.
- `meta.triggered_by` will always be `"unknown"` on Tableau Cloud — the Extensions API does not expose the current user's identity in cloud deployments. The field is populated correctly on Tableau Server (on-premise).

## Security considerations

This extension is suitable for demos, prototypes, and internal use cases where Tableau site access controls are the primary security boundary. For production use with consequential actions, be aware of the following:

**Direct webhook mode (no proxy):**
- **Webhook URL exposure** — the configured webhook URL is stored in `tableau.extensions.settings`, which is persisted in the workbook. Anyone who can download the workbook can extract it. Treat webhook URLs as credentials and scope Tableau workbook permissions accordingly.
- **No payload signing** — the webhook receiver cannot verify that requests originated from your Tableau dashboard.
- **No request authentication** — any dashboard viewer with access to the workbook can trigger the webhook. Access is gated entirely by Tableau's workbook permissions.

**Proxy mode** resolves the first two issues — the real webhook URL never leaves the proxy server, and every request is signed with HMAC-SHA256. Per-user authorization remains gated by Tableau's workbook permissions in both modes.

## Files

```
manifest.trex          Tableau extension manifest
index.html             Extension panel (the button)
config.html            Configuration dialog (authors only)
js/main.js             Button logic, mark fetching, webhook POST
js/config.js           Config dialog: worksheet picker, field mapping
css/styles.css         Shared styles
proxy/server.js        Optional proxy service (Node.js/Express)
proxy/package.json     Proxy dependencies
```
