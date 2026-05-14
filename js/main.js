(function () {
  const SETTINGS_KEY = 'webhookBridgeConfig';

  let config = null;

  function showState(id) {
    ['not-configured', 'ready', 'loading'].forEach(s => {
      document.getElementById(s).classList.add('hidden');
    });
    document.getElementById(id).classList.remove('hidden');
  }

  function setStatus(msg, type) {
    const el = document.getElementById('status');
    el.textContent = msg;
    el.className = 'status ' + (type || '');
  }

  function getCurrentUser() {
    try {
      const u = tableau.extensions.environment.currentUser;
      const name = u.displayName || u.username || 'unknown';
      setStatus(`user: ${JSON.stringify(u)}`, '');
      return name;
    } catch (e) {
      setStatus(`user err: ${e.message}`, 'error');
      return 'unknown';
    }
  }

  function cleanFieldName(raw) {
    // Strip Tableau decorators: [Field Name], ATTR(x), SUM(x), etc.
    return raw
      .replace(/^[A-Z]+\((.+)\)$/, '$1')
      .replace(/^\[(.+)\]$/, '$1')
      .trim();
  }

  function buildPayload(marks) {
    const mappings = config.mappings.filter(m => m.include);

    const payload = {
      marks: marks.map(mark => {
        const obj = {};
        mappings.forEach(({ tableau_field, json_key }) => {
          const pair = mark.pairs.find(p => cleanFieldName(p.fieldName) === cleanFieldName(tableau_field));
          obj[json_key] = pair ? pair.value : null;
        });
        return obj;
      }),
      meta: {
        worksheet: config.worksheet,
        triggered_by: getCurrentUser(),
        timestamp: new Date().toISOString(),
        ...(config.configId ? { config_id: config.configId } : {}),
      }
    };

    if (config.agentInstructions) {
      payload.instructions = config.agentInstructions;
    }

    return payload;
  }

  async function sendWebhook(marks) {
    const payload = buildPayload(marks);
    const btn = document.getElementById('trigger-btn');
    const usingProxy = !!config.proxyUrl;

    btn.disabled = true;
    setStatus('Sending...', '');

    try {
      const url = usingProxy ? config.proxyUrl : config.webhookUrl;
      const fetchOptions = usingProxy
        ? {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        : {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(payload),
          };

      const response = await fetch(url, fetchOptions);

      if (usingProxy && !response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      setStatus(`Sent ${marks.length} mark${marks.length !== 1 ? 's' : ''} ✓`, 'success');
    } catch (err) {
      setStatus(`Failed: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
    }
  }

  async function onTriggerClick() {
    const dashboard = tableau.extensions.dashboardContent.dashboard;
    const ws = dashboard.worksheets.find(w => w.name === config.worksheet);

    if (!ws) {
      setStatus('Worksheet not found.', 'error');
      return;
    }

    const marksData = await ws.getSelectedMarksAsync();
    const marks = marksData.data.flatMap(d => d.marksInfo || []);

    // Use the first data table from selected marks
    const dataTable = marksData.data[0];
    if (!dataTable || dataTable.data.length === 0) {
      // Empty selection — ignore silently per spec
      return;
    }

    // Re-shape into array of {fieldName, value} pairs per row
    const columns = dataTable.columns;
    const rows = dataTable.data.map(row =>
      ({
        pairs: columns.map((col, i) => ({
          fieldName: col.fieldName,
          value: row[i].formattedValue,
        }))
      })
    );

    await sendWebhook(rows);
  }

  function loadConfig() {
    const raw = tableau.extensions.settings.get(SETTINGS_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function applyConfig(cfg) {
    config = cfg;
    document.getElementById('btn-label').textContent = cfg.buttonLabel || 'Send to Webhook';
  }

  tableau.extensions.initializeAsync({ configure: openConfig }).then(() => {
    const cfg = loadConfig();

    if (!cfg || !cfg.webhookUrl || !cfg.worksheet) {
      showState('not-configured');
      document.getElementById('configure-btn').addEventListener('click', openConfig);
      return;
    }

    applyConfig(cfg);
    showState('ready');

    document.getElementById('trigger-btn').addEventListener('click', onTriggerClick);

    // Re-apply if config changes while dashboard is open
    tableau.extensions.settings.addEventListener(
      tableau.TableauEventType.SettingsChanged,
      () => {
        const updated = loadConfig();
        if (updated) applyConfig(updated);
      }
    );
  });

  function openConfig() {
    const url = 'https://bhartsf.github.io/tableau-webook-bridge/config.html';
    tableau.extensions.ui.displayDialogAsync(url, '', { height: 720, width: 520 })
      .then(() => {
        const cfg = loadConfig();
        if (cfg) {
          applyConfig(cfg);
          showState('ready');
          document.getElementById('trigger-btn').addEventListener('click', onTriggerClick);
        }
      })
      .catch(err => {
        if (err.errorCode !== tableau.ErrorCodes.DialogClosedByUser) {
          console.error('Config dialog error:', err);
        }
      });
  }
})();
