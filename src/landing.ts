export function renderLandingHtml(params: { playgroundEnabled: boolean }): string {
  const playgroundCta = params.playgroundEnabled
    ? '<a class="btn primary" href="/playground">Open Dashboard</a>'
    : '<span class="btn disabled" title="PLAYGROUND_ENABLED is false in deployed vars">Dashboard Disabled</span>';

  const playgroundHint = params.playgroundEnabled
    ? 'Dashboard is live for interactive sandbox testing.'
    : 'Dashboard is currently disabled. Set PLAYGROUND_ENABLED=true to expose /playground.';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Free AI Gateway</title>
    <style>
      :root {
        --ink: #12212e;
        --ink-soft: #466072;
        --line: #d4e0e8;
        --panel: #ffffff;
        --panel-soft: #f6fafb;
        --brand: #0b6e99;
        --brand-strong: #0e7490;
        --warm: #c77d18;
        --ok: #0f766e;
        --shadow: 0 18px 50px rgba(16, 24, 40, 0.14);
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        color: var(--ink);
        font-family: "Avenir Next", "Trebuchet MS", "Segoe UI", sans-serif;
        background:
          radial-gradient(130% 90% at 0% 0%, rgba(11, 110, 153, 0.2), transparent 56%),
          radial-gradient(130% 90% at 100% 0%, rgba(199, 125, 24, 0.17), transparent 58%),
          linear-gradient(165deg, #f2f7fb 0%, #edf6fa 45%, #f8f4eb 100%);
      }

      main {
        max-width: 1080px;
        margin: 0 auto;
        padding: 1.2rem 1rem 2.5rem;
      }

      .hero {
        border-radius: 24px;
        padding: 1.3rem 1.15rem;
        background: linear-gradient(130deg, #123446 0%, #17536f 42%, #1d6d7f 100%);
        color: #f8fcff;
        box-shadow: var(--shadow);
      }

      .eyebrow {
        margin: 0;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-size: 0.72rem;
        opacity: 0.86;
      }

      h1 {
        margin: 0.45rem 0 0;
        font-size: clamp(1.45rem, 4.6vw, 2.25rem);
        line-height: 1.1;
        font-family: "Gill Sans", "Trebuchet MS", sans-serif;
      }

      .hero p {
        margin: 0.72rem 0 0;
        line-height: 1.45;
        color: rgba(241, 247, 252, 0.93);
        max-width: 760px;
      }

      .hero-actions {
        margin-top: 0.95rem;
        display: flex;
        flex-wrap: wrap;
        gap: 0.58rem;
      }

      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        text-decoration: none;
        border: 1px solid rgba(255, 255, 255, 0.28);
        padding: 0.48rem 0.9rem;
        font-size: 0.82rem;
        font-weight: 600;
      }

      .btn.primary {
        color: #f9fafb;
        background: linear-gradient(130deg, #0f766e 0%, #0f766e 40%, #0c4a6e 100%);
        border: 0;
      }

      .btn.secondary {
        color: #f4f8fc;
        background: rgba(255, 255, 255, 0.15);
      }

      .btn.disabled {
        color: rgba(255, 255, 255, 0.75);
        background: rgba(255, 255, 255, 0.08);
        cursor: not-allowed;
      }

      .hint {
        margin: 0.6rem 0 0;
        font-size: 0.8rem;
        color: rgba(237, 246, 255, 0.92);
      }

      .grid {
        margin-top: 0.95rem;
        display: grid;
        gap: 0.86rem;
        grid-template-columns: 1fr;
      }

      @media (min-width: 930px) {
        .grid {
          grid-template-columns: 1fr 1fr;
        }
      }

      .panel {
        border-radius: 16px;
        background: linear-gradient(150deg, var(--panel) 0%, var(--panel-soft) 100%);
        border: 1px solid var(--line);
        box-shadow: 0 10px 26px rgba(15, 23, 42, 0.08);
        padding: 0.82rem;
      }

      .panel h2 {
        margin: 0;
        font-size: 1rem;
      }

      .panel p {
        margin: 0.5rem 0 0;
        color: var(--ink-soft);
        font-size: 0.86rem;
        line-height: 1.42;
      }

      .list {
        margin: 0.56rem 0 0;
        padding-left: 1rem;
        color: var(--ink-soft);
        font-size: 0.86rem;
      }

      .list li {
        margin: 0.28rem 0;
      }

      .mono {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 0.81rem;
        color: #264153;
      }

      .links {
        margin-top: 0.6rem;
        display: flex;
        flex-wrap: wrap;
        gap: 0.45rem;
      }

      .links a {
        color: var(--brand);
        text-decoration: none;
        font-size: 0.85rem;
        font-weight: 600;
      }

      footer {
        margin-top: 0.85rem;
        color: #4a6173;
        font-size: 0.77rem;
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <p class="eyebrow">Free AI Gateway</p>
        <h1>One endpoint for free-model AI routing</h1>
        <p>
          OpenAI-compatible gateway with health-aware provider selection, retry policies,
          and optional internal dashboard for live sandbox testing.
        </p>
        <div class="hero-actions">
          ${playgroundCta}
          <a class="btn secondary" href="/docs">API Docs</a>
          <a class="btn secondary" href="/health">Health</a>
        </div>
        <p class="hint">${playgroundHint}</p>
      </section>

      <section class="grid">
        <article class="panel">
          <h2>Backend Endpoints</h2>
          <ul class="list">
            <li><span class="mono">POST /v1/chat/completions</span> (auth required)</li>
            <li><span class="mono">POST /v1/responses</span> (auth required)</li>
            <li><span class="mono">POST /v1/embeddings</span> (auth required)</li>
            <li><span class="mono">GET /v1/models</span> (auth required)</li>
            <li><span class="mono">GET /v1/analytics</span> (auth required)</li>
            <li><span class="mono">GET /health</span></li>
            <li><span class="mono">POST /access/request-key</span></li>
          </ul>
          <div class="links">
            <a href="/v1/models">/v1/models</a>
            <a href="/v1/analytics">/v1/analytics</a>
            <a href="/openapi.json">/openapi.json</a>
            <a href="/docs">/docs</a>
          </div>
        </article>

        <article class="panel">
          <h2>How to Get a Key</h2>
          <p>
            Submit a request through <span class="mono">/playground</span> or call
            <span class="mono">POST /access/request-key</span> from your backend.
            Auto issue is currently disabled. You will receive a request ID, then an operator issues your gateway key.
          </p>
          <p>
            Use the key as <span class="mono">Authorization: Bearer &lt;GATEWAY_API_KEY&gt;</span>.
          </p>
          <div class="links">
            <a href="/playground">Open dashboard</a>
            <a href="/docs">Open API docs</a>
          </div>
        </article>
      </section>

      <footer>
        Tip: send <span class="mono">Accept: application/json</span> to <span class="mono">/</span> for machine-readable service metadata.
      </footer>
    </main>
  </body>
</html>`;
}
