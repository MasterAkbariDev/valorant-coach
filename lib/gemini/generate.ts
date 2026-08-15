import { GoogleGenAI } from "@google/genai";
import { geminiKeys, requireGeminiKey } from "@/lib/env";

const CAPABLE_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3-flash-preview",
  "gemini-3-flash",
  "gemini-2.5-flash",
  "gemini-flash-latest",
];

const LITE_MODELS = ["gemini-3.5-flash-lite", "gemini-2.5-flash-lite", "gemini-flash-lite-latest"];

let lastGoodModel: string | null = null;
let lastGoodKey: string | null = null;

function errorText(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function shortError(error: unknown) {
  const text = errorText(error);
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string }; message?: string };
    const message = parsed.error?.message || parsed.message;
    if (message) return String(message).split("\n")[0];
  } catch {
    /* not json */
  }
  return text.split("\n")[0].slice(0, 280);
}

export function isQuotaError(error: unknown) {
  const text = errorText(error);
  return /429|RESOURCE_EXHAUSTED|quota|rate[- ]limit|exceeded your current quota/i.test(text);
}

function isModelUnavailable(error: unknown) {
  const text = errorText(error);
  return /404|NOT_FOUND|not found|not supported|UNKNOWN_MODEL|invalid argument.*model/i.test(text);
}

function isThinkingUnsupported(error: unknown) {
  return /thinking|thinkingBudget|thinking_config/i.test(errorText(error));
}

export function geminiModelQueue(skipLite = false) {
  const preferred = process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";
  const extra = (process.env.GEMINI_FALLBACK_MODELS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const models = [...new Set([lastGoodModel, preferred, ...extra, ...CAPABLE_MODELS, ...LITE_MODELS].filter(Boolean) as string[])];
  if (!skipLite) return models;
  return models.filter((model) => !/lite/i.test(model));
}

function extractModelText(response: unknown) {
  const payload = response as {
    text?: string;
    output_text?: string;
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  };
  if (typeof payload.text === "string") return payload.text;
  if (typeof payload.output_text === "string") return payload.output_text;
  return (payload.candidates?.[0]?.content?.parts ?? []).map((part) => part.text ?? "").join("");
}

function looksUnusable(text: string, accept?: (text: string) => boolean) {
  const trimmed = text.trim();
  if (!trimmed || trimmed === "{}" || trimmed === "[]") return true;
  if (accept) return !accept(trimmed);
  return false;
}

function withOutputBudget(config?: Record<string, unknown>) {
  return {
    maxOutputTokens: 8192,
    thinkingConfig: { thinkingBudget: 0 },
    ...config,
  };
}

type GenerateArgs = {
  contents: unknown;
  config?: Record<string, unknown>;
  accept?: (text: string) => boolean;
  skipLite?: boolean;
};

export async function generateContentWithFallback(args: GenerateArgs) {
  const keys = [...new Set([lastGoodKey, ...geminiKeys()].filter(Boolean) as string[])];
  if (!keys.length) requireGeminiKey();
  const models = geminiModelQueue(args.skipLite);
  if (!models.length) {
    throw new Error("No Gemini models available");
  }
  let lastError: unknown;

  for (const model of models) {
    for (const apiKey of keys) {
      const ai = new GoogleGenAI({ apiKey });
      const configs: Record<string, unknown>[] = [withOutputBudget(args.config)];
      if (args.config?.responseSchema) {
        const { responseMimeType: _mime, responseSchema: _schema, ...rest } = args.config;
        configs.push(withOutputBudget(rest));
      }

      let keyQuota = false;
      for (const config of configs) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: args.contents as never,
            config,
          });
          const text = extractModelText(response);
          if (looksUnusable(text, args.accept)) {
            lastError = new Error("Model returned empty notes");
            continue;
          }
          lastGoodModel = model;
          lastGoodKey = apiKey;
          return { response, model, text };
        } catch (error) {
          lastError = error;
          if (isThinkingUnsupported(error)) {
            try {
              const { thinkingConfig: _thinking, ...rest } = config;
              const response = await ai.models.generateContent({
                model,
                contents: args.contents as never,
                config: rest,
              });
              const text = extractModelText(response);
              if (looksUnusable(text, args.accept)) {
                lastError = new Error("Model returned empty notes");
                continue;
              }
              lastGoodModel = model;
              lastGoodKey = apiKey;
              return { response, model, text };
            } catch (retryError) {
              lastError = retryError;
              if (isQuotaError(retryError)) keyQuota = true;
            }
          }
          if (isQuotaError(error)) {
            keyQuota = true;
            break;
          }
          if (isModelUnavailable(error)) break;
        }
      }
      if (!keyQuota && isModelUnavailable(lastError)) break;
    }
  }

  if (isQuotaError(lastError)) {
    throw new Error("Gemini is rate-limited on every available model. Wait about a minute and search again.");
  }
  throw new Error(shortError(lastError) || "Gemini request failed");
}
