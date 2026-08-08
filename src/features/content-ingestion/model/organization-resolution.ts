import type { PublicationCandidatePayload } from "@/features/content-ingestion/model/contracts";

export type ImportOrganization = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
};

export type OrganizationResolutionReason =
  | "source_binding"
  | "candidate_binding"
  | "exact_name"
  | "unresolved";

export function normalizeOrganizationName(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]+/gi, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function resolveImportOrganization({
  payload,
  sourceOrganizationId,
  organizations
}: {
  payload: PublicationCandidatePayload;
  sourceOrganizationId: string | null;
  organizations: ImportOrganization[];
}) {
  const byId = (id: string | null) => id
    ? organizations.find((organization) => organization.id === id) ?? null
    : null;
  const sourceOrganization = byId(sourceOrganizationId);
  if (sourceOrganization) {
    return {
      organization: sourceOrganization,
      reason: "source_binding" as const,
      suggestions: [] as ImportOrganization[]
    };
  }

  const candidateOrganization = byId(payload.organizationId);
  if (candidateOrganization) {
    return {
      organization: candidateOrganization,
      reason: "candidate_binding" as const,
      suggestions: [] as ImportOrganization[]
    };
  }

  const targetName = normalizeOrganizationName(payload.organizationName);
  const exactMatches = organizations.filter(
    (organization) => normalizeOrganizationName(organization.name) === targetName
  );
  if (exactMatches.length === 1) {
    return {
      organization: exactMatches[0],
      reason: "exact_name" as const,
      suggestions: [] as ImportOrganization[]
    };
  }

  const suggestions = targetName.length < 5
    ? []
    : organizations.filter((organization) => {
        const candidateName = normalizeOrganizationName(organization.name);
        return candidateName.includes(targetName) || targetName.includes(candidateName);
      });

  return {
    organization: null,
    reason: "unresolved" as const,
    suggestions
  };
}

export function applyOrganizationDefaults(
  payload: PublicationCandidatePayload,
  organization: ImportOrganization
): PublicationCandidatePayload {
  const usesPlace = payload.type === "event" || payload.type === "regular";
  const usesContactPhone = payload.type !== "news";

  return {
    ...payload,
    organizationId: organization.id,
    organizationName: organization.name,
    place: payload.place ?? (usesPlace ? organization.address : null),
    contactPhone: payload.contactPhone ?? (usesContactPhone ? organization.phone : null)
  };
}
