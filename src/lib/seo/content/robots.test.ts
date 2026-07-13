import { describe, expect, it } from "vitest";
import { isPathAllowed, parseDisallowRules } from "@/lib/seo/content/robots";

const ROBOTS = `# contoh
User-agent: Googlebot
Disallow: /google-only

User-agent: *
Disallow: /admin
Disallow: /private/*.html
Allow: /admin/public

User-agent: BadBot
Disallow: /
`;

describe("parseDisallowRules", () => {
  it("only collects rules from the * group", () => {
    expect(parseDisallowRules(ROBOTS)).toEqual(["/admin", "/private/*.html"]);
  });

  it("supports multiple user-agent lines in one group", () => {
    const txt = `User-agent: Foo\nUser-agent: *\nDisallow: /x`;
    expect(parseDisallowRules(txt)).toEqual(["/x"]);
  });

  it("returns empty for empty or comment-only files", () => {
    expect(parseDisallowRules("")).toEqual([]);
    expect(parseDisallowRules("# nothing here")).toEqual([]);
  });
});

describe("isPathAllowed", () => {
  it("blocks disallowed prefixes", () => {
    expect(isPathAllowed(ROBOTS, "/admin/settings")).toBe(false);
    expect(isPathAllowed(ROBOTS, "/private/rahasia.html")).toBe(false);
  });

  it("allows unrelated paths", () => {
    expect(isPathAllowed(ROBOTS, "/artikel/serum")).toBe(true);
    expect(isPathAllowed(ROBOTS, "/")).toBe(true);
  });

  it("does not apply other agents' rules", () => {
    expect(isPathAllowed(ROBOTS, "/google-only")).toBe(true);
  });

  it("blocks everything on Disallow: /", () => {
    const txt = `User-agent: *\nDisallow: /`;
    expect(isPathAllowed(txt, "/apapun")).toBe(false);
  });
});
