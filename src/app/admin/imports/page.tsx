import Link from "next/link";
import {
  getAdminContentCandidates,
  getContentIngestionAdminOptions,
  getContentSources,
  getRecentContentIngestionRuns,
  updateContentSourceAction
} from "@/features/content-ingestion/model/actions";
import {
  contentCandidateActionLabels,
  contentCandidateStatusLabels,
  getCandidateTitle,
  parseContentCandidateFilter
} from "@/features/content-ingestion/model/types";
import {
  contentCandidateActions,
  contentCandidatePayloadSchema
} from "@/features/content-ingestion/model/contracts";
import {
  CreateSourceForm,
  ManualUrlForm,
  RunIngestionForm
} from "@/features/content-ingestion/ui/source-controls";
import { formatDateTime } from "@/shared/lib/date";
import { Badge } from "@/shared/ui/badge";
import { Button, LinkButton } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { FormField } from "@/shared/ui/form-field";
import { SectionHeader } from "@/shared/ui/section-header";
import { Select } from "@/shared/ui/select";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300;

const statusFilters = ["pending", "duplicate", "approved", "rejected", "stale", "failed", "all"] as const;

const statusFilterLabels = {
  pending: "Ожидают",
  duplicate: "Дубли",
  approved: "Одобрены",
  rejected: "Отклонены",
  stale: "Устарели",
  failed: "Ошибки",
  all: "Все"
} as const;

const sourceTrustLabels: Record<string, string> = {
  official: "Официальный",
  partner: "Партнёрский",
  discovery: "Обнаружение",
  trusted: "Проверенный",
  unverified: "Не проверен"
};

const runStatusLabels: Record<string, string> = {
  queued: "В очереди",
  running: "Выполняется",
  succeeded: "Завершён",
  partial: "Частично",
  failed: "Ошибка",
  skipped: "Пропущен"
};

type AdminImportsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePage(value: string | undefined) {
  const page = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function parseAction(value: string | undefined) {
  return value && contentCandidateActions.includes(value as (typeof contentCandidateActions)[number])
    ? value as (typeof contentCandidateActions)[number]
    : "all" as const;
}

function candidateStatusVariant(status: string) {
  if (status === "approved") return "success";
  if (status === "pending") return "info";
  if (status === "duplicate" || status === "stale") return "warning";
  if (status === "rejected" || status === "failed") return "error";
  return "muted";
}

function runStatusVariant(status: string) {
  if (status === "succeeded") return "success";
  if (status === "queued" || status === "running") return "info";
  if (status === "partial" || status === "skipped") return "warning";
  if (status === "failed") return "error";
  return "muted";
}

function buildListHref({
  status,
  action,
  sourceId,
  warnings,
  page
}: {
  status: string;
  action: string;
  sourceId: string;
  warnings: boolean;
  page?: number;
}) {
  const params = new URLSearchParams({ status });
  if (action !== "all") params.set("action", action);
  if (sourceId) params.set("source", sourceId);
  if (warnings) params.set("warnings", "1");
  if (page && page > 1) params.set("page", String(page));
  return `/admin/imports?${params.toString()}`;
}

function warningCount(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

export default async function AdminImportsPage({ searchParams }: AdminImportsPageProps) {
  const params = (await searchParams) ?? {};
  const status = parseContentCandidateFilter(firstSearchValue(params.status));
  const action = parseAction(firstSearchValue(params.action));
  const sourceId = firstSearchValue(params.source) ?? "";
  const hasWarnings = firstSearchValue(params.warnings) === "1";
  const page = parsePage(firstSearchValue(params.page));

  const [result, options, sources, runs] = await Promise.all([
    getAdminContentCandidates({ status, action, sourceId, hasWarnings, page }),
    getContentIngestionAdminOptions(),
    getContentSources(),
    getRecentContentIngestionRuns(10)
  ]);
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="mx-auto max-w-content space-y-8">
      <SectionHeader
        as="h1"
        title="Импорт контента"
        description="Закрытая очередь материалов. Публичная лента изменится только после решения администратора."
        action={<RunIngestionForm />}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent>
            <ManualUrlForm />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-4">
            <SectionHeader
              title="Новый источник"
              description="Добавьте официальный HTML- или RSS-источник для регулярной проверки."
            />
            <CreateSourceForm />
          </CardContent>
        </Card>
      </div>

      <section className="space-y-4">
        <SectionHeader
          title="Очередь проверки"
          description={`${result.total} материалов соответствуют выбранным фильтрам.`}
        />

        <div className="flex gap-2 overflow-x-auto pb-1">
          {statusFilters.map((filter) => (
            <LinkButton
              key={filter}
              href={buildListHref({ status: filter, action, sourceId, warnings: hasWarnings })}
              variant={filter === status ? "primary" : "outline"}
              size="sm"
              className="shrink-0"
            >
              {statusFilterLabels[filter]}
            </LinkButton>
          ))}
        </div>

        <form method="get" className="grid gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-3 sm:p-5">
          <input type="hidden" name="status" value={status} />
          <FormField id="imports-action" label="Тип кандидата">
            <Select id="imports-action" name="action" defaultValue={action}>
              <option value="all">Все типы</option>
              {contentCandidateActions.map((candidateAction) => (
                <option key={candidateAction} value={candidateAction}>
                  {contentCandidateActionLabels[candidateAction]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="imports-source" label="Источник">
            <Select id="imports-source" name="source" defaultValue={sourceId}>
              <option value="">Все источники</option>
              {options.sources.map((source) => (
                <option key={source.id} value={source.id}>{source.name}</option>
              ))}
            </Select>
          </FormField>
          <div className="flex flex-col justify-end gap-2">
            <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
              <input type="checkbox" name="warnings" value="1" defaultChecked={hasWarnings} />
              Только с предупреждениями
            </label>
            <Button size="sm" type="submit">
              Применить
            </Button>
          </div>
        </form>

        {result.items.length === 0 ? (
          <EmptyState
            title="Материалов нет"
            description="В выбранном фильтре очередь пуста. Можно обработать URL вручную или запустить проверку источников."
          />
        ) : (
          <div className="grid gap-4">
            {result.items.map((candidate) => {
              const parsedPayload = contentCandidatePayloadSchema.safeParse(candidate.payload);
              const title = parsedPayload.success
                ? getCandidateTitle(parsedPayload.data)
                : "Кандидат с некорректными данными";
              const warnings = warningCount(candidate.warnings);
              return (
                <Card key={candidate.id}>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <Link
                          href={`/admin/imports/${candidate.id}`}
                          prefetch={false}
                          className="text-lg font-semibold text-foreground hover:text-primary"
                        >
                          {title}
                        </Link>
                        <p className="text-sm leading-6 text-foreground-muted">
                          {contentCandidateActionLabels[candidate.action]}
                          {candidate.content_sources?.name ? ` · ${candidate.content_sources.name}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {warnings > 0 ? <Badge variant="warning">Предупреждений: {warnings}</Badge> : null}
                        <Badge variant={candidateStatusVariant(candidate.status)}>
                          {contentCandidateStatusLabels[candidate.status]}
                        </Badge>
                      </div>
                    </div>
                    <div className="grid gap-2 text-sm leading-6 text-foreground-muted sm:grid-cols-2">
                      <p>Проверено: {formatDateTime(candidate.source_checked_at)}</p>
                      <p>Обновлено: {formatDateTime(candidate.updated_at)}</p>
                    </div>
                    <LinkButton href={`/admin/imports/${candidate.id}`} variant="outline" size="sm">
                      Проверить материал
                    </LinkButton>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <LinkButton
            href={buildListHref({ status, action, sourceId, warnings: hasWarnings, page: Math.max(1, result.page - 1) })}
            variant="outline"
            size="sm"
            aria-disabled={result.page <= 1}
            className={result.page <= 1 ? "pointer-events-none opacity-50" : undefined}
          >
            Назад
          </LinkButton>
          <p className="text-sm text-foreground-muted">Страница {result.page} из {totalPages}</p>
          <LinkButton
            href={buildListHref({ status, action, sourceId, warnings: hasWarnings, page: Math.min(totalPages, result.page + 1) })}
            variant="outline"
            size="sm"
            aria-disabled={result.page >= totalPages}
            className={result.page >= totalPages ? "pointer-events-none opacity-50" : undefined}
          >
            Далее
          </LinkButton>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="Источники"
          description="Состояние регулярных источников и последняя успешная проверка."
        />
        {sources.length === 0 ? (
          <EmptyState title="Источников нет" description="Добавьте первый официальный источник в форме выше." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {sources.map((source) => (
              <Card key={source.id}>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{source.name}</p>
                      <a className="break-all text-sm text-primary hover:underline" href={source.url} target="_blank" rel="noreferrer">
                        {source.url}
                      </a>
                    </div>
                    <Badge variant={source.is_active ? "success" : "muted"}>
                      {source.is_active ? "Активен" : "Выключен"}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="muted">{source.kind.toUpperCase()}</Badge>
                    <Badge variant="info">{sourceTrustLabels[source.trust_level] ?? source.trust_level}</Badge>
                  </div>
                  <div className="text-sm leading-6 text-foreground-muted">
                    <p>Следующая проверка: {formatDateTime(source.next_check_at)}</p>
                    <p>Последний успех: {source.last_success_at ? formatDateTime(source.last_success_at) : "ещё не было"}</p>
                    {source.consecutive_failures > 0 ? (
                      <p className="text-error">Ошибок подряд: {source.consecutive_failures}</p>
                    ) : null}
                  </div>
                  <form action={updateContentSourceAction} className="grid gap-3 sm:grid-cols-[1fr_auto]">
                    <input type="hidden" name="sourceId" value={source.id} />
                    <FormField id={`source-interval-${source.id}`} label="Интервал, минут">
                      <input
                        id={`source-interval-${source.id}`}
                        className="min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm"
                        type="number"
                        name="fetchIntervalMinutes"
                        min="60"
                        max="43200"
                        defaultValue={source.fetch_interval_minutes}
                      />
                    </FormField>
                    <div className="flex flex-wrap gap-2 self-end">
                      <Button type="submit" name="isActive" value={String(source.is_active)} variant="outline" size="sm">
                        Сохранить
                      </Button>
                      <Button type="submit" name="isActive" value={String(!source.is_active)} variant="secondary" size="sm">
                        {source.is_active ? "Выключить" : "Включить"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <SectionHeader title="Последние запуски" description="Технические детали доступны только администратору." />
        {runs.length === 0 ? (
          <EmptyState title="Запусков пока нет" description="Запустите обработку вручную или дождитесь планового запуска." />
        ) : (
          <div className="grid gap-3">
            {runs.map((run) => (
              <Card key={run.id}>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-medium">{run.content_sources?.name ?? run.source_url ?? "Ручной источник"}</p>
                    <Badge variant={runStatusVariant(run.status)}>{runStatusLabels[run.status] ?? run.status}</Badge>
                  </div>
                  <div className="grid gap-2 text-sm leading-6 text-foreground-muted sm:grid-cols-2 lg:grid-cols-4">
                    <p>Создан: {formatDateTime(run.created_at)}</p>
                    <p>Найдено: {run.discovered_count}</p>
                    <p>Добавлено: {run.created_count}</p>
                    <p>Дубли / ошибки: {run.duplicate_count} / {run.failed_count}</p>
                  </div>
                  {run.error_message ? <p className="text-sm leading-6 text-error">{run.error_message}</p> : null}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
