import { describe, expect, it } from "vitest";
import { SchemaType, type Tool } from "@google/generative-ai";
import { parseToolArguments, toOllamaTools } from "@/lib/agent/ollama-tools";
import { COMPANY_AGENT_TOOL_DECLARATIONS } from "@/lib/agent/company-tools";
import { RESEARCH_AGENT_TOOL_DECLARATIONS } from "@/lib/agent/research-tools";
import { buildOllamaUserMessage, ollamaThinkForModel } from "@/lib/research/llm/ollama-adapter";

describe("toOllamaTools", () => {
  it("converts Gemini declarations to JSON-schema function tools", () => {
    const tools: Tool[] = [
      {
        functionDeclarations: [
          {
            name: "move_task",
            description: "Pindah task",
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                taskId: { type: SchemaType.STRING, description: "ID" },
                status: {
                  type: SchemaType.STRING,
                  format: "enum",
                  enum: ["TODO", "DONE"],
                },
                tags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
              },
              required: ["taskId"],
            },
          },
          { name: "list_rooms", description: "Daftar ruangan" },
        ],
      },
    ];

    const [move, list] = toOllamaTools(tools);
    expect(move).toEqual({
      type: "function",
      function: {
        name: "move_task",
        description: "Pindah task",
        parameters: {
          type: "object",
          required: ["taskId"],
          properties: {
            taskId: { type: "string", description: "ID" },
            status: { type: "string", enum: ["TODO", "DONE"] },
            tags: { type: "array", items: { type: "string" } },
          },
        },
      },
    });
    expect(list!.function.parameters).toEqual({ type: "object", properties: {} });
  });

  it("converts every real agent tool with unique names", () => {
    const tools = toOllamaTools([
      {
        functionDeclarations: [
          ...RESEARCH_AGENT_TOOL_DECLARATIONS,
          ...COMPANY_AGENT_TOOL_DECLARATIONS,
        ],
      },
    ]);
    expect(tools.length).toBeGreaterThan(5);
    expect(new Set(tools.map((t) => t.function.name)).size).toBe(tools.length);
    for (const t of tools) expect(t.function.parameters.type).toBe("object");
  });
});

describe("parseToolArguments", () => {
  it("accepts objects and JSON strings, rejects junk", () => {
    expect(parseToolArguments({ a: 1 })).toEqual({ a: 1 });
    expect(parseToolArguments('{"b":2}')).toEqual({ b: 2 });
    expect(parseToolArguments("not json")).toEqual({});
    expect(parseToolArguments(["x"])).toEqual({});
  });
});

describe("ollama adapter helpers", () => {
  it("attaches images as base64 with labels", () => {
    expect(
      buildOllamaUserMessage("Analisis", [
        { mimeType: "image/png", data: "AAA", label: "a1: Hero" },
        { mimeType: "image/jpeg", data: "BBB" },
      ]),
    ).toEqual({
      role: "user",
      content: "Analisis\n\nGambar 1: a1: Hero",
      images: ["AAA", "BBB"],
    });
    expect(buildOllamaUserMessage("Halo")).toEqual({ role: "user", content: "Halo" });
  });

  it("maps think levels to boolean for Kimi", () => {
    expect(ollamaThinkForModel("kimi-k3.1-pro:cloud", "high")).toBe(true);
    expect(ollamaThinkForModel("kimi-k3.1-pro:cloud", false)).toBe(false);
    expect(ollamaThinkForModel("deepseek-v4-pro:cloud", "high")).toBe("high");
  });
});
