import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BrandLogo } from "@/shared/ui/brand-logo";

describe("BrandLogo", () => {
  it("renders the approved mark with a live product name", () => {
    const markup = renderToStaticMarkup(<BrandLogo />);

    expect(markup).toContain("%2Fbrand%2Flogo-mark.png");
    expect(markup).toContain("Судак Сегодня");
  });

  it("renders only the mark when requested", () => {
    const markup = renderToStaticMarkup(<BrandLogo variant="mark" size="sm" />);

    expect(markup).toContain("%2Fbrand%2Flogo-mark.png");
    expect(markup).toContain('alt="Судак Сегодня"');
    expect(markup).not.toContain("truncate font-semibold");
  });
});
