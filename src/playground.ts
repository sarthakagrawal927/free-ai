export function renderPlaygroundHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Free AI Gateway Platform</title>
    <style>
      :root {
        --ink: #12252c;
        --ink-soft: #51656b;
        --line: #d5e1dc;
        --panel: #f8fbf7;
        --panel-strong: #ffffff;
        --accent: #0f766e;
        --accent-strong: #115e59;
        --warm: #b45309;
        --error: #b42318;
        --ok: #0f766e;
        --shadow: 0 18px 45px rgba(16, 24, 40, 0.16);
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        color: var(--ink);
        font-family: "Avenir Next", "Segoe UI", "Trebuchet MS", sans-serif;
        background:
          radial-gradient(180% 120% at 0% 0%, rgba(15, 118, 110, 0.24), transparent 58%),
          radial-gradient(150% 120% at 100% 0%, rgba(180, 83, 9, 0.22), transparent 62%),
          linear-gradient(160deg, #f2f7f0 0%, #edf5f1 40%, #f8f3ea 100%);
      }

      main {
        max-width: 1180px;
        margin: 0 auto;
        padding: 1.25rem 1rem 2.6rem;
      }

      .hero {
        position: relative;
        overflow: hidden;
        background: linear-gradient(130deg, #12343d 0%, #1f4b56 45%, #2e6a6a 100%);
        color: #f7fbff;
        border-radius: 24px;
        padding: 1.3rem 1.2rem;
        box-shadow: var(--shadow);
      }

      .hero::after {
        content: "";
        position: absolute;
        inset: auto -14% -60% auto;
        width: 330px;
        height: 330px;
        background: radial-gradient(circle, rgba(252, 211, 77, 0.24), rgba(252, 211, 77, 0));
        pointer-events: none;
      }

      .eyebrow {
        margin: 0;
        letter-spacing: 0.11em;
        font-size: 0.74rem;
        text-transform: uppercase;
        color: rgba(248, 250, 252, 0.88);
      }

      h1 {
        margin: 0.4rem 0 0;
        font-size: clamp(1.5rem, 4.8vw, 2.25rem);
        line-height: 1.1;
        font-family: "Gill Sans", "Trebuchet MS", sans-serif;
      }

      .hero p {
        margin: 0.7rem 0 0;
        color: rgba(235, 241, 245, 0.9);
        max-width: 760px;
        line-height: 1.45;
      }

      .hero-meta {
        margin-top: 0.95rem;
        display: flex;
        flex-wrap: wrap;
        gap: 0.6rem;
      }

      .pill {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.28);
        background: rgba(255, 255, 255, 0.14);
        color: #f8fafc;
        padding: 0.32rem 0.72rem;
        font-size: 0.78rem;
        white-space: nowrap;
      }

      .pill.link {
        text-decoration: none;
      }

      .layout {
        margin-top: 1.05rem;
      }

      .grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 0.9rem;
      }

      .portal-grid {
        margin-top: 0.9rem;
        display: grid;
        grid-template-columns: 1fr;
        gap: 0.9rem;
      }

      @media (min-width: 980px) {
        .grid {
          grid-template-columns: minmax(0, 1.03fr) minmax(0, 0.97fr);
        }

        .portal-grid {
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        }
      }

      .panel {
        background: linear-gradient(150deg, var(--panel-strong) 0%, var(--panel) 100%);
        border: 1px solid var(--line);
        border-radius: 18px;
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
        padding: 0.9rem;
      }

      .panel h2 {
        margin: 0;
        font-size: 1.05rem;
      }

      .panel h3 {
        margin: 0.65rem 0 0.4rem;
        font-size: 0.95rem;
      }

      .panel-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.7rem;
        margin-bottom: 0.66rem;
      }

      .status-chip {
        font-size: 0.74rem;
        border-radius: 999px;
        border: 1px solid rgba(18, 37, 44, 0.14);
        color: var(--ink-soft);
        background: #f8faf9;
        padding: 0.23rem 0.68rem;
      }

      .status-chip.run {
        color: #b45309;
        border-color: rgba(180, 83, 9, 0.28);
        background: #fff7ed;
      }

      .status-chip.ok {
        color: var(--ok);
        border-color: rgba(15, 118, 110, 0.34);
        background: #ecfdf5;
      }

      .status-chip.error {
        color: var(--error);
        border-color: rgba(180, 35, 24, 0.32);
        background: #fef2f2;
      }

      label {
        display: block;
        font-size: 0.79rem;
        font-weight: 600;
        color: #29404a;
        margin-bottom: 0.28rem;
      }

      input,
      textarea,
      select,
      button {
        width: 100%;
        border-radius: 12px;
        border: 1px solid var(--line);
        padding: 0.64rem 0.72rem;
        font-size: 0.93rem;
        background: #ffffff;
        color: var(--ink);
      }

      textarea {
        min-height: 120px;
        resize: vertical;
        line-height: 1.35;
      }

      input:focus,
      textarea:focus,
      select:focus,
      button:focus {
        outline: 2px solid rgba(15, 118, 110, 0.27);
        outline-offset: 1px;
      }

      .controls {
        display: grid;
        grid-template-columns: 1fr;
        gap: 0.65rem;
        margin-top: 0.7rem;
      }

      @media (min-width: 720px) {
        .controls {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      .actions {
        display: grid;
        grid-template-columns: 1fr;
        gap: 0.55rem;
        margin-top: 0.76rem;
      }

      @media (min-width: 560px) {
        .actions {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      button {
        cursor: pointer;
        border: 0;
        font-weight: 600;
      }

      button.primary {
        background: linear-gradient(130deg, var(--accent) 0%, var(--accent-strong) 70%);
        color: #f8fafc;
      }

      button.secondary {
        background: #ffffff;
        color: #213741;
        border: 1px solid #bfd1ca;
      }

      button[disabled] {
        cursor: not-allowed;
        opacity: 0.66;
      }

      .hint {
        margin: 0.72rem 0 0;
        font-size: 0.78rem;
        color: var(--ink-soft);
      }

      .result-block {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
        min-height: 110px;
        border-radius: 12px;
        border: 1px solid #d8e4dd;
        background: #0f2432;
        color: #e2e8f0;
        padding: 0.72rem;
        font-size: 0.84rem;
        line-height: 1.3;
      }

      .result-block.soft {
        background: #f8fbfc;
        color: #16333e;
        border: 1px solid #c8d8d6;
      }

      .request-form {
        display: grid;
        gap: 0.62rem;
      }

      .request-grid {
        display: grid;
        gap: 0.62rem;
      }

      @media (min-width: 720px) {
        .request-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      .history-list {
        display: grid;
        gap: 0.56rem;
      }

      .history-item {
        border-radius: 12px;
        border: 1px solid #d4e1db;
        background: #ffffff;
        padding: 0.6rem;
      }

      .history-head {
        display: flex;
        flex-wrap: wrap;
        gap: 0.38rem;
        justify-content: space-between;
        align-items: center;
        color: #32505a;
        font-size: 0.76rem;
      }

      .history-prompt {
        margin: 0.4rem 0;
        color: #213a43;
        font-size: 0.85rem;
        line-height: 1.35;
      }

      .empty {
        margin: 0;
        font-size: 0.82rem;
        color: var(--ink-soft);
      }

      .muted {
        margin: 0.45rem 0 0.68rem;
        color: var(--ink-soft);
        font-size: 0.82rem;
        line-height: 1.4;
      }

      footer {
        margin-top: 0.8rem;
        color: #47606a;
        font-size: 0.77rem;
      }

      .reveal {
        opacity: 0;
        transform: translateY(10px);
        animation: enter 420ms ease forwards;
      }

      .delay-1 { animation-delay: 80ms; }
      .delay-2 { animation-delay: 160ms; }
      .delay-3 { animation-delay: 240ms; }

      @keyframes enter {
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    </style>
  </head>
  <body>
    <main>
      <header class="hero reveal">
        <p class="eyebrow">Free AI Gateway</p>
        <h1>Sandbox Runner + API Key Request Portal</h1>
        <p>
          Use this internal platform screen to test live routing across free inference providers,
          compare responses, and submit key access requests for server-to-server integrations.
        </p>
        <div class="hero-meta">
          <span id="healthBadge" class="pill">Checking health...</span>
          <span class="pill">Endpoint: /v1/chat/completions</span>
          <a href="/docs" class="pill link">Open API Docs</a>
        </div>
      </header>

      <div class="layout">
        <div class="grid">
          <section class="panel reveal delay-1">
            <div class="panel-head">
              <h2>Run Sandbox Calls</h2>
              <span id="sandboxStatus" class="status-chip">Idle</span>
            </div>

            <label for="apiKey">Gateway API Key</label>
            <input id="apiKey" type="password" placeholder="Bearer key" autocomplete="off" />

            <label for="prompt" style="margin-top:0.64rem;">Prompt</label>
            <textarea id="prompt" placeholder="Ask something...">what color is panda</textarea>

            <div class="controls">
              <div>
                <label for="reasoning">Reasoning Effort</label>
                <select id="reasoning">
                  <option value="auto">auto</option>
                  <option value="low">low</option>
                  <option value="medium" selected>medium</option>
                  <option value="high">high</option>
                </select>
              </div>
              <div>
                <label for="stream">Mode</label>
                <select id="stream">
                  <option value="false" selected>non-stream</option>
                  <option value="true">stream</option>
                </select>
              </div>
              <div>
                <label for="providerA">Provider A</label>
                <select id="providerA">
                  <option value="">auto</option>
                  <option value="workers_ai">workers_ai</option>
                  <option value="groq">groq</option>
                  <option value="gemini">gemini</option>
                  <option value="cli_bridge">cli_bridge</option>
                </select>
              </div>
              <div>
                <label for="providerB">Provider B (compare)</label>
                <select id="providerB">
                  <option value="">none</option>
                  <option value="workers_ai">workers_ai</option>
                  <option value="groq">groq</option>
                  <option value="gemini">gemini</option>
                  <option value="cli_bridge">cli_bridge</option>
                </select>
              </div>
            </div>

            <div class="actions">
              <button id="runSingle" class="primary" type="button">Run Single</button>
              <button id="runCompare" class="secondary" type="button">Run Compare</button>
            </div>
            <p class="hint">History is local-only in this browser. API requests are sent to your gateway.</p>
          </section>

          <section class="panel reveal delay-2">
            <div class="panel-head">
              <h2>Live Output</h2>
              <span class="status-chip">JSON / SSE</span>
            </div>
            <h3>Result A</h3>
            <pre id="resultA" class="result-block"></pre>
            <h3>Result B</h3>
            <pre id="resultB" class="result-block"></pre>
          </section>
        </div>

        <div class="portal-grid">
          <section class="panel reveal delay-2">
            <div class="panel-head">
              <h2>Request API Key</h2>
              <span class="status-chip">Public form</span>
            </div>
            <p class="muted">
              Submit this form to request a gateway key. The endpoint stores the request with a generated request ID
              so you can review and approve externally. Auto issue is disabled on this deployment.
            </p>

            <form id="keyRequestForm" class="request-form">
              <div class="request-grid">
                <div>
                  <label for="requestName">Full Name</label>
                  <input id="requestName" type="text" placeholder="Jane Doe" required minlength="2" maxlength="80" />
                </div>
                <div>
                  <label for="requestEmail">Work Email</label>
                  <input id="requestEmail" type="email" placeholder="jane@company.com" required />
                </div>
                <div>
                  <label for="requestCompany">Company (optional)</label>
                  <input id="requestCompany" type="text" placeholder="Acme Labs" maxlength="120" />
                </div>
                <div>
                  <label for="requestDaily">Expected Daily Requests (optional)</label>
                  <input id="requestDaily" type="number" min="1" max="200000" step="1" placeholder="1200" />
                </div>
              </div>

              <div>
                <label for="requestUseType">Intended Use</label>
                <select id="requestUseType">
                  <option value="internal" selected>internal tool</option>
                  <option value="personal">personal project</option>
                  <option value="production">production workload</option>
                </select>
              </div>

              <div>
                <label for="requestUseCase">Use Case</label>
                <textarea id="requestUseCase" placeholder="What will you build with this gateway?" required minlength="10" maxlength="2000"></textarea>
              </div>

              <button id="requestKeyButton" class="primary" type="submit">Submit Key Request</button>
            </form>

            <h3 style="margin-top:0.75rem;">Request Response</h3>
            <pre id="keyRequestResult" class="result-block soft">No request submitted yet.</pre>
          </section>

          <section class="panel reveal delay-3">
            <div class="panel-head">
              <h2>Recent Sandbox History</h2>
              <span class="status-chip">Browser local</span>
            </div>
            <div id="history" class="history-list"></div>
          </section>
        </div>
      </div>

      <footer>
        Hidden route for internal testing. In production, keep <code>PLAYGROUND_ENABLED=false</code> unless needed.
      </footer>
    </main>

    <script>
      const HISTORY_KEY = 'free-ai-playground-history-v2';
      const API_KEY_KEY = 'free-ai-playground-api-key';

      const get = (id) => document.getElementById(id);

      function setStatus(message, kind) {
        const el = get('sandboxStatus');
        el.textContent = message;
        el.className = 'status-chip';
        if (kind) {
          el.classList.add(kind);
        }
      }

      function readHistory() {
        try {
          const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
          if (!Array.isArray(parsed)) {
            return [];
          }
          return parsed;
        } catch {
          return [];
        }
      }

      function writeHistory(items) {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 30)));
      }

      function formatTime(iso) {
        try {
          return new Date(iso).toLocaleString();
        } catch {
          return iso;
        }
      }

      function renderHistory() {
        const root = get('history');
        root.innerHTML = '';

        const items = readHistory();
        if (items.length === 0) {
          const empty = document.createElement('p');
          empty.className = 'empty';
          empty.textContent = 'No requests yet. Run a sandbox call to build history.';
          root.appendChild(empty);
          return;
        }

        for (const item of items) {
          const entry = document.createElement('article');
          entry.className = 'history-item';

          const head = document.createElement('div');
          head.className = 'history-head';
          head.textContent = formatTime(item.at);

          const detail = document.createElement('span');
          detail.textContent = (item.providerA || 'auto') + ' | ' + item.reasoning + ' | ' + (item.stream ? 'stream' : 'non-stream');
          head.appendChild(detail);

          const prompt = document.createElement('div');
          prompt.className = 'history-prompt';
          prompt.textContent = (item.prompt || '').slice(0, 220);

          const replay = document.createElement('button');
          replay.type = 'button';
          replay.className = 'secondary';
          replay.textContent = 'Replay';
          replay.onclick = () => {
            get('prompt').value = item.prompt || '';
            get('reasoning').value = item.reasoning || 'auto';
            get('stream').value = String(Boolean(item.stream));
            get('providerA').value = item.providerA || '';
            get('providerB').value = item.providerB || '';
          };

          entry.appendChild(head);
          entry.appendChild(prompt);
          entry.appendChild(replay);
          root.appendChild(entry);
        }
      }

      function saveCurrentToHistory() {
        const history = readHistory();
        history.unshift({
          at: new Date().toISOString(),
          prompt: get('prompt').value,
          reasoning: get('reasoning').value,
          stream: get('stream').value === 'true',
          providerA: get('providerA').value,
          providerB: get('providerB').value,
        });
        writeHistory(history);
        renderHistory();
      }

      function setButtonsDisabled(disabled) {
        get('runSingle').disabled = disabled;
        get('runCompare').disabled = disabled;
      }

      async function callGateway(options) {
        const provider = options.provider || '';
        const outputId = options.outputId;
        const silent = Boolean(options.silentStatus);

        const apiKey = get('apiKey').value.trim();
        const prompt = get('prompt').value.trim();
        const reasoning = get('reasoning').value;
        const stream = get('stream').value === 'true';
        const output = get(outputId);
        output.textContent = '';

        if (!apiKey) {
          output.textContent = 'Missing API key.';
          if (!silent) {
            setStatus('Missing API key', 'error');
          }
          return;
        }

        if (!prompt) {
          output.textContent = 'Missing prompt.';
          if (!silent) {
            setStatus('Missing prompt', 'error');
          }
          return;
        }

        const headers = {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey,
        };

        if (provider) {
          headers['x-gateway-force-provider'] = provider;
        }

        if (!silent) {
          setStatus('Running ' + (provider || 'auto') + '...', 'run');
        }

        let response;
        try {
          response = await fetch('/v1/chat/completions', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              model: 'auto',
              prompt,
              stream,
              reasoning_effort: reasoning,
            }),
          });
        } catch (error) {
          output.textContent = 'Network error: ' + (error instanceof Error ? error.message : String(error));
          if (!silent) {
            setStatus('Network error', 'error');
          }
          return;
        }

        if (!response.ok) {
          const text = await response.text();
          output.textContent = text;
          if (!silent) {
            setStatus('Request failed (' + response.status + ')', 'error');
          }
          return;
        }

        if (!stream) {
          let payload;
          try {
            payload = await response.json();
            output.textContent = JSON.stringify(payload, null, 2);
          } catch {
            output.textContent = await response.text();
          }

          if (!silent) {
            const providerName = payload && payload.x_gateway && payload.x_gateway.provider ? payload.x_gateway.provider : provider || 'auto';
            setStatus('Completed via ' + providerName, 'ok');
          }
          return;
        }

        const reader = response.body && response.body.getReader ? response.body.getReader() : null;
        if (!reader) {
          output.textContent = 'Streaming is not available in this browser.';
          if (!silent) {
            setStatus('Stream not supported', 'error');
          }
          return;
        }

        const decoder = new TextDecoder();
        while (true) {
          const part = await reader.read();
          if (part.done) {
            break;
          }
          output.textContent += decoder.decode(part.value, { stream: true });
        }

        if (!silent) {
          setStatus('Stream completed', 'ok');
        }
      }

      async function loadHealth() {
        try {
          const response = await fetch('/health');
          if (!response.ok) {
            get('healthBadge').textContent = 'Health check unavailable';
            return;
          }

          const payload = await response.json();
          const models = Array.isArray(payload.models) ? payload.models.length : 0;
          get('healthBadge').textContent = 'Gateway healthy | ' + models + ' models tracked';
        } catch {
          get('healthBadge').textContent = 'Health check unavailable';
        }
      }

      async function submitKeyRequest(event) {
        event.preventDefault();

        const responseBox = get('keyRequestResult');
        const dailyRaw = get('requestDaily').value.trim();
        const daily = dailyRaw ? Number(dailyRaw) : undefined;

        if (dailyRaw && (!Number.isInteger(daily) || daily < 1 || daily > 200000)) {
          responseBox.textContent = 'Expected daily requests must be an integer between 1 and 200000.';
          return;
        }

        const payload = {
          name: get('requestName').value.trim(),
          email: get('requestEmail').value.trim(),
          company: get('requestCompany').value.trim() || undefined,
          use_case: get('requestUseCase').value.trim(),
          intended_use: get('requestUseType').value,
          expected_daily_requests: daily,
        };

        responseBox.textContent = 'Submitting key request...';

        let response;
        try {
          response = await fetch('/access/request-key', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });
        } catch (error) {
          responseBox.textContent = 'Network error: ' + (error instanceof Error ? error.message : String(error));
          return;
        }

        const text = await response.text();
        let parsed = null;
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = null;
        }

        if (parsed) {
          responseBox.textContent = JSON.stringify(parsed, null, 2);
        } else {
          responseBox.textContent = text;
        }

        if (response.ok) {
          get('keyRequestForm').reset();
          get('requestUseType').value = 'internal';
        }
      }

      get('apiKey').value = localStorage.getItem(API_KEY_KEY) || '';
      get('apiKey').addEventListener('input', () => {
        localStorage.setItem(API_KEY_KEY, get('apiKey').value);
      });

      get('runSingle').onclick = async () => {
        setButtonsDisabled(true);
        saveCurrentToHistory();
        get('resultB').textContent = '';
        await callGateway({ provider: get('providerA').value || '', outputId: 'resultA' });
        setButtonsDisabled(false);
      };

      get('runCompare').onclick = async () => {
        setButtonsDisabled(true);
        saveCurrentToHistory();

        const providerA = get('providerA').value || '';
        const providerB = get('providerB').value || '';

        await Promise.all([
          callGateway({ provider: providerA, outputId: 'resultA' }),
          providerB ? callGateway({ provider: providerB, outputId: 'resultB', silentStatus: true }) : Promise.resolve(),
        ]);

        if (!providerB) {
          get('resultB').textContent = 'Select Provider B to run a compare call.';
        }

        setButtonsDisabled(false);
      };

      get('keyRequestForm').addEventListener('submit', submitKeyRequest);

      renderHistory();
      loadHealth();
      setInterval(loadHealth, 30000);
    </script>
  </body>
</html>`;
}
