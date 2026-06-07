import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createOllama } from "ollama-ai-provider-v2";

import { getChatModel, getResolvedLlmConfig } from "@/lib/llm";

type LlmProvider = "openai-compatible" | "ollama";
type LlmProfile = "clinical" | "operational" | "general";

export type RoutedLlmConfig = {
  provider: LlmProvider;
  model: string;
  baseUrl: string;
  apiKey?: string;
  displayName: string;
  profile: LlmProfile;
};

const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434/api";
const DEFAULT_GENERAL_OLLAMA_MODEL = "medgemma:4b";

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

function buildConfigFromEnv(profile: LlmProfile, fallback: ReturnType<typeof getResolvedLlmConfig>): RoutedLlmConfig {
  const prefix = `LLM_${profile.toUpperCase()}`;
  const provider = (envTrim(`${prefix}_PROVIDER`) as LlmProvider | undefined) ?? fallback.provider;

  if (provider === "ollama") {
    const baseUrl = envTrim(`${prefix}_BASE_URL`) ?? envTrim("OLLAMA_HOST") ?? fallback.baseUrl ?? DEFAULT_OLLAMA_BASE_URL;
    const model = envTrim(`${prefix}_MODEL`) ?? fallback.model;

    return {
      provider,
      model,
      baseUrl,
      displayName: `ollama:${model}`,
      profile,
    };
  }

  const baseUrl = envTrim(`${prefix}_BASE_URL`) ?? fallback.baseUrl;
  const model = envTrim(`${prefix}_MODEL`) ?? fallback.model;
  const apiKey = envTrim(`${prefix}_API_KEY`) ?? fallback.apiKey;

  return {
    provider,
    model,
    baseUrl,
    apiKey,
    displayName: `openai-compatible:${model}`,
    profile,
  };
}

function createModel(config: RoutedLlmConfig) {
  if (config.provider === "ollama") {
    const ollama = createOllama({ baseURL: config.baseUrl });
    return ollama(config.model);
  }

  const provider = createOpenAICompatible({
    name: `${config.profile}-router`,
    baseURL: config.baseUrl,
    apiKey: config.apiKey ?? "EMPTY",
    transformRequestBody: (body) =>
      mergeRequestBody(body, {
        chat_template_kwargs: {
          enable_thinking: false,
        },
      }),
  });

  return provider.chatModel(config.model);
}

export function getClinicalLlmConfig() {
  const fallback = getResolvedLlmConfig();
  return buildConfigFromEnv("clinical", fallback);
}

export function getOperationalLlmConfig() {
  const fallback = getClinicalLlmConfig();
  return buildConfigFromEnv("operational", fallback);
}

export function getGeneralGuidanceLlmConfig() {
  const hasGeneralOverride =
    Boolean(envTrim("LLM_GENERAL_PROVIDER")) ||
    Boolean(envTrim("LLM_GENERAL_BASE_URL")) ||
    Boolean(envTrim("LLM_GENERAL_MODEL")) ||
    Boolean(envTrim("LLM_GENERAL_API_KEY"));

  if (!hasGeneralOverride) {
    return {
      provider: "ollama" as const,
      model: DEFAULT_GENERAL_OLLAMA_MODEL,
      baseUrl: envTrim("OLLAMA_HOST") ?? DEFAULT_OLLAMA_BASE_URL,
      displayName: `ollama:${DEFAULT_GENERAL_OLLAMA_MODEL}`,
      profile: "general" as const,
    };
  }

  const fallback = getOperationalLlmConfig();
  return buildConfigFromEnv("general", fallback);
}

export function getClinicalModel() {
  const config = getClinicalLlmConfig();
  const fallback = getResolvedLlmConfig();

  if (
    config.provider === fallback.provider &&
    config.model === fallback.model &&
    config.baseUrl === fallback.baseUrl &&
    (config.apiKey ?? "") === (fallback.apiKey ?? "")
  ) {
    return getChatModel();
  }

  return createModel(config);
}

export function getOperationalModel() {
  return createModel(getOperationalLlmConfig());
}

export function getGeneralGuidanceModel() {
  return createModel(getGeneralGuidanceLlmConfig());
}
