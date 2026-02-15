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

export const callWorkersAi: ProviderCaller = async (input) => {
  const payload: Record<string, unknown> = {
    messages: input.messages,
    temperature: input.temperature,
    max_tokens: input.max_tokens,
    stream: input.stream,
  };

  const result = await input.env.AI.run(input.model, payload);

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
