import { describe, expect, it } from "vitest";
import type { PublicationCandidatePayload } from "@/features/content-ingestion/model/contracts";
import {
  applyOrganizationDefaults,
  createOrganizationIdentityKey,
  resolveImportOrganization
} from "@/features/content-ingestion/model/organization-resolution";

const organizations = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Дом культуры Судака",
    address: "ул. Ленина, 1",
    phone: "+7 978 000-00-00"
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Городская библиотека",
    address: "ул. Гагарина, 2",
    phone: "+7 978 111-11-11"
  }
];

const payload: PublicationCandidatePayload = {
  kind: "publication",
  organizationId: null,
  organizationName: "Дом культуры Судака",
  targetPublicationId: null,
  type: "event",
  title: "Городской концерт",
  description: "Описание городского концерта",
  categorySlug: "culture",
  startsAt: "2026-09-01T18:00:00+03:00",
  endsAt: "2026-09-01T20:00:00+03:00",
  validUntil: null,
  place: null,
  priceText: null,
  isFree: true,
  ageLimit: null,
  contactPhone: null,
  scheduleEntries: [],
  imageSourceUrl: null
};

describe("import organization resolution", () => {
  it("creates one stable identity key for equivalent organization names", () => {
    expect(createOrganizationIdentityKey("  АРТ-КЛАСТЕР «ТАВРИДА»  "))
      .toBe(createOrganizationIdentityKey("Арт кластер Таврида"));
  });

  it("prefers an explicit source binding over a name from imported content", () => {
    const result = resolveImportOrganization({
      payload,
      sourceOrganizationId: organizations[1].id,
      organizations
    });

    expect(result.reason).toBe("source_binding");
    expect(result.organization?.id).toBe(organizations[1].id);
  });

  it("automatically resolves one exact normalized organization name", () => {
    const result = resolveImportOrganization({
      payload: { ...payload, organizationName: "  ДОМ КУЛЬТУРЫ «СУДАКА»  " },
      sourceOrganizationId: null,
      organizations
    });

    expect(result.reason).toBe("exact_name");
    expect(result.organization?.id).toBe(organizations[0].id);
  });

  it("does not silently accept a fuzzy name as an exact match", () => {
    const result = resolveImportOrganization({
      payload: { ...payload, organizationName: "Дом культуры" },
      sourceOrganizationId: null,
      organizations
    });

    expect(result.organization).toBeNull();
    expect(result.suggestions).toEqual([organizations[0]]);
  });

  it("fills only missing event contact data from the resolved organization", () => {
    const result = applyOrganizationDefaults(payload, organizations[0]);

    expect(result.organizationId).toBe(organizations[0].id);
    expect(result.organizationName).toBe(organizations[0].name);
    expect(result.place).toBe(organizations[0].address);
    expect(result.contactPhone).toBe(organizations[0].phone);

    const preserved = applyOrganizationDefaults({
      ...payload,
      place: "Набережная",
      contactPhone: "+7 978 999-99-99"
    }, organizations[0]);
    expect(preserved.place).toBe("Набережная");
    expect(preserved.contactPhone).toBe("+7 978 999-99-99");
  });

  it("does not add place or phone to an organization news item", () => {
    const result = applyOrganizationDefaults({
      ...payload,
      type: "news",
      startsAt: null,
      endsAt: null,
      validUntil: "2026-09-02T23:59:00+03:00"
    }, organizations[0]);

    expect(result.place).toBeNull();
    expect(result.contactPhone).toBeNull();
  });
});
