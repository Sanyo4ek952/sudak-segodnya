import Link from "next/link";
import { getAdminReports } from "@/features/admin-quality-control/model/actions";
import {
  adminReportFilters,
  parseAdminPage,
  parseFilter
} from "@/features/admin-quality-control/model/types";
import { ReportReviewForm } from "@/features/admin-quality-control/ui/report-review-form";
import { inaccuracyReasonOptions } from "@/features/report-inaccuracy/model/types";
import { formatDateTime } from "@/shared/lib/date";
import { Badge } from "@/shared/ui/badge";
import { LinkButton } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { SectionHeader } from "@/shared/ui/section-header";

const filterLabels = {
  new: "Новые",
  reviewing: "В работе",
  resolved: "Решённые",
  rejected: "Отклонённые",
  all: "Все"
} as const;

const reportStatusLabels = {
  new: "Новое",
  reviewing: "В работе",
  resolved: "Решено",
  rejected: "Отклонено"
} as const;

const reasonLabels = Object.fromEntries(
  inaccuracyReasonOptions.map((option) => [option.value, option.label])
) as Record<string, string>;

type AdminReportsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function statusVariant(status: string): "success" | "warning" | "error" | "info" {
  if (status === "resolved") return "success";
  if (status === "rejected") return "error";
  if (status === "reviewing") return "warning";
  return "info";
}

export default async function AdminReportsPage({ searchParams }: AdminReportsPageProps) {
  const params = (await searchParams) ?? {};
  const status = parseFilter(firstSearchValue(params.status), adminReportFilters, "new");
  const page = parseAdminPage(firstSearchValue(params.page));
  const result = await getAdminReports({ status, page });
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="mx-auto max-w-content space-y-6">
      <SectionHeader
        as="h1"
        title="Сообщения о неточности"
        description="Обработка пользовательских сообщений без автоматического скрытия публикаций."
      />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {adminReportFilters.map((filter) => (
          <LinkButton
            key={filter}
            href={`/admin/reports?status=${filter}`}
            variant={filter === status ? "primary" : "outline"}
            size="sm"
            className="shrink-0"
          >
            {filterLabels[filter]}
          </LinkButton>
        ))}
      </div>

      {result.items.length === 0 ? (
        <EmptyState title="Сообщений нет" description="В выбранном фильтре пока нет сообщений о неточности." />
      ) : (
        <div className="grid gap-4">
          {result.items.map((report) => (
            <Card key={report.id}>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    {report.publications ? (
                      <Link href={`/publications/${report.publications.slug}`} className="text-lg font-semibold text-foreground hover:text-primary">
                        {report.publications.title}
                      </Link>
                    ) : (
                      <h2 className="text-lg font-semibold">Публикация удалена</h2>
                    )}
                    <p className="text-sm leading-6 text-foreground-muted">
                      {report.publications?.organizations?.name ?? "Организация не найдена"} · {formatDateTime(report.created_at)}
                    </p>
                  </div>
                  <Badge variant={statusVariant(report.status)}>{reportStatusLabels[report.status]}</Badge>
                </div>
                <div className="grid gap-2 text-sm leading-6 text-foreground-muted">
                  <p>
                    Причина: <span className="font-medium text-foreground">{reasonLabels[report.reason] ?? report.reason}</span>
                  </p>
                  {report.comment ? <p>Комментарий: {report.comment}</p> : null}
                  {report.admin_comment ? <p>Комментарий администратора: {report.admin_comment}</p> : null}
                </div>
                <ReportReviewForm reportId={report.id} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <LinkButton
          href={`/admin/reports?status=${status}&page=${Math.max(1, result.page - 1)}`}
          variant="outline"
          size="sm"
          aria-disabled={result.page <= 1}
          className={result.page <= 1 ? "pointer-events-none opacity-50" : undefined}
        >
          Назад
        </LinkButton>
        <p className="text-sm text-foreground-muted">Страница {result.page} из {totalPages}</p>
        <LinkButton
          href={`/admin/reports?status=${status}&page=${Math.min(totalPages, result.page + 1)}`}
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
