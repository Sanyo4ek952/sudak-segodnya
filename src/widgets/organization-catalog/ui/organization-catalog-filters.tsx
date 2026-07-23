import { Button, LinkButton } from "@/shared/ui/button";
import { FormField } from "@/shared/ui/form-field";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { organizationCatalogQueryMaxLength, type OrganizationCatalogFilters } from "@/entities/organization/model/catalog-filters";
import type { OrganizationTypeOption } from "@/entities/organization/model/types";

type OrganizationCatalogFiltersProps = {
  filters: OrganizationCatalogFilters;
  organizationTypes: OrganizationTypeOption[];
};

export function OrganizationCatalogFilters({
  filters,
  organizationTypes
}: OrganizationCatalogFiltersProps) {
  const hasFilters = Boolean(filters.query || filters.type);

  return (
    <form action="/organizations" className="rounded-lg border border-border bg-surface p-4 sm:p-5" role="search">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_14rem_auto] sm:items-end">
        <FormField id="organizationQuery" label="Название организации">
          <Input
            id="organizationQuery"
            name="q"
            type="search"
            defaultValue={filters.query ?? ""}
            maxLength={organizationCatalogQueryMaxLength}
            placeholder="Например, музей или кафе"
          />
        </FormField>
        <FormField id="organizationType" label="Категория">
          <Select id="organizationType" name="type" defaultValue={filters.type ?? ""}>
            <option value="">Все категории</option>
            {organizationTypes.map((organizationType) => (
              <option key={organizationType.slug} value={organizationType.slug}>
                {organizationType.name}
              </option>
            ))}
          </Select>
        </FormField>
        <div className="flex min-h-11 flex-wrap items-center gap-3">
          <Button type="submit" className="w-full sm:w-auto">
            Найти
          </Button>
          {hasFilters ? (
            <LinkButton href="/organizations" variant="link" className="min-h-11">
              Сбросить
            </LinkButton>
          ) : null}
        </div>
      </div>
    </form>
  );
}
