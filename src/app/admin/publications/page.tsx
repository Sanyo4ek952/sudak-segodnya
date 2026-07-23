import Link from "next/link";
import { getAdminPublications } from "@/features/admin-quality-control/model/actions";
import { PublicationModerationActions } from "@/features/admin-quality-control/ui/moderation-actions";
import {
  adminPublicationFilters,
  parseAdminPage,
  parseFilter
} from "@/features/admin-quality-control/model/types";
import {
  businessPublicationStatusLabels,
  businessPublicationTypeLabels
} from "@/features/business-cabinet/model/types";
import { formatDateTime } from "@/shared/lib/date";
import { Badge } from "@/shared/ui/badge";
import { LinkButton } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { SectionHeader } from "@/shared/ui/section-header";

const filterLabels = {
  published: "Опубликованные",
  cancelled: "Отменённые",
  hidden: "Скрытые",
  blocked: "Заблокированные",
  all: "Все"
} as const;

type AdminPublicationsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function statusVariant(status: string) {
  if (status === "blocked" || status === "cancelled") return "error";
  if (status === "hidden") return "warning";
  if (status === "published") return "success";
  return "muted";
}

export default async function AdminPublicationsPage({ searchParams }: AdminPublicationsPageProps) {
  const params = (await searchParams) ?? {};
  const status = parseFilter(firstSearchValue(params.status), adminPublicationFilters, "published");
  const page = parseAdminPage(firstSearchValue(params.page));
  const result = await getAdminPublications({ status, page });
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="mx-auto max-w-content space-y-6">
      <SectionHeader
        as="h1"
        title="Публикации"
        description="Административное скрытие, блокировка и восстановление публикаций."
      />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {adminPublicationFilters.map((filter) => (
          <LinkButton
            key={filter}
            href={`/admin/publications?status=${filter}`}
            variant={filter === status ? "primary" : "outline"}
            size="sm"
            className="shrink-0"
          >
            {filterLabels[filter]}
          </LinkButton>
        ))}
      </div>

      {result.items.length === 0 ? (
        <EmptyState title="Публикаций нет" description="В выбранном фильтре пока нет публикаций." />
      ) : (
        <div className="grid gap-4">
          {result.items.map((publication) => (
            <Card key={publication.id}>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <Link href={`/publications/${publication.slug}`} className="text-lg font-semibold text-foreground hover:text-primary">
                      {publication.title}
                    </Link>
                    <p className="text-sm leading-6 text-foreground-muted">
                      {publication.organizations?.name ?? "Организация не найдена"} · {businessPublicationTypeLabels[publication.type]}
                    </p>
                  </div>
                  <Badge variant={statusVariant(publication.status)}>
                    {businessPublicationStatusLabels[publication.status]}
                  </Badge>
                </div>
                <div className="grid gap-2 text-sm leading-6 text-foreground-muted sm:grid-cols-2">
                  <p>Обновлена: {formatDateTime(publication.updated_at)}</p>
                  <p>Публикация: {publication.published_at ? formatDateTime(publication.published_at) : "не опубликована"}</p>
                </div>
                {publication.moderation_comment ? (
                  <p className="rounded-md bg-surface-muted p-3 text-sm leading-6 text-foreground-muted">
                    {publication.moderation_comment}
                  </p>
                ) : null}
                <PublicationModerationActions
                  publicationId={publication.id}
                  status={publication.status}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <LinkButton
          href={`/admin/publications?status=${status}&page=${Math.max(1, result.page - 1)}`}
          variant="outline"
          size="sm"
          aria-disabled={result.page <= 1}
          className={result.page <= 1 ? "pointer-events-none opacity-50" : undefined}
        >
          Назад
        </LinkButton>
        <p className="text-sm text-foreground-muted">Страница {result.page} из {totalPages}</p>
        <LinkButton
          href={`/admin/publications?status=${status}&page=${Math.min(totalPages, result.page + 1)}`}
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
