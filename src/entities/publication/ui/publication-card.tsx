"use client";

import Link from "next/link";
import { useState } from "react";
import { AnalyticsLink } from "@/features/analytics/ui/analytics-link";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent } from "@/shared/ui/card";
import { formatDate, formatDateTime } from "@/shared/lib/date";
import { FavoriteToggle } from "@/features/save-favorite/ui/favorite-toggle";
import { OrganizationImage } from "@/entities/organization/ui/organization-image";
import type { Publication } from "@/entities/publication/model/types";
import { PublicationMediaCarouselLoader } from "@/entities/publication/ui/publication-media-carousel-loader";
import { publicationTypeLabels } from "@/entities/publication/model/types";

function getStatusLabel(publication: Publication) {
  if (publication.status === "cancelled") {
    return "Отменено";
  }

  if (publication.type === "regular") {
    return "Регулярно";
  }

  if (publication.type === "news" && publication.publishedAt) {
    return formatDate(publication.publishedAt);
  }

  if (publication.startsAt) {
    return formatDateTime(publication.startsAt);
  }

  if (publication.validUntil) {
    return `до ${formatDate(publication.validUntil)}`;
  }

  return "Актуально";
}

function getCardDateLabel(publication: Publication) {
  if (publication.type === "regular" && publication.schedule) {
    return publication.schedule;
  }

  if (publication.type === "news" && publication.publishedAt) {
    return `Опубликовано ${formatDate(publication.publishedAt)}`;
  }

  if (publication.startsAt) {
    return formatDateTime(publication.startsAt);
  }

  if (publication.validUntil) {
    return `Актуально до ${formatDate(publication.validUntil)}`;
  }

  return undefined;
}

export function PublicationCard({ publication }: { publication: Publication }) {
  const statusVariant = publication.status === "cancelled"
    ? "error"
    : publication.type === "regular"
      ? "accent"
      : "default";
  const statusLabel = getStatusLabel(publication);
  const typeLabel = publicationTypeLabels[publication.type];
  const showTypeBadge = statusLabel.toLocaleLowerCase("ru-RU") !== typeLabel.toLocaleLowerCase("ru-RU");
  const showPlace = (publication.type === "event" || publication.type === "regular") && publication.place;
  const showPrice = ["event", "promo", "regular"].includes(publication.type)
    && Boolean(publication.isFree || publication.priceText);
  const [hasVisual, setHasVisual] = useState(Boolean(publication.image || publication.media?.length));
  const dateLabel = getCardDateLabel(publication);
  const textColor = hasVisual ? "text-white" : "text-foreground";
  const mutedTextColor = hasVisual ? "text-white/80" : "text-foreground-muted";
  const iconColor = hasVisual ? "text-white/70" : "text-foreground-muted";
  const organizationBorderColor = hasVisual ? "border-white/25" : "border-border";
  const mediaCarousel = (
    <PublicationMediaCarouselLoader
      publicationId={publication.id}
      initialMedia={publication.media?.length
        ? publication.media
        : publication.image
          ? [{ id: `legacy-${publication.id}`, kind: "photo", posterUrl: publication.image }]
          : []}
      publicationTitle={publication.title}
      publicationHref={`/publications/${publication.slug}`}
      onMediaChange={setHasVisual}
    />
  );

  return (
    <Card
      className={publication.status === "cancelled"
        ? "group relative overflow-hidden rounded-xl border-error transition-shadow hover:shadow-popover"
        : "group relative overflow-hidden rounded-xl transition-shadow hover:shadow-popover"}
    >
      {mediaCarousel}
      {hasVisual ? (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant={statusVariant}>{statusLabel}</Badge>
              {showTypeBadge ? <Badge variant="muted" className="border-white/20 bg-black/40 text-white">{typeLabel}</Badge> : null}
            </div>
            <FavoriteToggle
              id={publication.id}
              type="publication"
              label={publication.title}
              className="pointer-events-auto shrink-0 bg-black/40 text-white hover:bg-black/60"
              analytics={{
                organizationId: publication.organization.id,
                publicationId: publication.id
              }}
            />
          </div>
          <CardContent className="pointer-events-none absolute inset-x-0 bottom-0 z-10 space-y-2 bg-gradient-to-t from-black via-black/80 to-transparent pt-16 text-white">
            <PublicationCardBody
              publication={publication}
              dateLabel={dateLabel}
              showPlace={Boolean(showPlace)}
              showPrice={showPrice}
              textColor={textColor}
              mutedTextColor={mutedTextColor}
              iconColor={iconColor}
              organizationBorderColor={organizationBorderColor}
            />
          </CardContent>
        </>
      ) : (
        <>
          <CardContent className="flex h-96 flex-col">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant={statusVariant}>{statusLabel}</Badge>
                {showTypeBadge ? <Badge variant="muted">{typeLabel}</Badge> : null}
              </div>
              <FavoriteToggle
                id={publication.id}
                type="publication"
                label={publication.title}
                analytics={{
                  organizationId: publication.organization.id,
                  publicationId: publication.id
                }}
              />
            </div>
            <PublicationCardBody
              publication={publication}
              dateLabel={dateLabel}
              showPlace={Boolean(showPlace)}
              showPrice={showPrice}
              textColor={textColor}
              mutedTextColor={mutedTextColor}
              iconColor={iconColor}
              organizationBorderColor={organizationBorderColor}
              fillHeight
            />
          </CardContent>
        </>
      )}
    </Card>
  );
}

