import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Organization } from "@/entities/organization/model/types";
import { OrganizationCard } from "@/entities/organization/ui/organization-card";

const organization: Organization = {
  id: "00000000-0000-4000-8000-000000000001",
  slug: "gorodskaya-biblioteka",
  name: "Городская библиотека",
  type: "culture",
  description: "Культурный центр города",
  address: "Судак, улица Ленина, 10",
  phone: "+7 978 000-00-00",
  workingHours: "Сегодня: 10:00–19:00",
  contactLinks: [],
  services: [],
  activePublicationIds: ["00000000-0000-4000-8000-000000000002"],
  updatedAt: "2026-08-08T12:00:00+03:00"
};

describe("OrganizationCard image fallback", () => {
  it("uses the first letter when neither logo nor cover is available", () => {
    const markup = renderToStaticMarkup(<OrganizationCard organization={organization} />);

    expect(markup).toContain(">Г<");
    expect(markup).not.toContain("<img");
    expect(markup).toContain("1 активная публикация");
  });
});
