import { describe, expect, it } from "vitest";
import {
  isUrlExcludedByDomain,
  normalizeExcludedDomain
} from "@/features/content-ingestion/model/domain-exclusion";

describe("content ingestion domain exclusions", () => {
  it("normalizes a domain or URL to a stable hostname", () => {
    expect(normalizeExcludedDomain(" WWW.Example.org. ")).toBe("example.org");
    expect(normalizeExcludedDomain("https://events.example.org/path?q=1")).toBe("events.example.org");
  });

  it("rejects malformed or non-public domain input", () => {
    expect(() => normalizeExcludedDomain("localhost")).toThrow();
    expect(() => normalizeExcludedDomain("http://example.org")).toThrow();
    expect(() => normalizeExcludedDomain("https://bad_label.example.org")).toThrow();
  });

  it("matches the excluded domain and all of its subdomains", () => {
    const excluded = ["example.org"];
    expect(isUrlExcludedByDomain("https://example.org/event", excluded)).toBe(true);
    expect(isUrlExcludedByDomain("https://news.example.org/event", excluded)).toBe(true);
    expect(isUrlExcludedByDomain("https://notexample.org/event", excluded)).toBe(false);
  });

  it("keeps a narrower subdomain exclusion narrow", () => {
    const excluded = ["events.example.org"];
    expect(isUrlExcludedByDomain("https://events.example.org", excluded)).toBe(true);
    expect(isUrlExcludedByDomain("https://example.org", excluded)).toBe(false);
  });
});
