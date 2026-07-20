import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent } from "@/shared/ui/card";
import { LinkButton } from "@/shared/ui/button";
import { SectionHeader } from "@/shared/ui/section-header";
import { FavoriteToggle } from "@/features/save-favorite/ui/favorite-toggle";
import { getOrganizationBySlug, organizations } from "@/entities/organization/model/mock";
import { OrganizationImage } from "@/entities/organization/ui/organization-image";
import { organizationCategoryLabels } from "@/entities/organization/model/types";
import { getPublicationsByOrganization } from "@/entities/publication/model/mock";
import { PublicationCard } from "@/entities/publication/ui/publication-card";
import { formatDate } from "@/shared/lib/date";

type OrganizationPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return organizations.map((organization) => ({ slug: organization.slug }));
}

export default async function OrganizationPage({ params }: OrganizationPageProps) {
  const { slug } = await params;
  const organization = getOrganizationBySlug(slug);

  if (!organization) {
    notFound();
  }

  const organizationPublications = getPublicationsByOrganization(organization.id);
  const availableServices = organization.services.filter((service) => service.isAvailable);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/organizations" className="inline-flex min-h-10 items-center text-sm font-medium text-primary">
        Назад в каталог
      </Link>

      <section className="grid gap-5 md:grid-cols-[280px_1fr]">
        <OrganizationImage organization={organization} className="aspect-[16/11] w-full md:aspect-square" priority />
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="muted">{organizationCategoryLabels[organization.category]}</Badge>
            <Badge variant="success">Информация актуальна</Badge>
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">{organization.name}</h1>
            <p className="text-base leading-7 text-foreground-muted">{organization.description}</p>
          </div>
          <div className="flex items-center gap-3">
            <FavoriteToggle id={organization.id} type="organization" label={organization.name} />
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
