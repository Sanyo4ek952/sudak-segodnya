import {
  getAdminAuditEvents
} from "@/features/admin-quality-control/model/actions";
import {
  adminAuditFilters,
  parseAdminPage,
  parseFilter
} from "@/features/admin-quality-control/model/types";
import { getAuditActionLabel } from "@/features/admin-quality-control/ui/audit-history";
import { formatDateTime } from "@/shared/lib/date";
import { Badge } from "@/shared/ui/badge";
import { LinkButton } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { SectionHeader } from "@/shared/ui/section-header";

const filterLabels = {
  organization_applications: "Заявки организаций",
  organizations: "Организации",
  publications: "Публикации",
  organization_members: "Представители",
  important_announcements: "Важные объявления",
  all: "Все"
} as const;

type AdminAuditPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminAuditPage({ searchParams }: AdminAuditPageProps) {
  const params = (await searchParams) ?? {};
  const entityType = parseFilter(firstSearchValue(params.type), adminAuditFilters, "all");
  const page = parseAdminPage(firstSearchValue(params.page));
  const result = await getAdminAuditEvents({ entityType, page });
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="mx-auto max-w-content space-y-6">
      <SectionHeader
        as="h1"
        title="История действий"
        description="Неизменяемая хронология заявок, модерации, ролей и важных объявлений."
      />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {adminAuditFilters.map((filter) => (
          <LinkButton
            key={filter}
            href={`/admin/audit?type=${filter}`}
            variant={filter === entityType ? "primary" : "outline"}
            size="sm"
            className="shrink-0"
          >
            {filterLabels[filter]}
          </LinkButton>
        ))}
      </div>

      {!result.items.length ? (
        <EmptyState title="История пуста" description="Для выбранного типа действий записей пока нет." />
      ) : (
        <div className="grid gap-3">
          {result.items.map((event) => (
            <Card key={event.id}>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{getAuditActionLabel(event.action)}</p>
                    <p className="text-sm text-foreground-muted">
                      {event.actor?.display_name ?? (event.actor_id ? "Администратор или представитель" : "Система")}
                    </p>
                  </div>
                  <Badge variant="muted">{formatDateTime(event.created_at)}</Badge>
                </div>
                <p className="break-all text-xs text-foreground-muted">
                  {event.entity_type} · {event.entity_id}
                </p>
                {event.reason ? (
                  <p className="rounded-md bg-surface-muted p-3 text-sm leading-6 text-foreground-muted">
                    {event.reason}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <LinkButton
          href={`/admin/audit?type=${entityType}&page=${Math.max(1, result.page - 1)}`}
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
          href={`/admin/audit?type=${entityType}&page=${Math.min(totalPages, result.page + 1)}`}
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