type PublicationCardBodyProps = {
  publication: Publication;
  dateLabel?: string;
  showPlace: boolean;
  showPrice: boolean;
  textColor: string;
  mutedTextColor: string;
  iconColor: string;
  organizationBorderColor: string;
  fillHeight?: boolean;
};

function PublicationCardBody({
  publication,
  dateLabel,
  showPlace,
  showPrice,
  textColor,
  mutedTextColor,
  iconColor,
  organizationBorderColor,
  fillHeight = false
}: PublicationCardBodyProps) {
  return (
    <div className={fillHeight ? "flex flex-1 flex-col" : "space-y-2"}>
      <div className="space-y-2">
        <div className="space-y-1.5">
          <Link href={`/publications/${publication.slug}`} className="pointer-events-auto block">
            <h3 className={`line-clamp-3 text-xl font-semibold leading-7 ${textColor}`}>{publication.title}</h3>
          </Link>
          <p className={`line-clamp-2 text-sm leading-6 ${mutedTextColor}`}>{publication.description}</p>
          {publication.status === "cancelled" ? (
            <p className="text-sm font-medium text-error">⚠ Материал отменён организацией</p>
          ) : null}
        </div>
        <dl className={`grid gap-1.5 text-sm leading-5 ${mutedTextColor}`}>
          {dateLabel ? <PublicationMetadataRow icon="◷" label="Когда" value={dateLabel} iconColor={iconColor} /> : null}
          {showPlace ? (
            <PublicationMetadataRow icon="⌖" label="Где" value={publication.place} iconColor={iconColor} />
          ) : null}
          {showPrice ? (
            <PublicationMetadataRow
              icon="₽"
              label="Цена"
              value={publication.isFree ? "Бесплатно" : publication.priceText}
              iconColor={iconColor}
            />
          ) : null}
        </dl>
      </div>
      <AnalyticsLink
        href={`/organizations/${publication.organization.slug}`}
        aria-label={`Открыть организацию: ${publication.organization.name}`}
        className="pointer-events-auto block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-2"
        style={fillHeight ? { marginTop: "auto" } : undefined}
        analytics={{
          eventName: "organization_click",
          organizationId: publication.organization.id,
          publicationId: publication.id
        }}
      >
        <div className={`flex items-center gap-3 border-t pt-3 ${organizationBorderColor}`}>
          <OrganizationImage
            organization={publication.organization}
            shape="circle"
            className="size-9 shrink-0"
          />
          <span className={`min-w-0 flex-1 truncate text-sm font-medium ${textColor}`}>
            {publication.organization.name}
          </span>
          <span aria-hidden="true" className={`text-xl leading-none ${iconColor}`}>›</span>
        </div>
      </AnalyticsLink>
    </div>
  );
}

function PublicationMetadataRow({
  icon,
  label,
  value,
  iconColor
}: {
  icon: string;
  label: string;
  value: string;
  iconColor: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span aria-hidden="true" className={`mt-0.5 w-4 shrink-0 text-center leading-4 ${iconColor}`}>{icon}</span>
      <dt className="sr-only">{label}</dt>
      <dd className="min-w-0">{value}</dd>
    </div>
  );
}
