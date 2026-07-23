import {
  listPublicOrganizations,
  listPublicOrganizationTypes
} from "@/entities/organization/api/organizations";
import {
  normalizeOrganizationCatalogFilters,
  type OrganizationCatalogSearchParams
} from "@/entities/organization/model/catalog-filters";
import { OrganizationCard } from "@/entities/organization/ui/organization-card";
import { EmptyState } from "@/shared/ui/empty-state";
import { ErrorState } from "@/shared/ui/error-state";
import { SectionHeader } from "@/shared/ui/section-header";
import { OrganizationCatalogFilters } from "@/widgets/organization-catalog/ui/organization-catalog-filters";

export const dynamic = "force-dynamic";

type OrganizationsPageProps = {
  searchParams: Promise<OrganizationCatalogSearchParams>;
};

export default async function OrganizationsPage({ searchParams }: OrganizationsPageProps) {
  const filters = normalizeOrganizationCatalogFilters(await searchParams);
  const [{ organizations, error: organizationsError }, { organizationTypes, error: organizationTypesError }] =
    await Promise.all([listPublicOrganizations(filters), listPublicOrganizationTypes()]);
  const error = organizationsError ?? organizationTypesError;
  const hasFilters = Boolean(filters.query || filters.type);

  return (
    <div className="space-y-6">
      <SectionHeader
        as="h1"
        title="Каталог организаций"
        description="Кафе, музеи, кружки, экскурсии и городские сервисы с актуальными публикациями."
      />
      <OrganizationCatalogFilters filters={filters} organizationTypes={organizationTypes} />
      {error ? (
        <ErrorState title="Каталог временно недоступен" description={error} />
      ) : organizations.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {organizations.map((organization) => (
            <OrganizationCard key={organization.id} organization={organization} />
          ))}
        </div>
      ) : hasFilters ? (
        <EmptyState
          title="По вашему запросу ничего не найдено"
          description="Попробуйте изменить название или выбрать другую категорию."
          actionLabel="Сбросить фильтры"
          actionHref="/organizations"
        />
      ) : (
        <EmptyState
          title="Организаций пока нет"
          description="Каталог появится после подтверждения первых организаций."
        />
      )}
    </div>
  );
}
