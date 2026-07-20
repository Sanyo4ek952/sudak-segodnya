import Image from "next/image";
import Link from "next/link";
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

  return publicationTypeLabels[publication.type];
}

export function PublicationCard({ publication }: { publication: Publication }) {
  const statusVariant = publication.status === "cancelled" ? "error" : publication.isFree ? "success" : "info";

  return (
    <Card className="overflow-hidden">
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
            <Badge variant={statusVariant}>{getStatusLabel(publication)}</Badge>
            <Badge variant="muted">{publicationTypeLabels[publication.type]}</Badge>
          </div>
          <FavoriteToggle id={publication.id} type="publication" label={publication.title} />
        </div>
        <div className="space-y-2">
          <Link href={`/publications/${publication.slug}`} className="block">
            <h3 className="text-lg font-semibold leading-snug">{publication.title}</h3>
          </Link>
          <p className="line-clamp-2 text-sm leading-6 text-foreground-muted">{publication.description}</p>
        </div>
        <dl className="grid gap-2 text-sm text-foreground-muted">
          <div className="flex gap-2">
            <dt className="shrink-0 font-medium text-foreground">Где:</dt>
            <dd>{publication.place}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 font-medium text-foreground">Цена:</dt>
            <dd>{publication.priceText}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 font-medium text-foreground">Кто:</dt>
            <dd>
              <Link href={`/organizations/${publication.organization.slug}`} className="text-primary">
                {publication.organization.name}
              </Link>
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
