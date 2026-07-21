import Link from "next/link";
import {
  changeAdminOrganizationStatusAction,
  getAdminOrganizations
} from "@/features/admin-quality-control/model/actions";
import {
  adminOrganizationFilters,
  parseAdminPage,
  parseFilter
} from "@/features/admin-quality-control/model/types";
import { formatDateTime } from "@/shared/lib/date";
import { Badge } from "@/shared/ui/badge";
import { LinkButton } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { SectionHeader } from "@/shared/ui/section-header";
import { SubmitButton } from "@/shared/ui/submit-button";

const filterLabels = {
  active: "Активные",
  pending: "Ожидают",
  blocked: "Заблокированные",
  all: "Все"
} as const;

const organizationStatusLabels = {
  draft: "Черновик",
  pending: "Ожидает",
  active: "Активна",
  needs_changes: "Нужны уточнения",
  rejected: "Отклонена",
  blocked: "Заблокирована"
} as const;

type AdminOrganizationsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function statusVariant(status: string): "success" | "warning" | "error" | "muted" {
  if (status === "active") return "success";
  if (status === "blocked" || status === "rejected") return "error";
  if (status === "pending" || status === "needs_changes") return "warning";
  return "muted";
}

export default async function AdminOrganizationsPage({ searchParams }: AdminOrganizationsPageProps) {
  const params = (await searchParams) ?? {};
  const status = parseFilter(firstSearchValue(params.status), adminOrganizationFilters, "active");
  const page = parseAdminPage(firstSearchValue(params.page));
  const result = await getAdminOrganizations({ status, page });
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="mx-auto max-w-content space-y-6">
      <SectionHeader
        as="h1"
        title="Организации"
        description="Блокировка и восстановление организаций без удаления данных."
      />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {adminOrganizationFilters.map((filter) => (
          <LinkButton
            key={filter}
            href={`/admin/organizations?status=${filter}`}
            variant={filter === status ? "primary" : "outline"}
            size="sm"
            className="shrink-0"
          >
            {filterLabels[filter]}
          </LinkButton>
        ))}
      </div>

      {result.items.length === 0 ? (
        <EmptyState title="Организаций нет" description="В выбранном фильтре пока нет организаций." />
      ) : (
        <div className="grid gap-4">
          {result.items.map((organization) => (
            <Card key={organization.id}>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <Link href={`/organizations/${organization.slug}`} className="text-lg font-semibold text-foreground hover:text-primary">
                      {organization.name}
                    </Link>
                    <p className="text-sm leading-6 text-foreground-muted">
                      {organization.organization_types?.name ?? "Тип не указан"}
                    </p>
                  </div>
                  <Badge variant={statusVariant(organization.status)}>
                    {organizationStatusLabels[organization.status]}
                  </Badge>
                </div>
                <div className="grid gap-2 text-sm leading-6 text-foreground-muted sm:grid-cols-2">
                  <p>Телефон: {organization.phone ?? "не указан"}</p>
                  <p>Обновлена: {formatDateTime(organization.updated_at)}</p>
                  <p className="sm:col-span-2">Адрес: {organization.address ?? "не указан"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {organization.status !== "blocked" ? (
                    <form action={changeAdminOrganizationStatusAction}>
                      <input type="hidden" name="organizationId" value={organization.id} />
                      <input type="hidden" name="status" value="blocked" />
                      <SubmitButton variant="destructive" size="sm" pendingLabel="Блокируем...">Блокировать</SubmitButton>
                    </form>
                  ) : (
                    <form action={changeAdminOrganizationStatusAction}>
                      <input type="hidden" name="organizationId" value={organization.id} />
                      <input type="hidden" name="status" value="active" />
                      <SubmitButton size="sm" pendingLabel="Восстанавливаем...">Восстановить</SubmitButton>
                    </form>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <LinkButton
          href={`/admin/organizations?status=${status}&page=${Math.max(1, result.page - 1)}`}
          variant="outline"
          size="sm"
          aria-disabled={result.page <= 1}
          className={result.page <= 1 ? "pointer-events-none opacity-50" : undefined}
        >
          Назад
        </LinkButton>
        <p className="text-sm text-foreground-muted">Страница {result.page} из {totalPages}</p>
        <LinkButton
          href={`/admin/organizations?status=${status}&page=${Math.min(totalPages, result.page + 1)}`}
          variant="outline"
          size="sm"
          aria-disabled={result.page >= totalPages}
          className={result.page >= totalPages ? "pointer-events-none opacity-50" : undefined}
        >
          Далее
        </LinkButton>
      </div>
    </div>
  );
}
