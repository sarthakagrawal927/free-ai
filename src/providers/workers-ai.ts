import type { ProviderCaller } from './types';

function normalizeWorkersResponse(result: unknown): string {
  if (result && typeof result === 'object') {
    const asObject = result as Record<string, unknown>;
    if (typeof asObject.response === 'string') {
      return asObject.response;
    }

    if (Array.isArray(asObject.output_text) && asObject.output_text.length > 0) {
      const [first] = asObject.output_text;
      if (typeof first === 'string') {
        return first;
      }
    }
  }

  if (typeof result === 'string') {
    return result;
  }

  return JSON.stringify(result);
}

async function callWorkersAiRest(
  accountId: string,
  token: string,
  model: string,
  payload: Record<string, unknown>,
): Promise<{ response: string; usage?: Record<string, unknown> }> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const json = (await response.json()) as {
    success?: boolean;
    errors?: Array<{ message?: string }>;
    result?: {
      response?: string;
      usage?: Record<string, unknown>;
    };
  };

  if (!response.ok || !json.success) {
    const message =
      json.errors?.map((item) => item.message).filter(Boolean).join('; ') ||
      `Workers AI REST error (${response.status})`;
    throw new Error(message);
  }

  return {
    response: json.result?.response ?? '',
    usage: json.result?.usage,
  };
}

export const callWorkersAi: ProviderCaller = async (input) => {
  const payload: Record<string, unknown> = {
    messages: input.messages,
    temperature: input.temperature,
    max_tokens: input.max_tokens,
    stream: input.stream,
  };

  const hasBinding = Boolean(input.env.AI && typeof input.env.AI.run === 'function');

  if (!hasBinding) {
    const accountId = input.env.CLOUDFLARE_ACCOUNT_ID;
    const token = input.env.CLOUDFLARE_WORKERS_AI_API_KEY;

    if (!accountId || !token) {
      throw new Error('Workers AI is unavailable: missing AI binding and REST fallback credentials');
    }

    const restResult = await callWorkersAiRest(accountId, token, input.model, {
      ...payload,
      stream: false,
    });

    if (input.stream) {
      async function* singleChunk() {
        yield { response: restResult.response };
      }

      return {
        provider: 'workers_ai',
        model: input.model,
        stream: true,
        streamSource: singleChunk(),
      };
    }

    return {
      provider: 'workers_ai',
      model: input.model,
      stream: false,
      completion: {
        id: `cf-${crypto.randomUUID()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: input.model,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: restResult.response,
            },
            finish_reason: 'stop',
          },
        ],
        usage: restResult.usage as { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number },
      },
    };
  }

  const result = await input.env.AI!.run(input.model, payload);

  if (input.stream) {
    if (result && typeof result === 'object' && Symbol.asyncIterator in result) {
      return {
        provider: 'workers_ai',
        model: input.model,
        stream: true,
        streamSource: result as AsyncIterable<unknown>,
      };
    }

    throw new Error('Workers AI stream source is not async iterable');
  }

  const content = normalizeWorkersResponse(result);

  return {
    provider: 'workers_ai',
    model: input.model,
    stream: false,
    completion: {
      id: `cf-${crypto.randomUUID()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: input.model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content,
          },
          finish_reason: 'stop',
        },
      ],
    },
  };
};
