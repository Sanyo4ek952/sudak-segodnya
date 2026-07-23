import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent } from "@/shared/ui/card";
import { LinkButton } from "@/shared/ui/button";
import { SectionHeader } from "@/shared/ui/section-header";
import { AnalyticsActionListener } from "@/features/analytics/ui/analytics-action-listener";
import { AnalyticsOnView } from "@/features/analytics/ui/analytics-on-view";
import { AnalyticsPageView } from "@/features/analytics/ui/analytics-page-view";
import { FavoriteToggle } from "@/features/save-favorite/ui/favorite-toggle";
import {
  getPublicOrganizationBySlug,
  getPublicOrganizationSeoBySlug
} from "@/entities/organization/api/organizations";
import { OrganizationImage } from "@/entities/organization/ui/organization-image";
import { organizationTypeLabels } from "@/entities/organization/model/types";
import { listPublicPublicationsByOrganization } from "@/entities/publication/api/publications";
import { PublicationCard } from "@/entities/publication/ui/publication-card";
import { formatDate } from "@/shared/lib/date";
import {
  createOrganizationJsonLd,
  createOrganizationMetadata
} from "@/shared/lib/seo";
import { JsonLd } from "@/shared/ui/json-ld";

type OrganizationPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: OrganizationPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { organization } = await getPublicOrganizationSeoBySlug(slug);

  if (!organization) {
    notFound();
  }

  return createOrganizationMetadata(organization);
}

export default async function OrganizationPage({ params }: OrganizationPageProps) {
  const { slug } = await params;
  const [{ organization }, { organization: seoOrganization }] = await Promise.all([
    getPublicOrganizationBySlug(slug),
    getPublicOrganizationSeoBySlug(slug)
  ]);

  if (!organization || !seoOrganization) {
    notFound();
  }

  const { publications: organizationPublications } = await listPublicPublicationsByOrganization(organization.id);
  const availableServices = organization.services.filter((service) => service.isAvailable);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <JsonLd data={createOrganizationJsonLd(seoOrganization)} />
      <AnalyticsPageView
        analytics={{
          eventName: "organization_view",
          organizationId: organization.id
        }}
      />
      <AnalyticsActionListener
        context={{
          organizationId: organization.id
        }}
      />
      <Link href="/organizations" className="inline-flex min-h-10 items-center text-sm font-medium text-primary">
        Назад в каталог
      </Link>

      <section className="grid gap-5 md:grid-cols-[280px_1fr]">
        <OrganizationImage organization={organization} className="aspect-[16/11] w-full md:aspect-square" priority />
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="muted">{organizationTypeLabels[organization.type]}</Badge>
            <Badge variant="success">Информация актуальна</Badge>
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">{organization.name}</h1>
            <p className="text-base leading-7 text-foreground-muted">{organization.description}</p>
          </div>
          <div className="flex items-center gap-3">
            <FavoriteToggle
              id={organization.id}
              type="organization"
              label={organization.name}
              analytics={{
                organizationId: organization.id
              }}
            />
            <span className="text-sm text-foreground-muted">Обновлено {formatDate(organization.updatedAt)}</span>
          </div>
        </div>
      </section>

      <Card>
        <CardContent>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium text-foreground-muted">Адрес</dt>
              <dd className="mt-1 text-base font-semibold">{organization.address}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground-muted">График</dt>
              <dd className="mt-1 text-base font-semibold">{organization.workingHours}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground-muted">Телефон</dt>
              <dd className="mt-1 text-base font-semibold">{organization.phone}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground-muted">Маршрут</dt>
              <dd className="mt-1">
                <Link
                  href={`https://yandex.ru/maps/?text=${encodeURIComponent(organization.address)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-base font-semibold text-primary"
                >
                  Открыть карту
                </Link>
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {availableServices.length ? (
        <section className="space-y-4">
          <AnalyticsOnView
            analytics={{
              eventName: "menu_open",
              organizationId: organization.id
            }}
          />
          <SectionHeader title="Меню и услуги" />
          <div className="grid gap-3 sm:grid-cols-2">
            {availableServices.map((service) => (
              <Card key={service.id}>
                <CardContent className="space-y-2">
                  <h2 className="text-base font-semibold">{service.title}</h2>
                  <p className="text-sm leading-6 text-foreground-muted">{service.description}</p>
                  <p className="text-sm font-semibold">{service.priceText}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {organizationPublications.length ? (
        <section className="space-y-4">
          <SectionHeader title="Ближайшие публикации" />
          <div className="grid gap-4 md:grid-cols-2">
            {organizationPublications.map((publication) => (
              <PublicationCard key={publication.id} publication={publication} />
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <LinkButton href={`tel:${organization.phone.replace(/\D/g, "")}`}>Позвонить</LinkButton>
        <LinkButton
          href={`https://yandex.ru/maps/?text=${encodeURIComponent(organization.address)}`}
          variant="outline"
          target="_blank"
          rel="noreferrer"
        >
          Построить маршрут
        </LinkButton>
      </div>
    </div>
  );
}
