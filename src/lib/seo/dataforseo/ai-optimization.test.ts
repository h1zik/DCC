import { describe, expect, it } from "vitest";
import {
  buildLlmRequest,
  collectLlmAnswer,
  selectLlmModel,
} from "@/lib/seo/dataforseo/ai-optimization";

describe("selectLlmModel", () => {
  it("uses an active preferred Gemini model instead of a stale hard-coded model", () => {
    const selected = selectLlmModel("gemini", [
      {
        model_name: "gemini-2.5-pro",
        web_search_supported: true,
      },
      {
        model_name: "gemini-2.5-flash",
        web_search_supported: true,
      },
    ]);

    expect(selected.model_name).toBe("gemini-2.5-flash");
  });

  it("prefers a cheaper web-search model when the preferred name changes", () => {
    const selected = selectLlmModel("claude", [
      { model_name: "claude-opus-new", web_search_supported: true },
      { model_name: "claude-haiku-new", web_search_supported: true },
    ]);

    expect(selected.model_name).toBe("claude-haiku-new");
  });
});

describe("buildLlmRequest", () => {
  it("builds the Claude endpoint and model payload", () => {
    const request = buildLlmRequest("claude", "rekomendasi serum", {
      model_name: "claude-3-5-haiku-latest",
      web_search_supported: true,
    });

    expect(request).toEqual({
      endpoint: "ai_optimization/claude/llm_responses/live",
      payload: {
        user_prompt: "rekomendasi serum",
        model_name: "claude-3-5-haiku-latest",
        web_search: true,
      },
    });
  });
});

describe("collectLlmAnswer", () => {
  it("collects answer text and citations from a Claude-shaped response", () => {
    const answer = collectLlmAnswer({
      message: {
        content: [{ text: "Brand A adalah salah satu rekomendasi." }],
      },
      citations: [{ url: "https://example.com/source" }],
    });

    expect(answer.text).toContain("Brand A");
    expect(answer.citations).toEqual(["https://example.com/source"]);
  });
});
