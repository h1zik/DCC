import type { FunctionDeclaration, Tool } from "@google/generative-ai";
import { SchemaType } from "@google/generative-ai";
import type Groq from "groq-sdk";
import { AGENT_TOOLS } from "./tools";

type ChatCompletionTool = Groq.Chat.Completions.ChatCompletionTool;

/** Loose mirror of Gemini schema for OpenAI/Groq JSON Schema conversion. */
type LooseSchema = {
  type?: SchemaType | string;
  description?: string;
  enum?: string[];
  required?: string[];
  properties?: Record<string, LooseSchema>;
  items?: LooseSchema;
};

function schemaTypeToJson(type: SchemaType | string | undefined): string {
  switch (type) {
    case SchemaType.STRING:
    case "STRING":
      return "string";
    case SchemaType.NUMBER:
    case "NUMBER":
      return "number";
    case SchemaType.INTEGER:
    case "INTEGER":
      return "integer";
    case SchemaType.BOOLEAN:
    case "BOOLEAN":
      return "boolean";
    case SchemaType.ARRAY:
    case "ARRAY":
      return "array";
    default:
      return "object";
  }
}

function convertSchema(schema: LooseSchema | undefined): Record<string, unknown> {
  if (!schema) {
    return { type: "object", properties: {} };
  }

  const out: Record<string, unknown> = {
    type: schemaTypeToJson(schema.type),
  };

  if (schema.description) out.description = schema.description;
  if (schema.enum?.length) out.enum = schema.enum;
  if (schema.required?.length) out.required = schema.required;

  if (schema.properties) {
    out.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([key, value]) => [
        key,
        convertSchema(value),
      ]),
    );
  }

  if (schema.items) {
    out.items = convertSchema(schema.items);
  }

  return out;
}

function isFunctionTool(
  tool: Tool,
): tool is Tool & { functionDeclarations: FunctionDeclaration[] } {
  return (
    "functionDeclarations" in tool &&
    Array.isArray(tool.functionDeclarations) &&
    tool.functionDeclarations.length > 0
  );
}

export function getAgentFunctionDeclarations(): FunctionDeclaration[] {
  return AGENT_TOOLS.flatMap((tool) =>
    isFunctionTool(tool) ? tool.functionDeclarations : [],
  );
}

export function toGroqTools(
  declarations: FunctionDeclaration[],
): ChatCompletionTool[] {
  return declarations
    .filter((d): d is FunctionDeclaration & { name: string } => !!d.name)
    .map((decl) => ({
      type: "function",
      function: {
        name: decl.name,
        description: decl.description ?? "",
        parameters: convertSchema(decl.parameters as LooseSchema | undefined),
      },
    }));
}

export const GROQ_AGENT_TOOLS = toGroqTools(getAgentFunctionDeclarations());
