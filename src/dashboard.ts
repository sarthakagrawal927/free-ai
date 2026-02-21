export function renderDashboardHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Gateway Usage Dashboard</title>
    <style>
      :root {
        --bg: #f3f8fc;
        --panel: #ffffff;
        --line: #d2dfeb;
        --ink: #102436;
        --muted: #4e6477;
        --brand: #0f5f8a;
        --ok: #0e7a5f;
        --bad: #b64949;
        --warn: #b7791f;
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        font-family: "Avenir Next", "Trebuchet MS", "Segoe UI", sans-serif;
        color: var(--ink);
        background:
          radial-gradient(120% 90% at 0% 0%, rgba(15, 95, 138, 0.15), transparent 55%),
          radial-gradient(120% 90% at 100% 0%, rgba(183, 121, 31, 0.12), transparent 58%),
          linear-gradient(165deg, #eef6fb 0%, #f8f3ea 100%);
      }

      main {
        max-width: 1200px;
        margin: 0 auto;
        padding: 1rem;
      }

      .header {
        background: linear-gradient(125deg, #123448 0%, #17506f 50%, #1e6a7d 100%);
        color: #f5f9fe;
        border-radius: 18px;
        padding: 1rem;
        box-shadow: 0 16px 34px rgba(15, 23, 42, 0.15);
      }

      .header h1 {
        margin: 0;
        font-size: clamp(1.3rem, 4vw, 2rem);
        line-height: 1.1;
      }

      .header p {
        margin: 0.55rem 0 0;
        color: rgba(239, 247, 255, 0.93);
        font-size: 0.92rem;
      }

      .panel {
        margin-top: 0.8rem;
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 0.8rem;
        box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
      }

      .controls {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
        gap: 0.55rem;
        align-items: end;
      }

      label {
        display: block;
        font-size: 0.76rem;
        font-weight: 700;
        color: var(--muted);
        margin-bottom: 0.24rem;
      }

      input, select, button {
        width: 100%;
        border: 1px solid #c0d0df;
        border-radius: 10px;
        font-size: 0.84rem;
        padding: 0.46rem 0.56rem;
        background: #fff;
        color: var(--ink);
      }

      button {
        font-weight: 700;
        border: 0;
        background: linear-gradient(130deg, #0f6b99 0%, #0c5f85 100%);
        color: #f8fcff;
        cursor: pointer;
      }

      .cards {
        margin-top: 0.75rem;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 0.55rem;
      }

      .card {
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 0.58rem;
        background: linear-gradient(160deg, #ffffff 0%, #f5fbff 100%);
      }

      .card .k {
        font-size: 0.74rem;
        color: var(--muted);
      }

      .card .v {
        margin-top: 0.2rem;
        font-size: 1.15rem;
        font-weight: 800;
      }

      .status {
        margin-top: 0.6rem;
        font-size: 0.8rem;
        color: var(--muted);
      }

      .status.ok { color: var(--ok); }
      .status.bad { color: var(--bad); }
      .status.warn { color: var(--warn); }

      .table-wrap {
        overflow: auto;
        border: 1px solid var(--line);
        border-radius: 12px;
        background: #fff;
        margin-top: 0.6rem;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        min-width: 980px;
      }

      th, td {
        text-align: left;
        border-bottom: 1px solid #e3ebf2;
        padding: 0.48rem 0.52rem;
        font-size: 0.77rem;
        vertical-align: top;
      }

      th {
        background: #f4f8fc;
        color: #415a6f;
        position: sticky;
        top: 0;
        z-index: 1;
      }

      .mono {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }

      .pill {
        display: inline-block;
        border-radius: 999px;
        padding: 0.12rem 0.42rem;
        font-size: 0.68rem;
        font-weight: 700;
        border: 1px solid transparent;
      }

      .pill.ok {
        background: #e9f7f3;
        color: #0f6a53;
        border-color: #c6e9dc;
      }

      .pill.error {
        background: #fcefed;
        color: #9a3d3d;
        border-color: #f3ceca;
      }

      .subtle {
        color: #62798c;
      }

      .top-links {
        margin-top: 0.55rem;
        font-size: 0.8rem;
      }

      .top-links a {
        color: #ecf5ff;
        font-weight: 700;
        text-decoration: none;
        margin-right: 0.65rem;
      }
    </style>
  </head>
  <body>
    <main>
      <section class="header">
        <h1>Gateway Usage Dashboard</h1>
        <p>Live view from request logs in D1 (<span class="mono">gateway_requests</span>) + aggregate metrics from <span class="mono">/v1/analytics</span>.</p>
        <div class="top-links">
          <a href="/">Home</a>
          <a href="/docs">API Docs</a>
          <a href="/playground">Playground</a>
        </div>
      </section>

      <section class="panel">
        <div class="controls">
          <div>
            <label for="apiKey">Gateway API Key</label>
            <input id="apiKey" type="password" placeholder="fagw_..." />
          </div>
          <div>
            <label for="projectId">Project ID (optional)</label>
            <input id="projectId" type="text" placeholder="project_abc" />
          </div>
          <div>
            <label for="dateFrom">Date From</label>
            <input id="dateFrom" type="date" />
          </div>
          <div>
            <label for="dateTo">Date To</label>
            <input id="dateTo" type="date" />
          </div>
          <div>
            <label for="endpoint">Endpoint</label>
            <select id="endpoint">
              <option value="">All</option>
              <option value="chat.completions">chat.completions</option>
              <option value="responses">responses</option>
              <option value="embeddings">embeddings</option>
            </select>
          </div>
          <div>
            <label for="outcome">Outcome</label>
            <select id="outcome">
              <option value="">All</option>
              <option value="ok">ok</option>
              <option value="error">error</option>
            </select>
          </div>
          <div>
            <label for="provider">Provider (optional)</label>
            <input id="provider" type="text" placeholder="gemini" />
          </div>
          <div>
            <label for="limit">Rows</label>
            <input id="limit" type="number" min="1" max="500" value="100" />
          </div>
          <div>
            <button id="refreshBtn" type="button">Refresh</button>
          </div>
        </div>

        <div class="cards">
          <div class="card"><div class="k">Total Requests</div><div class="v" id="totalRequests">-</div></div>
          <div class="card"><div class="k">Success Rate</div><div class="v" id="successRate">-</div></div>
          <div class="card"><div class="k">Avg Attempts</div><div class="v" id="avgAttempts">-</div></div>
          <div class="card"><div class="k">Avg Latency</div><div class="v" id="avgLatency">-</div></div>
        </div>

        <div id="status" class="status">Enter API key and press Refresh.</div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Received</th>
                <th>Request ID</th>
                <th>Endpoint</th>
                <th>Project</th>
                <th>Outcome</th>
                <th>Status</th>
                <th>Provider / Model</th>
                <th>Reasoning</th>
                <th>Attempts</th>
                <th>Latency</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody id="rows"></tbody>
          </table>
        </div>
      </section>
    </main>

    <script>
      const API_KEY_STORAGE = 'free-ai-dashboard-api-key-v1';
      const FILTER_STORAGE = 'free-ai-dashboard-filters-v1';
      const get = (id) => document.getElementById(id);

      const statusEl = get('status');
      const rowsEl = get('rows');

      function setStatus(text, tone) {
        statusEl.textContent = text;
        statusEl.className = 'status ' + (tone || '');
      }

      function defaultRange() {
        const now = new Date();
        const end = now.toISOString().slice(0, 10);
        const start = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        return { start, end };
      }

      function saveState() {
        localStorage.setItem(API_KEY_STORAGE, get('apiKey').value.trim());
        localStorage.setItem(FILTER_STORAGE, JSON.stringify({
          projectId: get('projectId').value.trim(),
          dateFrom: get('dateFrom').value,
          dateTo: get('dateTo').value,
          endpoint: get('endpoint').value,
          outcome: get('outcome').value,
          provider: get('provider').value.trim(),
          limit: get('limit').value,
        }));
      }

      function loadState() {
        const savedKey = localStorage.getItem(API_KEY_STORAGE);
        if (savedKey) get('apiKey').value = savedKey;

        const fallback = defaultRange();
        get('dateFrom').value = fallback.start;
        get('dateTo').value = fallback.end;

        const savedFilters = localStorage.getItem(FILTER_STORAGE);
        if (!savedFilters) return;
        try {
          const parsed = JSON.parse(savedFilters);
          if (parsed.projectId) get('projectId').value = parsed.projectId;
          if (parsed.dateFrom) get('dateFrom').value = parsed.dateFrom;
          if (parsed.dateTo) get('dateTo').value = parsed.dateTo;
          if (parsed.endpoint) get('endpoint').value = parsed.endpoint;
          if (parsed.outcome) get('outcome').value = parsed.outcome;
          if (parsed.provider) get('provider').value = parsed.provider;
          if (parsed.limit) get('limit').value = parsed.limit;
        } catch {}
      }

      async function fetchJson(url, apiKey) {
        const res = await fetch(url, {
          headers: {
            authorization: 'Bearer ' + apiKey,
          },
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          const message = body && body.error && body.error.message ? body.error.message : ('HTTP ' + res.status);
          throw new Error(message);
        }
        return body;
      }

      function formatPercent(value) {
        if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
        return (value * 100).toFixed(1) + '%';
      }

      function formatNumber(value) {
        if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
        return value.toLocaleString();
      }

      function formatLatency(value) {
        if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
        return Math.round(value) + ' ms';
      }

      function escapeHtml(value) {
        return String(value)
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#39;');
      }

      function buildQuery(basePath, maxLimit) {
        const params = new URLSearchParams();
        const projectId = get('projectId').value.trim();
        const dateFrom = get('dateFrom').value;
        const dateTo = get('dateTo').value;
        const limit = Math.max(1, Math.min(maxLimit, Number(get('limit').value || 100)));
        const endpoint = get('endpoint').value;
        const outcome = get('outcome').value;
        const provider = get('provider').value.trim();

        if (projectId) params.set('project_id', projectId);
        if (dateFrom) params.set('date_from', dateFrom);
        if (dateTo) params.set('date_to', dateTo);
        params.set('limit', String(limit));
        if (endpoint) params.set('endpoint', endpoint);
        if (outcome) params.set('outcome', outcome);
        if (provider) params.set('provider', provider);

        return basePath + '?' + params.toString();
      }

      function renderRows(items) {
        if (!Array.isArray(items) || items.length === 0) {
          rowsEl.innerHTML = '<tr><td colspan="11" class="subtle">No rows found for selected filters.</td></tr>';
          return;
        }

        rowsEl.innerHTML = items.map((row) => {
          const project = row.project_id ? escapeHtml(row.project_id) : '<span class="subtle">unscoped</span>';
          const provider = row.chosen_provider ? escapeHtml(row.chosen_provider) : '<span class="subtle">-</span>';
          const model = row.chosen_model ? escapeHtml(row.chosen_model) : '<span class="subtle">-</span>';
          const outcomeValue = row.outcome === 'ok' ? 'ok' : 'error';
          const outcomeClass = outcomeValue === 'ok' ? 'ok' : 'error';
          const errorValue = row.error_type ? escapeHtml(row.error_type) : '<span class="subtle">-</span>';
          const received = escapeHtml(String(row.received_at || '').replace('T', ' ').slice(0, 19));
          const requestId = escapeHtml(row.request_id || '-');
          const endpoint = escapeHtml(row.endpoint || '-');
          const statusCode = escapeHtml(String(row.status_code ?? '-'));
          const reasoning = escapeHtml(row.reasoning_effort || '-');
          const attempts = escapeHtml(String(row.attempts ?? '-'));
          const latency = row.latency_ms == null ? '-' : escapeHtml(String(row.latency_ms) + ' ms');
          return '<tr>' +
            '<td class="mono">' + received + '</td>' +
            '<td class="mono">' + requestId + '</td>' +
            '<td class="mono">' + endpoint + '</td>' +
            '<td class="mono">' + project + '</td>' +
            '<td><span class="pill ' + outcomeClass + '">' + outcomeValue + '</span></td>' +
            '<td class="mono">' + statusCode + '</td>' +
            '<td><div class="mono">' + provider + '</div><div class="subtle mono">' + model + '</div></td>' +
            '<td class="mono">' + reasoning + '</td>' +
            '<td class="mono">' + attempts + '</td>' +
            '<td class="mono">' + latency + '</td>' +
            '<td class="mono">' + errorValue + '</td>' +
          '</tr>';
        }).join('');
      }

      async function refresh() {
        const apiKey = get('apiKey').value.trim();
        if (!apiKey) {
          setStatus('Gateway API key is required.', 'bad');
          return;
        }

        saveState();
        setStatus('Loading usage data...', 'warn');

        try {
          const [analytics, requests] = await Promise.all([
            fetchJson(buildQuery('/v1/analytics', 100), apiKey),
            fetchJson(buildQuery('/v1/requests', 500), apiKey),
          ]);

          get('totalRequests').textContent = formatNumber(analytics.totals && analytics.totals.total_requests);
          get('successRate').textContent = formatPercent(analytics.totals && analytics.totals.success_rate);
          get('avgAttempts').textContent = formatNumber(analytics.totals && analytics.totals.avg_attempts);
          get('avgLatency').textContent = formatLatency(analytics.totals && analytics.totals.avg_latency_ms);
          renderRows(requests.data || []);
          setStatus('Loaded ' + formatNumber((requests.pagination && requests.pagination.returned) || 0) + ' request rows.', 'ok');
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          renderRows([]);
          setStatus('Failed to load dashboard data: ' + message, 'bad');
        }
      }

      get('refreshBtn').addEventListener('click', refresh);
      ['projectId', 'dateFrom', 'dateTo', 'endpoint', 'outcome', 'provider', 'limit', 'apiKey'].forEach((id) => {
        get(id).addEventListener('change', saveState);
      });

      loadState();
    </script>
  </body>
</html>`;
}
