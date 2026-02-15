import type { ProviderCaller } from './types';

interface CliBridgeSseEvent {
  text?: string;
  error?: string;
}

async function* parseSseEvents(response: Response): AsyncIterable<CliBridgeSseEvent> {
  if (!response.body) {
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    while (true) {
      const boundaryIndex = buffer.indexOf('\n\n');
      if (boundaryIndex === -1) {
        break;
      }

      const frame = buffer.slice(0, boundaryIndex);
      buffer = buffer.slice(boundaryIndex + 2);

      const dataLines = frame
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.startsWith('data:'));

      for (const line of dataLines) {
        const payloadText = line.replace(/^data:\s*/, '').trim();

        if (!payloadText || payloadText === '[DONE]') {
          continue;
        }

        try {
          yield JSON.parse(payloadText) as CliBridgeSseEvent;
        } catch {
          yield { text: payloadText };
        }
      }
    }
  }
}

export const callCliBridge: ProviderCaller = async (input) => {
  const baseUrl = input.env.CLI_BRIDGE_URL?.replace(/\/+$/, '');
  if (!baseUrl) {
    throw new Error('CLI_BRIDGE_URL is not configured');
  }

  const bridgeProvider = input.env.CLI_BRIDGE_PROVIDER ?? 'codex';

  const response = await fetch(`${baseUrl}/chat`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      provider: bridgeProvider,
      model: input.model === 'default' ? undefined : input.model,
      messages: input.messages,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`cli-bridge upstream error (${response.status}): ${text}`);
  }

  if (input.stream) {
    async function* bridgeStream() {
      for await (const event of parseSseEvents(response)) {
        if (event.error) {
          throw new Error(event.error);
        }

        if (!event.text) {
          continue;
        }

        yield {
          id: `chatcmpl-${crypto.randomUUID()}`,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: input.model,
          choices: [
            {
              index: 0,
              delta: { content: event.text },
              finish_reason: null,
            },
          ],
        };
      }
    }

    return {
      provider: 'cli_bridge',
      model: input.model,
      stream: true,
      streamSource: bridgeStream(),
    };
  }

  let fullText = '';
  for await (const event of parseSseEvents(response)) {
    if (event.error) {
      throw new Error(event.error);
    }

    if (event.text) {
      fullText += event.text;
    }
  }

  return {
    provider: 'cli_bridge',
    model: input.model,
    stream: false,
    completion: {
      id: `cb-${crypto.randomUUID()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: input.model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: fullText.trim(),
          },
          finish_reason: 'stop',
        },
      ],
    },
  };
};
