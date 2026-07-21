import Link from "next/link";
import {
  getAdminApplications
} from "@/features/admin-application-review/model/actions";
import {
  adminApplicationFilters,
  parseAdminApplicationFilter,
  parseAdminApplicationPage
} from "@/features/admin-application-review/model/types";
import {
  getOrganizationApplicationStatusVariant,
  organizationApplicationStatusLabels
} from "@/entities/organization-application/model/types";
import { formatDateTime } from "@/shared/lib/date";
import { Badge } from "@/shared/ui/badge";
import { LinkButton } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { SectionHeader } from "@/shared/ui/section-header";

const filterLabels = {
  submitted: "На рассмотрении",
  needs_changes: "Требуют уточнения",
  approved: "Одобрены",
  rejected: "Отклонены",
  all: "Все"
} as const;

type AdminApplicationsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminApplicationsPage({
  searchParams
}: AdminApplicationsPageProps) {
  const params = (await searchParams) ?? {};
  const status = parseAdminApplicationFilter(firstSearchValue(params.status));
  const page = parseAdminApplicationPage(firstSearchValue(params.page));
  const result = await getAdminApplications({ status, page });
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="mx-auto max-w-content space-y-6">
      <SectionHeader
        as="h1"
        title="Заявки организаций"
        description="Серверная фильтрация и простая постраничная загрузка."
        action={
          <LinkButton href="/admin" variant="outline" size="sm">
            Назад
          </LinkButton>
        }
      />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {adminApplicationFilters.map((filter) => (
          <LinkButton
            key={filter}
            href={`/admin/applications?status=${filter}`}
            variant={filter === status ? "primary" : "outline"}
            size="sm"
            className="shrink-0"
          >
            {filterLabels[filter]}
          </LinkButton>
        ))}
      </div>

      {result.items.length === 0 ? (
        <EmptyState
          title="Заявок нет"
          description={
            status === "submitted"
              ? "На рассмотрении пока нет заявок. Если заявка была сохранена как черновик или уже обработана, проверьте фильтр «Все»."
              : "В выбранном фильтре пока нет заявок организаций."
          }
        />
      ) : (
        <div className="grid gap-4">
          {result.items.map((application) => (
            <Card key={application.id}>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/applications/${application.id}`}
                      className="text-lg font-semibold text-foreground hover:text-primary"
                    >
                      {application.organization_name ?? "Заявка организации"}
                    </Link>
                    <p className="text-sm leading-6 text-foreground-muted">
                      {application.organization_types?.name ?? "Тип не указан"}
                    </p>
                  </div>
                  <Badge variant={getOrganizationApplicationStatusVariant(application.status)}>
                    {organizationApplicationStatusLabels[application.status]}
                  </Badge>
                </div>
                <div className="grid gap-2 text-sm leading-6 text-foreground-muted sm:grid-cols-2">
                  <p>Заявитель: {application.applicant?.display_name ?? application.applicant_id}</p>
                  <p>Телефон: {application.phone ?? "не указан"}</p>
                  <p>
                    Подана:{" "}
                    {application.submitted_at
                      ? formatDateTime(application.submitted_at)
                      : formatDateTime(application.created_at)}
                  </p>
                  <p>Обновлена: {formatDateTime(application.updated_at)}</p>
                </div>
                <LinkButton href={`/admin/applications/${application.id}`} variant="outline" size="sm">
                  Открыть
                </LinkButton>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <LinkButton
          href={`/admin/applications?status=${status}&page=${Math.max(1, result.page - 1)}`}
          variant="outline"
          size="sm"
          aria-disabled={result.page <= 1}
          className={result.page <= 1 ? "pointer-events-none opacity-50" : undefined}
        >
          Назад
        </LinkButton>
        <p className="text-sm text-foreground-muted">
          Страница {result.page} из {totalPages}
        </p>
        <LinkButton
          href={`/admin/applications?status=${status}&page=${Math.min(totalPages, result.page + 1)}`}
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
