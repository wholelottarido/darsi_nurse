import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createOllama } from "ollama-ai-provider-v2";

type LlmProvider = "openai-compatible" | "ollama";

type ResolvedLlmConfig = {
  provider: LlmProvider;
  model: string;
  baseUrl: string;
  apiKey?: string;
  displayName: string;
};

const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434/api";
const DEFAULT_OLLAMA_MODEL = "llama3.2";
const DEFAULT_NEMOTRON_BASE_URL = "http://10.9.23.200:8000/v1";
const DEFAULT_NEMOTRON_MODEL = "nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4";
const DEFAULT_NEMOTRON_API_KEY = "EMPTY";

function envTrim(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function mergeRequestBody(
  body: Record<string, unknown>,
  extra: Record<string, unknown>
) {
  return {
    ...body,
    ...extra,
    chat_template_kwargs: {
      ...((body.chat_template_kwargs as Record<string, unknown> | undefined) ?? {}),
      ...((extra.chat_template_kwargs as Record<string, unknown> | undefined) ?? {}),
    },
  };
}

export function getResolvedLlmConfig(): ResolvedLlmConfig {
  const provider = (envTrim("LLM_PROVIDER") as LlmProvider | undefined) ?? "openai-compatible";

  if (provider === "ollama") {
    const baseUrl = envTrim("OLLAMA_HOST") ?? DEFAULT_OLLAMA_BASE_URL;
    const model = envTrim("LLM_MODEL") ?? DEFAULT_OLLAMA_MODEL;

    return {
      provider,
      model,
      baseUrl,
      displayName: `ollama:${model}`,
    };
  }

  const baseUrl = envTrim("LLM_BASE_URL") ?? DEFAULT_NEMOTRON_BASE_URL;
  const model = envTrim("LLM_MODEL") ?? DEFAULT_NEMOTRON_MODEL;
  const apiKey = envTrim("LLM_API_KEY") ?? DEFAULT_NEMOTRON_API_KEY;

  return {
    provider,
    model,
    baseUrl,
    apiKey,
    displayName: `openai-compatible:${model}`,
  };
}

export function getChatModel() {
  const config = getResolvedLlmConfig();

  if (config.provider === "ollama") {
    const ollama = createOllama({ baseURL: config.baseUrl });
    return ollama(config.model);
  }

  const provider = createOpenAICompatible({
    name: "vllm",
    baseURL: config.baseUrl,
    apiKey: config.apiKey ?? DEFAULT_NEMOTRON_API_KEY,
    transformRequestBody: (body) =>
      mergeRequestBody(body, {
        chat_template_kwargs: {
          enable_thinking: false,
        },
      }),
  });

  return provider.chatModel(config.model);
}
