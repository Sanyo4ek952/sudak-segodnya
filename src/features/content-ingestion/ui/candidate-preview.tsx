import type { ContentCandidatePayload } from "@/features/content-ingestion/model/contracts";
import type { Organization, OrganizationType } from "@/entities/organization/model/types";
import { isOrganizationType } from "@/entities/organization/model/types";
import type { Publication } from "@/entities/publication/model/types";
import { OrganizationCard } from "@/entities/organization/ui/organization-card";
import { PublicationCard } from "@/entities/publication/ui/publication-card";

export function CandidatePreview({ candidateId, payload }: { candidateId: string; payload: ContentCandidatePayload }) {
  if (payload.kind === "organization") {
    const organization: Organization = {
      id: candidateId,
      slug: "preview",
      name: payload.name,
      type: (isOrganizationType(payload.typeSlug) ? payload.typeSlug : "services") as OrganizationType,
      description: payload.description ?? "Описание будет добавлено перед публикацией.",
      address: payload.address ?? "Адрес не указан",
      phone: payload.phone ?? "",
      workingHours: payload.workingHours ?? "График не указан",
      contactLinks: payload.contactLinks,
      services: [],
      activePublicationIds: [],
      updatedAt: new Date().toISOString()
    };
    return <div className="pointer-events-none"><OrganizationCard organization={organization} /></div>;
  }

  const publication: Publication = {
    id: candidateId,
    slug: "preview",
    type: payload.type,
    status: "published",
    title: payload.title,
    description: payload.description ?? "Описание будет добавлено перед публикацией.",
    organization: {
      id: payload.organizationId ?? candidateId,
      slug: "preview",
      name: payload.organizationName
    },
    startsAt: payload.startsAt ?? undefined,
    endsAt: payload.endsAt ?? undefined,
    validUntil: payload.validUntil ?? undefined,
    scheduleEntries: payload.scheduleEntries.map((entry) => ({
      text: entry.scheduleText,
      weekday: entry.weekday ?? undefined,
      startsAt: entry.startsAt ?? undefined,
      endsAt: entry.endsAt ?? undefined,
      timezone: entry.timezone
    })),
    place: payload.place ?? "",
    priceText: payload.priceText ?? "",
    isFree: payload.isFree,
    category: payload.categorySlug,
    contactPhone: payload.contactPhone ?? undefined,
    ageLimit: payload.ageLimit ?? undefined,
    updatedAt: new Date().toISOString()
  };
  return <div className="pointer-events-none"><PublicationCard publication={publication} /></div>;
}
