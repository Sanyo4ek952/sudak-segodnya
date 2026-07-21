import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/shared/ui/badge";
import { Button, LinkButton } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { SectionHeader } from "@/shared/ui/section-header";
import { InaccuracyReportDialog } from "@/features/report-inaccuracy/ui/inaccuracy-report-dialog";
import { FavoriteToggle } from "@/features/save-favorite/ui/favorite-toggle";
import { getPublicPublicationBySlug } from "@/entities/publication/api/publications";
import { publicationTypeLabels } from "@/entities/publication/model/types";
import { formatDate, formatDateTime } from "@/shared/lib/date";

type PublicationPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function PublicationPage({ params }: PublicationPageProps) {
  const { slug } = await params;
  const { publication } = await getPublicPublicationBySlug(slug);

  if (!publication) {
    notFound();
  }

  const dateLabel = publication.startsAt
    ? formatDateTime(publication.startsAt)
    : publication.validUntil
      ? `Актуально до ${formatDate(publication.validUntil)}`
      : publication.schedule ?? "Актуально";
  const contactPhoneHref = publication.contactPhone
    ? `tel:${publication.contactPhone.replace(/\D/g, "")}`
    : null;

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <Link href="/" className="inline-flex min-h-10 items-center text-sm font-medium text-primary">
        Назад в ленту
      </Link>

      {publication.image ? (
        <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-surface-muted">
          <Image
            src={publication.image}
            alt=""
            fill
            className="object-cover"
            sizes="(min-width: 768px) 768px, 100vw"
            priority
          />
        </div>
      ) : null}

      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={publication.status === "cancelled" ? "error" : "info"}>
            {publication.status === "cancelled" ? "Отменено" : publicationTypeLabels[publication.type]}
          </Badge>
          {publication.isFree ? <Badge variant="success">Бесплатно</Badge> : null}
          {publication.ageLimit ? <Badge variant="muted">{publication.ageLimit}</Badge> : null}
        </div>
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">{publication.title}</h1>
          <p className="text-base leading-7 text-foreground-muted">{publication.description}</p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <Link href={`/organizations/${publication.organization.slug}`} className="text-sm font-medium text-primary">
            {publication.organization.name}
          </Link>
          <FavoriteToggle id={publication.id} type="publication" label={publication.title} />
        </div>
      </header>

      <Card>
        <CardContent>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium text-foreground-muted">Когда</dt>
              <dd className="mt-1 text-base font-semibold">{publication.schedule ?? dateLabel}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground-muted">Где</dt>
              <dd className="mt-1 text-base font-semibold">{publication.place}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground-muted">Цена</dt>
              <dd className="mt-1 text-base font-semibold">{publication.priceText}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground-muted">Обновлено</dt>
              <dd className="mt-1 text-base font-semibold">{formatDate(publication.updatedAt)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <SectionHeader title="Действия" />
        <div className="grid gap-3 sm:grid-cols-3">
          {contactPhoneHref ? <LinkButton href={contactPhoneHref}>Позвонить</LinkButton> : null}
          <LinkButton
            href={`https://yandex.ru/maps/?text=${encodeURIComponent(publication.place)}`}
            variant="outline"
            target="_blank"
            rel="noreferrer"
          >
            Маршрут
          </LinkButton>
          <Button type="button" variant="outline">
            Поделиться
          </Button>
        </div>
        <details className="rounded-lg border border-border bg-surface p-4">
          <summary className="cursor-pointer text-sm font-medium">Дополнительно</summary>
          <div className="mt-3 border-t border-border pt-3">
            <InaccuracyReportDialog publicationId={publication.id} />
          </div>
        </details>
      </section>
    </article>
  );
}
