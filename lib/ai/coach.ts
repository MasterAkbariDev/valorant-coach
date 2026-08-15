import { chatCompletion, providerError } from "@/lib/ai/openai";
import { generateContentWithFallback, isQuotaError } from "@/lib/gemini/generate";
import { adviceSchema } from "@/lib/gemini/prompts";

type CoachArgs = {
  system: string;
  user: string;
  accept?: (text: string) => boolean;
};

function envList(value: string | undefined, fallback: string[]) {
  const extra = (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return extra.length ? extra : fallback;
}

function looksEmpty(text: string, accept?: (text: string) => boolean) {
  const trimmed = text.trim();
  if (!trimmed || trimmed === "{}" || trimmed === "[]") return true;
  if (accept) return !accept(trimmed);
  return false;
}

async function tryOpenAi(args: {
  label: string;
  url: string;
  apiKey: string;
  models: string[];
  headers?: Record<string, string>;
  system: string;
  user: string;
  accept?: (text: string) => boolean;
}) {
  let lastError: unknown;
  for (const model of args.models) {
    try {
      const text = await chatCompletion({
        url: args.url,
        apiKey: args.apiKey,
        model,
        system: args.system,
        user: args.user,
        headers: args.headers,
      });
      if (looksEmpty(text, args.accept)) {
        lastError = new Error(`${args.label} ${model} returned empty notes`);
        continue;
      }
      return { text, model: `${args.label}:${model}` };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(providerError(lastError) || `${args.label} failed`);
}

export async function generateCoachText(args: CoachArgs) {
  const errors: string[] = [];
  const groqKey = process.env.GROQ_API_KEY?.trim();
  const cerebrasKey = process.env.CEREBRAS_API_KEY?.trim();
  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
  const geminiKey = process.env.GEMINI_API_KEY?.trim();

  if (geminiKey) {
    try {
      const result = await generateContentWithFallback({
        contents: args.user,
        config: {
          systemInstruction: args.system,
          responseMimeType: "application/json",
          responseSchema: adviceSchema,
          temperature: 0.2,
          maxOutputTokens: 8192,
          thinkingConfig: { thinkingBudget: 0 },
        },
        accept: args.accept,
        skipLite: true,
      });
      return result;
    } catch (error) {
      errors.push(`gemini: ${providerError(error)}`);
    }
  }

  if (groqKey) {
    try {
      return await tryOpenAi({
        label: "groq",
        url: "https://api.groq.com/openai/v1/chat/completions",
        apiKey: groqKey,
        models: envList(process.env.GROQ_MODELS, ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]),
        system: args.system,
        user: args.user,
        accept: args.accept,
      });
    } catch (error) {
      errors.push(`groq: ${providerError(error)}`);
    }
  }

  if (cerebrasKey) {
    try {
      return await tryOpenAi({
        label: "cerebras",
        url: "https://api.cerebras.ai/v1/chat/completions",
        apiKey: cerebrasKey,
        models: envList(process.env.CEREBRAS_MODELS, ["llama-3.3-70b"]),
        system: args.system,
        user: args.user,
        accept: args.accept,
      });
    } catch (error) {
      errors.push(`cerebras: ${providerError(error)}`);
    }
  }

  if (openRouterKey) {
    try {
      return await tryOpenAi({
        label: "openrouter",
        url: "https://openrouter.ai/api/v1/chat/completions",
        apiKey: openRouterKey,
        models: envList(process.env.OPENROUTER_MODELS, [
          "meta-llama/llama-3.3-70b-instruct:free",
          "google/gemma-3-27b-it:free",
        ]),
        headers: {
          "HTTP-Referer": "http://localhost:3010",
          "X-Title": "Valorant Coach",
        },
        system: args.system,
        user: args.user,
        accept: args.accept,
      });
    } catch (error) {
      errors.push(`openrouter: ${providerError(error)}`);
    }
  }

  if (geminiKey) {
    try {
      return await generateContentWithFallback({
        contents: args.user,
        config: {
          systemInstruction: args.system,
          responseMimeType: "application/json",
          temperature: 0.2,
          maxOutputTokens: 8192,
        },
        accept: args.accept,
      });
    } catch (error) {
      errors.push(`gemini-lite: ${providerError(error)}`);
    }
  }

  if (errors.length && errors.every((item) => isQuotaError(item))) {
    throw new Error("Every free coach model is rate-limited. Wait a minute and search again.");
  }
  throw new Error(errors[0] || "No coach AI key is set. Add GEMINI_API_KEY or GROQ_API_KEY.");
}
