import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Badge, type BadgeVariant } from "@/shared/ui/badge";

describe("Badge variants", () => {
  it.each<[BadgeVariant, string]>([
    ["accent", "bg-accent"],
    ["sand", "bg-sand"],
    ["coral", "bg-coral"],
    ["success", "text-success"],
    ["warning", "text-warning"],
    ["error", "text-error"],
    ["info", "text-primary-600"]
  ])("renders %s with its design token", (variant, tokenClass) => {
    const markup = renderToStaticMarkup(<Badge variant={variant}>Статус</Badge>);

    expect(markup).toContain(tokenClass);
    expect(markup).toContain("Статус");
  });
});
