import Image from "next/image";
import Link from "next/link";
import { AnalyticsLink } from "@/features/analytics/ui/analytics-link";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent } from "@/shared/ui/card";
import { formatDate, formatDateTime } from "@/shared/lib/date";
import { FavoriteToggle } from "@/features/save-favorite/ui/favorite-toggle";
import type { Publication } from "@/entities/publication/model/types";
import { publicationTypeLabels } from "@/entities/publication/model/types";

function getStatusLabel(publication: Publication) {
  if (publication.status === "cancelled") {
    return "Отменено";
  }

  if (publication.type === "regular") {
    return "Регулярно";
  }

  if (publication.startsAt) {
    return formatDateTime(publication.startsAt);
  }

  if (publication.validUntil) {
    return `до ${formatDate(publication.validUntil)}`;
  }

  return "Актуально";
}

export function PublicationCard({ publication }: { publication: Publication }) {
  const statusVariant = publication.status === "cancelled" ? "error" : publication.isFree ? "success" : "info";
  const statusLabel = getStatusLabel(publication);
  const typeLabel = publicationTypeLabels[publication.type];
  const showTypeBadge = statusLabel.toLocaleLowerCase("ru-RU") !== typeLabel.toLocaleLowerCase("ru-RU");
  const showPlace = (publication.type === "event" || publication.type === "regular") && publication.place;
  const showPrice = publication.type !== "news" && publication.priceText;

  return (
    <Card className={publication.status === "cancelled" ? "overflow-hidden border-error" : "overflow-hidden"}>
      <Link href={`/publications/${publication.slug}`} className="block">
        {publication.image ? (
          <div className="relative aspect-[16/9] w-full bg-surface-muted">
            <Image src={publication.image} alt="" fill className="object-cover" sizes="(min-width: 768px) 360px, 100vw" />
          </div>
        ) : null}
      </Link>
      <CardContent className="space-y-3">
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
        <div className="space-y-2">
          <Link href={`/publications/${publication.slug}`} className="block">
            <h3 className="text-lg font-semibold leading-snug">{publication.title}</h3>
          </Link>
          <p className="line-clamp-2 text-sm leading-6 text-foreground-muted">{publication.description}</p>
          {publication.status === "cancelled" ? (
            <p className="text-sm font-medium text-error">
              ⚠ Материал отменён организацией
            </p>
          ) : null}
        </div>
        <dl className="grid gap-2 text-sm text-foreground-muted">
          {showPlace ? (
            <div className="flex gap-2">
              <dt className="shrink-0 font-medium text-foreground">Где:</dt>
              <dd>{publication.place}</dd>
            </div>
          ) : null}
          {showPrice ? (
            <div className="flex gap-2">
              <dt className="shrink-0 font-medium text-foreground">Цена:</dt>
              <dd>{publication.priceText}</dd>
            </div>
          ) : null}
          <div className="flex gap-2">
            <dt className="shrink-0 font-medium text-foreground">Кто:</dt>
            <dd>
              <AnalyticsLink
                href={`/organizations/${publication.organization.slug}`}
                className="text-primary"
                analytics={{
                  eventName: "organization_click",
                  organizationId: publication.organization.id,
                  publicationId: publication.id
                }}
              >
                {publication.organization.name}
              </AnalyticsLink>
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
