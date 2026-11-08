import type { FunctionDeclaration, Tool } from "@google/generative-ai";

/**
 * Definisi tool agent ditulis dalam format FunctionDeclaration (SDK Google).
 * Nilai `SchemaType` sudah berupa string JSON Schema ("object", "string", …),
 * jadi cukup disalin ulang ke format function-calling Ollama/OpenAI tanpa
 * menulis ulang setiap tool.
 */
export type OllamaTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

const SCHEMA_KEYS = ["type", "description", "enum", "required", "format"] as const;

export function toJsonSchema(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== "object") return { type: "object", properties: {} };
  const src = schema as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  for (const key of SCHEMA_KEYS) {
    if (src[key] === undefined) continue;
    // Gemini memakai format "enum" untuk string ber-enum; JSON Schema tidak.
    if (key === "format" && src[key] === "enum") continue;
    out[key] = src[key];
  }
  if (typeof out.type === "string") out.type = out.type.toLowerCase();

  if (src.properties && typeof src.properties === "object") {
    out.properties = Object.fromEntries(
      Object.entries(src.properties as Record<string, unknown>).map(([k, v]) => [
        k,
        toJsonSchema(v),
      ]),
    );
  }
  if (src.items) out.items = toJsonSchema(src.items);
  if (out.type === "object" && !out.properties) out.properties = {};
  return out;
}

export function declarationToOllamaTool(decl: FunctionDeclaration): OllamaTool {
  return {
    type: "function",
    function: {
      name: decl.name,
      description: decl.description ?? "",
      parameters: toJsonSchema(decl.parameters ?? { type: "object", properties: {} }),
    },
  };
}

export function toOllamaTools(tools: Tool[]): OllamaTool[] {
  const out: OllamaTool[] = [];
  for (const tool of tools) {
    const decls = (tool as { functionDeclarations?: FunctionDeclaration[] })
      .functionDeclarations;
    for (const decl of decls ?? []) out.push(declarationToOllamaTool(decl));
  }
  return out;
}

/** Argumen tool bisa berupa objek atau string JSON (tergantung model). */
export function parseToolArguments(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed: unknown = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return {};
}
