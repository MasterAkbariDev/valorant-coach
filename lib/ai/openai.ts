function errorText(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

export async function chatCompletion(args: {
  url: string;
  apiKey: string;
  model: string;
  system: string;
  user: string;
  headers?: Record<string, string>;
  json?: boolean;
}) {
  const request = (json: boolean) =>
    fetch(args.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        "Content-Type": "application/json",
        ...args.headers,
      },
      body: JSON.stringify({
        model: args.model,
        temperature: 0.2,
        max_tokens: 1200,
        response_format: json ? { type: "json_object" } : undefined,
        messages: [
          { role: "system", content: args.system },
          { role: "user", content: args.user },
        ],
      }),
      signal: AbortSignal.timeout(45000),
    });

  let response = await request(args.json !== false);
  let raw = await response.text();
  if (!response.ok && args.json !== false && /response_format|json_object|json_schema/i.test(raw)) {
    response = await request(false);
    raw = await response.text();
  }
  if (!response.ok) {
    throw new Error(`${response.status} ${raw.slice(0, 280)}`);
  }
  const payload = JSON.parse(raw) as {
    choices?: { message?: { content?: string | Array<{ text?: string }> } }[];
  };
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((part) => part.text ?? "").join("");
  return "";
}

export function providerError(error: unknown) {
  return errorText(error).split("\n")[0].slice(0, 280);
}
