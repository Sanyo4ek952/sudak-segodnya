import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent } from "@/shared/ui/card";
import { SectionHeader } from "@/shared/ui/section-header";
import { AnalyticsActionListener } from "@/features/analytics/ui/analytics-action-listener";
import { AnalyticsPageView } from "@/features/analytics/ui/analytics-page-view";
import { PublicationActions } from "@/features/publication-actions/ui/publication-actions";
import { InaccuracyReportDialog } from "@/features/report-inaccuracy/ui/inaccuracy-report-dialog";
import { FavoriteToggle } from "@/features/save-favorite/ui/favorite-toggle";
import {
  getPublicPublicationBySlug,
  getPublicPublicationSeoBySlug
} from "@/entities/publication/api/publications";
import { publicationTypeLabels } from "@/entities/publication/model/types";
import { formatDate, formatDateTime } from "@/shared/lib/date";
import { createEventJsonLd, createPublicationMetadata } from "@/shared/lib/seo";
import { JsonLd } from "@/shared/ui/json-ld";

type PublicationPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamic = "force-dynamic";

function decodeSlug(slug: string) {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

export async function generateMetadata({ params }: PublicationPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { publication } = await getPublicPublicationSeoBySlug(decodeSlug(slug));

  if (!publication) {
    notFound();
  }

  return createPublicationMetadata(publication);
}

export default async function PublicationPage({ params }: PublicationPageProps) {
  const { slug } = await params;
  const decodedSlug = decodeSlug(slug);
  const [{ publication }, { publication: seoPublication }] = await Promise.all([
    getPublicPublicationBySlug(decodedSlug),
    getPublicPublicationSeoBySlug(decodedSlug)
  ]);

  if (!publication || !seoPublication) {
    notFound();
  }

  const eventJsonLd = createEventJsonLd(seoPublication);
  const dateLabel = publication.startsAt
    ? `${formatDateTime(publication.startsAt)}${publication.endsAt ? ` — ${formatDateTime(publication.endsAt)}` : ""}`
    : publication.validUntil
      ? `Актуально до ${formatDate(publication.validUntil)}`
      : publication.schedule ?? "Актуально";

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      {eventJsonLd ? <JsonLd data={eventJsonLd} /> : null}
      <AnalyticsPageView
        analytics={{
          eventName: "publication_view",
          organizationId: publication.organization.id,
          publicationId: publication.id
        }}
      />
      <AnalyticsActionListener
        context={{
          organizationId: publication.organization.id,
          publicationId: publication.id
        }}
      />
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
        {publication.status === "cancelled" ? (
          <div className="rounded-md border border-error bg-error/10 p-4" role="status">
            <p className="font-semibold text-error">⚠ Публикация отменена</p>
            <p className="mt-1 text-sm leading-6 text-foreground">
              Организация отменила событие или предложение. Информация сохранена до конца полезного периода.
            </p>
          </div>
        ) : null}
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">{publication.title}</h1>
          <p className="text-base leading-7 text-foreground-muted">{publication.description}</p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <Link href={`/organizations/${publication.organization.slug}`} className="text-sm font-medium text-primary">
            {publication.organization.name}
          </Link>
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
      </header>

      <Card>
        <CardContent>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium text-foreground-muted">Когда</dt>
              <dd className="mt-1 text-base font-semibold">{publication.schedule ?? dateLabel}</dd>
            </div>
            {(publication.type === "event" || publication.type === "regular") && publication.place ? (
              <div>
                <dt className="font-medium text-foreground-muted">Где</dt>
                <dd className="mt-1 text-base font-semibold">{publication.place}</dd>
              </div>
            ) : null}
            {publication.type !== "news" && publication.priceText ? (
              <div>
                <dt className="font-medium text-foreground-muted">Цена</dt>
                <dd className="mt-1 text-base font-semibold">{publication.priceText}</dd>
              </div>
            ) : null}
            <div>
              <dt className="font-medium text-foreground-muted">Обновлено</dt>
              <dd className="mt-1 text-base font-semibold">{formatDate(publication.updatedAt)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <SectionHeader title="Действия" />
        <PublicationActions publication={publication} />
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
