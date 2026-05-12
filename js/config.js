(function () {
  const SETTINGS_KEY = 'webhookBridgeConfig';

  function cleanFieldName(raw) {
    return raw
      .replace(/^[A-Z]+\((.+)\)$/, '$1')
      .replace(/^\[(.+)\]$/, '$1')
      .trim();
  }

  function toJsonKey(raw) {
    return cleanFieldName(raw)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  function showError(msg) {
    const el = document.getElementById('config-error');
    el.textContent = msg;
    el.classList.toggle('hidden', !msg);
  }

  function populateWorksheets(dashboard) {
    const select = document.getElementById('worksheet-select');
    dashboard.worksheets.forEach(ws => {
      const opt = document.createElement('option');
      opt.value = ws.name;
      opt.textContent = ws.name;
      select.appendChild(opt);
    });
  }

  function renderMappingTable(fieldNames, existingMappings) {
    const body = document.getElementById('mapping-body');
    body.innerHTML = '';

    fieldNames.forEach(raw => {
      const existing = existingMappings.find(m => m.tableau_field === raw);
      const defaultKey = toJsonKey(raw);

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="col-include">
          <input type="checkbox" class="field-include" data-field="${escapeAttr(raw)}"
            ${existing ? (existing.include ? 'checked' : '') : 'checked'}>
        </td>
        <td class="col-tableau">${escapeHtml(cleanFieldName(raw))}</td>
        <td class="col-key">
          <input type="text" class="field-key" value="${escapeAttr(existing ? existing.json_key : defaultKey)}"
            maxlength="80" spellcheck="false">
        </td>
      `;
      body.appendChild(tr);
    });

    document.getElementById('mapping-table').classList.remove('hidden');
    document.getElementById('fields-empty').classList.add('hidden');
    document.getElementById('fields-loading').classList.add('hidden');
  }

  function collectMappings(fieldNames) {
    const rows = document.querySelectorAll('#mapping-body tr');
    return fieldNames.map((field, i) => {
      const row = rows[i];
      return {
        tableau_field: field,
        json_key: row.querySelector('.field-key').value.trim() || toJsonKey(field),
        include: row.querySelector('.field-include').checked,
      };
    });
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function escapeAttr(str) {
    return str.replace(/"/g, '&quot;');
  }

  let loadedFieldNames = [];
  let dashboard = null;

  tableau.extensions.initializeDialogAsync().then((settingsRaw) => {
    dashboard = tableau.extensions.dashboardContent.dashboard;
    populateWorksheets(dashboard);

    let existing = null;
    try {
      existing = settingsRaw ? JSON.parse(settingsRaw) : JSON.parse(tableau.extensions.settings.get(SETTINGS_KEY) || 'null');
    } catch { /* use null */ }

    if (existing) {
      document.getElementById('worksheet-select').value = existing.worksheet || '';
      document.getElementById('webhook-url').value = existing.webhookUrl || '';
      document.getElementById('button-label').value = existing.buttonLabel || '';

      if (existing.mappings && existing.mappings.length > 0) {
        loadedFieldNames = existing.mappings.map(m => m.tableau_field);
        renderMappingTable(loadedFieldNames, existing.mappings);
      }
    }
  });

  document.getElementById('load-fields-btn').addEventListener('click', async () => {
    const wsName = document.getElementById('worksheet-select').value;
    if (!wsName) {
      showError('Select a worksheet first.');
      return;
    }
    showError('');

    const ws = dashboard.worksheets.find(w => w.name === wsName);
    document.getElementById('fields-loading').classList.remove('hidden');
    document.getElementById('mapping-table').classList.add('hidden');

    try {
      const marksData = await ws.getSelectedMarksAsync();
      const dataTable = marksData.data[0];

      if (!dataTable || dataTable.data.length === 0) {
        document.getElementById('fields-loading').classList.add('hidden');
        document.getElementById('fields-empty').classList.remove('hidden');
        return;
      }

      loadedFieldNames = dataTable.columns.map(c => c.fieldName);

      const existingRaw = tableau.extensions.settings.get(SETTINGS_KEY);
      const existing = existingRaw ? JSON.parse(existingRaw) : null;
      renderMappingTable(loadedFieldNames, existing ? existing.mappings || [] : []);
    } catch (err) {
      document.getElementById('fields-loading').classList.add('hidden');
      showError(`Could not load fields: ${err.message}`);
    }
  });

  document.getElementById('save-btn').addEventListener('click', async () => {
    const worksheet = document.getElementById('worksheet-select').value;
    const webhookUrl = document.getElementById('webhook-url').value.trim();
    const buttonLabel = document.getElementById('button-label').value.trim();

    if (!worksheet) { showError('Select a worksheet.'); return; }
    if (!webhookUrl) { showError('Enter a webhook URL.'); return; }
    if (!webhookUrl.startsWith('https://') && !webhookUrl.startsWith('http://')) {
      showError('Webhook URL must start with http:// or https://');
      return;
    }

    const mappings = loadedFieldNames.length > 0
      ? collectMappings(loadedFieldNames)
      : [];

    const cfg = { worksheet, webhookUrl, buttonLabel, mappings };
    tableau.extensions.settings.set(SETTINGS_KEY, JSON.stringify(cfg));

    try {
      await tableau.extensions.settings.saveAsync();
      tableau.extensions.ui.closeDialog('saved');
    } catch (err) {
      showError(`Save failed: ${err.message}`);
    }
  });

  document.getElementById('cancel-btn').addEventListener('click', () => {
    tableau.extensions.ui.closeDialog('cancelled');
  });
})();
