export function renderPlaygroundHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Free AI Gateway Playground</title>
    <style>
      :root {
        --bg: #f4f5f7;
        --card: #ffffff;
        --text: #0f172a;
        --muted: #475569;
        --accent: #0ea5e9;
        --border: #d9e2ec;
      }
      body {
        margin: 0;
        font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: linear-gradient(120deg, #ecfeff, #f8fafc 40%, #eef2ff);
        color: var(--text);
      }
      main {
        max-width: 1100px;
        margin: 0 auto;
        padding: 2rem 1rem 4rem;
      }
      .grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 1rem;
      }
      @media (min-width: 960px) {
        .grid {
          grid-template-columns: 1fr 1fr;
        }
      }
      .card {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 14px;
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
        padding: 1rem;
      }
      textarea,
      select,
      input,
      button {
        width: 100%;
        box-sizing: border-box;
        border-radius: 10px;
        border: 1px solid var(--border);
        padding: 0.65rem 0.75rem;
        font-size: 0.94rem;
      }
      textarea {
        min-height: 140px;
        resize: vertical;
      }
      .controls {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.7rem;
        margin-top: 0.7rem;
      }
      .actions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.7rem;
        margin-top: 0.7rem;
      }
      button {
        background: linear-gradient(135deg, #0284c7, #2563eb);
        color: #fff;
        border: 0;
        cursor: pointer;
      }
      button.secondary {
        background: #fff;
        color: #111827;
        border: 1px solid var(--border);
      }
      pre {
        white-space: pre-wrap;
        word-break: break-word;
        background: #0f172a;
        color: #cbd5e1;
        border-radius: 10px;
        padding: 0.9rem;
        min-height: 160px;
      }
      .muted {
        color: var(--muted);
        font-size: 0.88rem;
      }
      .history-item {
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 0.65rem;
        margin-top: 0.5rem;
        background: #fff;
      }
      .history-item button {
        margin-top: 0.4rem;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Free AI Gateway Playground</h1>
      <p class="muted">Hidden internal tester. Calls <code>/v1/chat/completions</code>.</p>
      <div class="grid">
        <section class="card">
          <label for="apiKey">Gateway API Key</label>
          <input id="apiKey" type="password" placeholder="Bearer key" />
          <label for="prompt" style="margin-top:0.7rem;display:block;">Prompt</label>
          <textarea id="prompt" placeholder="Ask something..."></textarea>
          <div class="controls">
            <div>
              <label for="reasoning">Reasoning Effort</label>
              <select id="reasoning">
                <option value="auto">auto</option>
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </select>
            </div>
            <div>
              <label for="stream">Mode</label>
              <select id="stream">
                <option value="false">non-stream</option>
                <option value="true">stream</option>
              </select>
            </div>
            <div>
              <label for="providerA">Compare Provider A</label>
              <select id="providerA">
                <option value="">auto</option>
                <option value="workers_ai">workers_ai</option>
                <option value="groq">groq</option>
                <option value="gemini">gemini</option>
              </select>
            </div>
            <div>
              <label for="providerB">Compare Provider B</label>
              <select id="providerB">
                <option value="">none</option>
                <option value="workers_ai">workers_ai</option>
                <option value="groq">groq</option>
                <option value="gemini">gemini</option>
              </select>
            </div>
          </div>
          <div class="actions">
            <button id="runSingle">Run Single</button>
            <button id="runCompare" class="secondary">Run Compare</button>
          </div>
        </section>
        <section class="card">
          <h3>Result A</h3>
          <pre id="resultA"></pre>
          <h3>Result B</h3>
          <pre id="resultB"></pre>
        </section>
      </div>
      <section class="card" style="margin-top:1rem;">
        <h3>History</h3>
        <div id="history"></div>
      </section>
    </main>
    <script>
      const KEY = 'free-ai-playground-history-v1';
      const get = (id) => document.getElementById(id);

      function readHistory() {
        try {
          return JSON.parse(localStorage.getItem(KEY) || '[]');
        } catch {
          return [];
        }
      }

      function writeHistory(items) {
        localStorage.setItem(KEY, JSON.stringify(items.slice(0, 30)));
      }

      function renderHistory() {
        const root = get('history');
        root.innerHTML = '';
        for (const item of readHistory()) {
          const el = document.createElement('div');
          el.className = 'history-item';
          el.innerHTML = '<div><strong>' + item.at + '</strong></div>' +
            '<div class="muted">' + (item.prompt || '').slice(0, 140) + '</div>';
          const button = document.createElement('button');
          button.textContent = 'Replay';
          button.className = 'secondary';
          button.onclick = () => {
            get('prompt').value = item.prompt;
            get('reasoning').value = item.reasoning;
            get('stream').value = String(item.stream);
            get('providerA').value = item.providerA || '';
            get('providerB').value = item.providerB || '';
          };
          el.appendChild(button);
          root.appendChild(el);
        }
      }

      async function callGateway({ provider, outputId }) {
        const apiKey = get('apiKey').value.trim();
        const prompt = get('prompt').value;
        const reasoning = get('reasoning').value;
        const stream = get('stream').value === 'true';
        const output = get(outputId);
        output.textContent = '';

        const headers = {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey,
        };

        if (provider) {
          headers['x-gateway-force-provider'] = provider;
        }

        const response = await fetch('/v1/chat/completions', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: 'auto',
            prompt,
            stream,
            reasoning_effort: reasoning,
          }),
        });

        if (!response.ok) {
          output.textContent = await response.text();
          return;
        }

        if (!stream) {
          output.textContent = JSON.stringify(await response.json(), null, 2);
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          output.textContent += decoder.decode(value, { stream: true });
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

      get('runSingle').onclick = async () => {
        saveCurrentToHistory();
        await callGateway({ provider: get('providerA').value || '', outputId: 'resultA' });
      };

      get('runCompare').onclick = async () => {
        saveCurrentToHistory();
        const providerA = get('providerA').value || '';
        const providerB = get('providerB').value || '';
        await Promise.all([
          callGateway({ provider: providerA, outputId: 'resultA' }),
          providerB ? callGateway({ provider: providerB, outputId: 'resultB' }) : Promise.resolve(),
        ]);
      };

      renderHistory();
    </script>
  </body>
</html>`;
}
