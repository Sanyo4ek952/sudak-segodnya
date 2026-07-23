import type { Metadata } from "next";

export const siteName = "Судак Сегодня";

const localSiteUrl = "http://localhost:3000";
const productionSiteUrl = "https://sudak-today.vercel.app";

type PageMetadataInput = {
  title: string;
  description: string;
  path: string;
  image?: string;
};

export type PublicOrganizationSeo = {
  slug: string;
  name: string;
  description: string | null;
  image?: string;
};

export type PublicPublicationSeo = {
  slug: string;
  type: string;
  title: string;
  description: string | null;
  startsAt: string | null;
  endsAt: string | null;
  place: string | null;
  image?: string;
  organization: {
    slug: string;
    name: string;
  };
};

export type JsonLd = Record<string, unknown>;

function getConfiguredSiteUrl() {
  const value = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return new URL(`${url.origin}/`);
  } catch {
    return null;
  }
}

export function getSiteUrl() {
  return (
    getConfiguredSiteUrl() ??
    new URL(process.env.NODE_ENV === "production" ? productionSiteUrl : localSiteUrl)
  );
}

export function getPublicUrl(path: string) {
  return new URL(path, getSiteUrl()).toString();
}

function normalizeText(value: string | null | undefined) {
  const normalized = value?.replace(/\s+/g, " ").trim();

  return normalized || undefined;
}

export function getStableOpenGraphImage(value: string | null | undefined) {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);
    const hasTemporarySignature = Array.from(url.searchParams.keys()).some((key) => {
      const normalizedKey = key.toLowerCase();

      return (
        normalizedKey === "token" ||
        normalizedKey.includes("signature") ||
        normalizedKey.includes("credential") ||
        normalizedKey.includes("expires")
      );
    });

    if (
      url.protocol !== "https:" ||
      url.pathname.includes("/storage/v1/object/sign/") ||
      hasTemporarySignature
    ) {
      return undefined;
    }

    return url.toString();
  } catch {
    return undefined;
  }
}

export function createPageMetadata({ title, description, path, image }: PageMetadataInput): Metadata {
  const url = getPublicUrl(path);
  const stableImage = getStableOpenGraphImage(image);

  return {
    title,
    description,
    alternates: {
      canonical: url
    },
    openGraph: {
      type: "website",
      locale: "ru_RU",
      siteName,
      title,
      description,
      url,
      ...(stableImage ? { images: [{ url: stableImage }] } : {})
    }
  };
}

export function createOrganizationMetadata(organization: PublicOrganizationSeo) {
  const description =
    normalizeText(organization.description) ?? "Публичная страница организации на Судак Сегодня.";

  return createPageMetadata({
    title: `${organization.name} | ${siteName}`,
    description,
    path: `/organizations/${encodeURIComponent(organization.slug)}`,
    image: organization.image
  });
}

export function createPublicationMetadata(publication: PublicPublicationSeo) {
  const description =
    normalizeText(publication.description) ?? "Публичная публикация на Судак Сегодня.";

  return createPageMetadata({
    title: `${publication.title} | ${siteName}`,
    description,
    path: `/publications/${encodeURIComponent(publication.slug)}`,
    image: publication.image
  });
}

function isValidEventDateRange(startsAt: string | null, endsAt: string | null) {
  if (!startsAt || !endsAt) {
    return false;
  }

  const start = new Date(startsAt);
  const end = new Date(endsAt);

  return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end.getTime() > start.getTime();
}

export function createOrganizationJsonLd(organization: PublicOrganizationSeo): JsonLd {
  const description = normalizeText(organization.description);

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: organization.name,
    ...(description ? { description } : {}),
    url: getPublicUrl(`/organizations/${encodeURIComponent(organization.slug)}`)
  };
}

export function createEventJsonLd(publication: PublicPublicationSeo): JsonLd | undefined {
  if (
    publication.type !== "event" ||
    !isValidEventDateRange(publication.startsAt, publication.endsAt)
  ) {
    return undefined;
  }

  const description = normalizeText(publication.description);
  const place = normalizeText(publication.place);

  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: publication.title,
    ...(description ? { description } : {}),
    startDate: publication.startsAt,
    endDate: publication.endsAt,
    ...(place
      ? {
          location: {
            "@type": "Place",
            name: place
          }
        }
      : {}),
    organizer: {
      "@type": "Organization",
      name: publication.organization.name,
      url: getPublicUrl(`/organizations/${encodeURIComponent(publication.organization.slug)}`)
    },
    url: getPublicUrl(`/publications/${encodeURIComponent(publication.slug)}`)
  };
}

export function serializeJsonLd(value: JsonLd) {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (character) => {
    const escaped = {
      "<": "\\u003c",
      ">": "\\u003e",
      "&": "\\u0026",
      "\u2028": "\\u2028",
      "\u2029": "\\u2029"
    };

    return escaped[character as keyof typeof escaped];
  });
}
