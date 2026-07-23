import { describe, expect, it } from "vitest";
import { getFeedFilterClassName } from "@/widgets/public-feed/ui/feed-filters";

describe("feed filter chip contrast", () => {
  it("uses a mutually exclusive high-contrast active class set", () => {
    const className = getFeedFilterClassName(true);

    expect(className).toContain("bg-primary");
    expect(className).toContain("text-primary-foreground");
    expect(className).not.toContain("bg-surface ");
    expect(className).not.toContain("text-foreground-muted");
  });

  it("keeps an accessible touch target and focus outline", () => {
    const className = getFeedFilterClassName(false);

    expect(className).toContain("min-h-11");
    expect(className).toContain("focus-visible:outline-primary");
  });
});

