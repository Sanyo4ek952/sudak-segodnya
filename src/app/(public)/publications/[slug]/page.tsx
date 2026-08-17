import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicationMediaCarouselServer } from "@/entities/publication/ui/publication-media-carousel-server";
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
  const dateLabel = publication.type === "news"
    ? publication.publishedAt
      ? formatDate(publication.publishedAt)
      : "Дата публикации не указана"
    : publication.startsAt
      ? `${formatDateTime(publication.startsAt)}${publication.endsAt ? ` — ${formatDateTime(publication.endsAt)}` : ""}`
      : publication.validUntil
        ? `Актуально до ${formatDate(publication.validUntil)}`
        : publication.schedule ?? "Актуально";

  return (
    <article className="mx-auto max-w-3xl space-y-5 sm:space-y-6">
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
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-foreground">
          <span aria-hidden="true" className="text-2xl leading-none">‹</span>
          Назад в ленту
        </Link>
        <FavoriteToggle
          id={publication.id}
          type="publication"
          label={publication.title}
          className="border border-border bg-surface hover:bg-background"
          analytics={{
            organizationId: publication.organization.id,
            publicationId: publication.id
          }}
        />
      </div>

      <PublicationMediaCarouselServer
        publicationId={publication.id}
        publicationTitle={publication.title}
        publicationHref={`/publications/${publication.slug}`}
        fallbackImage={publication.image}
        variant="detail"
      />

      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={
                publication.status === "cancelled"
                  ? "error"
                  : publication.type === "regular"
                    ? "accent"
                    : "info"
              }
            >
              {publication.status === "cancelled" ? "Отменено" : publicationTypeLabels[publication.type]}
            </Badge>
            {publication.isFree ? <Badge variant="sand">Бесплатно</Badge> : null}
            {publication.ageLimit ? <Badge variant="muted">{publication.ageLimit}</Badge> : null}
          </div>
          <p className="text-xs text-foreground-muted">Опубликовано {formatDate(publication.publishedAt ?? publication.updatedAt)}</p>
        </div>
        {publication.status === "cancelled" ? (
          <div className="rounded-md border border-error bg-error/10 p-4" role="status">
            <p className="font-semibold text-error">⚠ Публикация отменена</p>
            <p className="mt-1 text-sm leading-6 text-foreground">
              Организация отменила событие или предложение. Информация сохранена до конца полезного периода.
            </p>
          </div>
        ) : null}
        <h1 className="text-3xl font-semibold leading-9 text-foreground sm:text-4xl sm:leading-10">{publication.title}</h1>
      </header>

      <Card className="shadow-none">
        <CardContent className="p-0">
          <dl className="divide-y divide-border text-sm">
            <div className="flex gap-4 p-4 sm:p-5">
              <dt className="w-24 shrink-0 font-medium text-foreground-muted">
                {publication.type === "news" ? "Дата" : "Когда"}
              </dt>
              <dd className="min-w-0 text-base font-semibold leading-6 text-foreground">{publication.schedule ?? dateLabel}</dd>
            </div>
            {(publication.type === "event" || publication.type === "regular") && publication.place ? (
              <div className="flex gap-4 p-4 sm:p-5">
                <dt className="w-24 shrink-0 font-medium text-foreground-muted">Где</dt>
                <dd className="min-w-0 text-base font-semibold leading-6 text-foreground">{publication.place}</dd>
              </div>
            ) : null}
            {["event", "promo", "regular"].includes(publication.type) && (publication.isFree || publication.priceText) ? (
              <div className="flex gap-4 p-4 sm:p-5">
                <dt className="w-24 shrink-0 font-medium text-foreground-muted">Цена</dt>
                <dd className="min-w-0 text-base font-semibold leading-6 text-foreground">
                  {publication.isFree ? "Бесплатно" : publication.priceText}
                </dd>
              </div>
            ) : null}
            <div className="flex gap-4 p-4 sm:p-5">
              <dt className="w-24 shrink-0 font-medium text-foreground-muted">Организатор</dt>
              <dd className="min-w-0 text-base font-semibold leading-6">
                <Link href={`/organizations/${publication.organization.slug}`} className="text-primary underline-offset-4 hover:underline">
                  {publication.organization.name}
                </Link>
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold leading-7">Описание</h2>
        <p className="whitespace-pre-line text-base leading-7 text-foreground-muted">{publication.description}</p>
      </section>

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
