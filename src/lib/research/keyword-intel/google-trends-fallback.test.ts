import { describe, expect, it } from "vitest";
import {
  inferTrendFromAutocompleteMeta,
  mergeKeywordTrend,
} from "@/lib/research/keyword-intel/keyword-trend";
import {
  isBlockedTrendsError,
  isHtmlTrendsResponse,
} from "@/lib/research/google-trends-client";

describe("google-trends-client block detection", () => {
  it("detects HTML CAPTCHA responses", () => {
    expect(
      isHtmlTrendsResponse(
        "<HTML><HEAD><TITLE>302 Moved</TITLE></HEAD><BODY>google.com/sorry</BODY></HTML>",
      ),
    ).toBe(true);
  });

  it("detects library JSON parse errors from HTML body", () => {
    const err = new SyntaxError("Unexpected token 'L', \"L><HEAD><m\"... is not valid JSON");
    Object.assign(err, {
      requestBody: "<HTML><HEAD><TITLE>302 Moved</TITLE></HEAD></HTML>",
    });
    expect(isBlockedTrendsError(err)).toBe(true);
  });
});

describe("inferTrendFromAutocompleteMeta", () => {
  it("maps top ranks to up", () => {
    expect(inferTrendFromAutocompleteMeta({ rank: 2 })).toBe("up");
  });

  it("maps low ranks to down", () => {
    expect(inferTrendFromAutocompleteMeta({ rank: 18 })).toBe("down");
  });
});

describe("mergeKeywordTrend", () => {
  it("prefers up over stable", () => {
    expect(mergeKeywordTrend("stable", "up")).toBe("up");
  });
});
