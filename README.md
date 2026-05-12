# Webhook Bridge

A Tableau dashboard extension that lets users select marks and trigger any automation platform — Zapier, Make, Power Automate, n8n, MuleSoft, or any webhook endpoint — without leaving the dashboard.

## What it does

Dashboard authors configure a webhook URL and map Tableau field names to clean JSON keys. Dashboard viewers select marks and click a button. The selected data POSTs as a structured JSON array to the configured endpoint.

**Example payload:**
```json
{
  "marks": [
    { "customer_name": "Hunter Lopez", "sales": "12,873" },
    { "customer_name": "Sanjit Chand", "sales": "14,142" }
  ],
  "meta": {
    "worksheet": "Sales by Region",
    "timestamp": "2026-05-12T19:02:55.664Z"
  }
}
```

## Why this exists

Tableau already supports triggering Salesforce Flows from dashboard mark selections — a powerful capability for customers on the Salesforce platform. Webhook Bridge extends that same pattern to the broader automation ecosystem: Zapier, Make, Power Automate, n8n, MuleSoft, or any endpoint that accepts an HTTP POST.

The result is that any Tableau customer, regardless of their automation stack, can turn a dashboard into a trigger for operational workflows. The dashboard stops being a place to observe data and becomes a place to act on it — without leaving Tableau.

## Deploy in 10 minutes

No backend required. The extension runs entirely in the browser and is hosted as a static site.

**1. Download the manifest**

Download [`manifest.trex`](https://bhartsf.github.io/tableau-webook-bridge/manifest.trex) — this is the only file you need locally.

**2. Allowlist on Tableau Cloud**

In Tableau Cloud: **Settings → Extensions → Add Extension by URL**

Paste: `https://bhartsf.github.io/tableau-webook-bridge/index.html`

Enable **Allow to run with network access**.

**3. Add to a dashboard**

In a dashboard (edit mode), drag an **Extension** object onto the canvas. Select **My Extensions**, choose the `manifest.trex` file, and accept the prompt.

**4. Configure**

Click the **Configure** button that appears in the extension zone. Set:
- **Worksheet** — the worksheet whose selected marks will be sent
- **Webhook URL** — your Zapier/Make/Power Automate/n8n/MuleSoft endpoint
- **Button label** — what the button says to dashboard viewers
- **Field mapping** — select a mark on your worksheet first, then click **Load Fields** to pull the schema and map Tableau field names to clean JSON keys

Click **Save**. The extension zone will show your configured button.

## Supported platforms

Any platform that accepts an HTTP POST with a JSON body. Tested with:

| Platform | Notes |
|---|---|
| Zapier | Works out of the box |
| Make (formerly Integromat) | Works out of the box |
| Power Automate | Works out of the box |
| n8n | Works out of the box |
| webhook.site | Works for testing |
| MuleSoft Anypoint | Requires CORS headers configured on the Mule flow |

## Self-hosting

The shared instance at `bhartsf.github.io` is suitable for testing and internal use. To host your own:

1. Fork this repo
2. Enable GitHub Pages on your fork (Settings → Pages → Deploy from branch → main)
3. Update the `<url>` in `manifest.trex` to your Pages URL
4. Allowlist your URL on Tableau Cloud

## How it works

The extension uses the [Tableau Extensions API](https://tableau.github.io/extensions-api/) to access selected mark data via `getSelectedMarksAsync()`. On button click it builds a payload from the configured field mappings and POSTs to the webhook URL using `fetch` in `no-cors` mode (required to avoid CORS preflight issues with most webhook receivers). Configuration is persisted in `tableau.extensions.settings` and travels with the workbook.

## Limitations

- Values are sent as formatted strings (e.g. `"12,873"` not `12873`) — Tableau's Extensions API returns formatted values from mark selections. Type coercion can be handled downstream in your automation platform.
- `no-cors` fetch mode means the extension cannot confirm whether the webhook accepted the request — the button shows "Sent" if the request was dispatched, regardless of server response.
- Empty selections are silently ignored — clicking the button with no marks selected does nothing.

## Files

```
manifest.trex      Tableau extension manifest
index.html         Extension panel (the button)
config.html        Configuration dialog
js/main.js         Button logic, mark fetching, webhook POST
js/config.js       Config dialog: worksheet picker, field mapping
css/styles.css     Shared styles
```
