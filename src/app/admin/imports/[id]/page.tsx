import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  getAdminContentCandidate,
  getContentIngestionAdminOptions
} from "@/features/content-ingestion/model/actions";
import {
  contentCandidateActionLabels,
  contentCandidateStatusLabels
} from "@/features/content-ingestion/model/types";
import { CandidatePreview } from "@/features/content-ingestion/ui/candidate-preview";
import { CandidateReviewForm } from "@/features/content-ingestion/ui/candidate-review-form";
import { formatDateTime } from "@/shared/lib/date";
import { Badge } from "@/shared/ui/badge";
import { LinkButton } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { SectionHeader } from "@/shared/ui/section-header";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AdminImportCandidatePageProps = {
  params: Promise<{ id: string }>;
};

function statusVariant(status: string) {
  if (status === "approved") return "success";
  if (status === "pending") return "info";
  if (status === "duplicate" || status === "stale") return "warning";
  if (status === "rejected" || status === "failed") return "error";
  return "muted";
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-sm text-foreground-muted">{label}</dt>
      <dd className="break-words text-sm leading-6 text-foreground">{value || "Не указано"}</dd>
    </div>
  );
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export default async function AdminImportCandidatePage({ params }: AdminImportCandidatePageProps) {
  const { id } = await params;
  const [candidate, options] = await Promise.all([
    getAdminContentCandidate(id),
    getContentIngestionAdminOptions()
  ]);

  if (!candidate) notFound();

  const detail = candidate as typeof candidate & {
    content_ingestion_runs: {
      id: string;
      status: string;
      trigger: string;
      started_at: string | null;
      finished_at: string | null;
    } | null;
  };

  const warnings = stringArray(detail.warnings);
  const title = detail.parsedPayload.kind === "organization"
    ? detail.parsedPayload.name
    : detail.parsedPayload.title;

  return (
    <div className="mx-auto max-w-content space-y-6">
      <SectionHeader
        as="h1"
        title={title}
        description="Сверьте нормализованные поля с первичным источником перед решением."
        action={
          <LinkButton href="/admin/imports" variant="outline" size="sm">
            К очереди
          </LinkButton>
        }
      />

      <Card>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm text-foreground-muted">{contentCandidateActionLabels[detail.action]}</p>
              <p className="font-medium">{detail.content_sources?.name ?? "Разовый URL"}</p>
            </div>
            <Badge variant={statusVariant(detail.status)}>
              {contentCandidateStatusLabels[detail.status]}
            </Badge>
          </div>

          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DetailRow
              label="Первичный источник"
              value={
                <a className="text-primary hover:underline" href={detail.source_url} target="_blank" rel="noreferrer">
                  Открыть исходную страницу
                </a>
              }
            />
            <DetailRow label="Источник проверен" value={formatDateTime(detail.source_checked_at)} />
            <DetailRow label="Кандидат создан" value={formatDateTime(detail.created_at)} />
            <DetailRow label="Последний раз найден" value={formatDateTime(detail.last_seen_at)} />
            <DetailRow label="Внешний идентификатор" value={detail.external_id} />
            <DetailRow label="Уровень доверия" value={detail.content_sources?.trust_level} />
            <DetailRow label="Запуск" value={detail.content_ingestion_runs?.status} />
            <DetailRow label="Инициатор" value={detail.content_ingestion_runs?.trigger} />
            <DetailRow label="Проверил" value={detail.reviewed_by} />
            <DetailRow label="Решение" value={detail.decision} />
            <DetailRow
              label="Дата решения"
              value={detail.reviewed_at ? formatDateTime(detail.reviewed_at) : null}
            />
            <DetailRow label="Комментарий" value={detail.review_comment} />
          </dl>
        </CardContent>
      </Card>

      {warnings.length > 0 || detail.error_message ? (
        <Card>
          <CardContent className="space-y-4">
            <SectionHeader title="Предупреждения" description="Они не блокируют черновик, но могут блокировать публикацию." />
            {warnings.length > 0 ? (
              <ul className="space-y-2">
                {warnings.map((warning, index) => (
                  <li key={`${warning}-${index}`} className="rounded-md bg-surface-muted p-3 text-sm leading-6">
                    {warning}
                  </li>
                ))}
              </ul>
            ) : null}
            {detail.error_message ? <p className="text-sm leading-6 text-error">{detail.error_message}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
        <Card>
          <CardContent className="space-y-5">
            <SectionHeader
              title="Нормализованные данные"
              description="Исправления сохраняются вместе с решением администратора."
            />
            <CandidateReviewForm
              candidateId={detail.id}
              action={detail.action}
              status={detail.status}
              payload={detail.parsedPayload}
              organizations={options.organizations}
              categories={options.publicationCategories}
              organizationTypes={options.organizationTypes}
              publications={options.publications}
            />
          </CardContent>
        </Card>

        <section className="min-w-0 space-y-4">
          <SectionHeader title="Предпросмотр" description="Изображение не копируется; используется штатная заглушка." />
          <CandidatePreview candidateId={detail.id} payload={detail.parsedPayload} />
        </section>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <SectionHeader
            title="Доказательства по полям"
            description="Короткие фрагменты сохранены вместе с URL первичного источника."
          />
          {detail.parsedEvidence.length === 0 ? (
            <p className="text-sm leading-6 text-foreground-muted">Доказательства не извлечены.</p>
          ) : (
            <dl className="grid gap-3">
              {detail.parsedEvidence.map((evidence, index) => (
                <div key={`${evidence.field}-${index}`} className="rounded-md border border-border p-3">
                  <dt className="text-sm font-medium text-foreground">{evidence.field}</dt>
                  <dd className="mt-1 text-sm leading-6 text-foreground-muted">{evidence.excerpt}</dd>
                  <dd className="mt-2">
                    <a className="break-all text-sm text-primary hover:underline" href={evidence.sourceUrl} target="_blank" rel="noreferrer">
                      Источник доказательства
                    </a>
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>

      {detail.duplicate_of_id || detail.duplicate_publication_id || detail.duplicate_organization_id || detail.depends_on_candidate_id ? (
        <Card>
          <CardContent className="space-y-4">
            <SectionHeader title="Связи и возможные дубли" description="Проверьте связанные сущности до публикации." />
            <dl className="grid gap-4 sm:grid-cols-2">
              {detail.duplicate_of_id ? (
                <DetailRow
                  label="Похожий кандидат"
                  value={<Link className="text-primary hover:underline" href={`/admin/imports/${detail.duplicate_of_id}`}>Открыть кандидата</Link>}
                />
              ) : null}
              {detail.duplicate_publication_id ? (
                <DetailRow label="Похожая публикация" value={detail.duplicate_publication_id} />
              ) : null}
              {detail.duplicate_organization_id ? (
                <DetailRow label="Похожая организация" value={detail.duplicate_organization_id} />
              ) : null}
              {detail.depends_on_candidate_id ? (
                <DetailRow
                  label="Зависит от кандидата"
                  value={<Link className="text-primary hover:underline" href={`/admin/imports/${detail.depends_on_candidate_id}`}>Открыть организацию</Link>}
                />
              ) : null}
              {detail.target_publication_id ? <DetailRow label="Целевая публикация" value={detail.target_publication_id} /> : null}
              {detail.target_organization_id ? <DetailRow label="Целевая организация" value={detail.target_organization_id} /> : null}
              {detail.result_publication_id ? <DetailRow label="Созданная публикация" value={detail.result_publication_id} /> : null}
              {detail.result_organization_id ? <DetailRow label="Созданная организация" value={detail.result_organization_id} /> : null}
            </dl>
          </CardContent>
        </Card>
      ) : null}

      {detail.source_excerpt ? (
        <Card>
          <CardContent className="space-y-3">
            <details>
              <summary className="cursor-pointer font-semibold">Исходный фрагмент</summary>
              <p className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words text-sm leading-6 text-foreground-muted">
                {detail.source_excerpt}
              </p>
            </details>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
