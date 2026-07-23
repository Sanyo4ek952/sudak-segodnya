import { notFound } from "next/navigation";
import {
  changePublicationStatusAction,
  deleteDraftPublicationAction,
  getBusinessPublications
} from "@/features/business-cabinet/model/actions";
import {
  businessPublicationStatusLabels,
  businessPublicationTypeLabels
} from "@/features/business-cabinet/model/types";
import type { Tables } from "@/shared/api/supabase/database.types";
import { Badge } from "@/shared/ui/badge";
import { Button, LinkButton } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { Input } from "@/shared/ui/input";
import { SectionHeader } from "@/shared/ui/section-header";
import { Select } from "@/shared/ui/select";
import { formatDateTime } from "@/shared/lib/date";

const statuses = Object.keys(businessPublicationStatusLabels) as Tables<"publications">["status"][];
const types = Object.keys(businessPublicationTypeLabels) as Tables<"publications">["type"][];

type PublicationsPageProps = {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{
    status?: string | string[];
    type?: string | string[];
    q?: string | string[];
  }>;
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function statusVariant(status: string) {
  if (status === "published") return "success";
  if (status === "cancelled" || status === "blocked") return "error";
  if (status === "scheduled" || status === "moderation") return "warning";
  return "info";
}

export default async function PublicationsPage({ params, searchParams }: PublicationsPageProps) {
  const [{ organizationId }, query] = await Promise.all([params, searchParams]);
  const rawStatus = single(query.status);
  const rawType = single(query.type);
  const search = single(query.q)?.trim().slice(0, 100) ?? "";
  const status = statuses.includes(rawStatus as Tables<"publications">["status"])
    ? rawStatus as Tables<"publications">["status"]
    : undefined;
  const type = types.includes(rawType as Tables<"publications">["type"])
    ? rawType as Tables<"publications">["type"]
    : undefined;
  const publications = await getBusinessPublications(organizationId, {
    status,
    type,
    query: search || undefined
  });

  if (!publications) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        as="h1"
        title="Публикации"
        description="Поиск, статусы, сроки актуальности и публичные ссылки."
        action={<LinkButton href={`/business/${organizationId}/publications/new`} size="sm">Создать</LinkButton>}
      />

      <form className="grid gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-[1fr_12rem_12rem_auto]" method="get">
        <Input name="q" defaultValue={search} placeholder="Поиск по названию" aria-label="Поиск по названию" />
        <Select name="status" defaultValue={status ?? ""} aria-label="Статус публикации">
          <option value="">Все статусы</option>
          {statuses.map((item) => (
            <option key={item} value={item}>{businessPublicationStatusLabels[item]}</option>
          ))}
        </Select>
        <Select name="type" defaultValue={type ?? ""} aria-label="Тип публикации">
          <option value="">Все типы</option>
          {types.map((item) => (
            <option key={item} value={item}>{businessPublicationTypeLabels[item]}</option>
          ))}
        </Select>
        <Button type="submit" variant="outline">Найти</Button>
      </form>

      {publications.length ? (
        <div className="grid gap-4">
          {publications.map((publication) => {
            const canEdit = ["draft", "scheduled", "moderation", "published"].includes(publication.status);
            const publicDate = publication.publish_at
              ? `Запланировано: ${formatDateTime(publication.publish_at)}`
              : publication.starts_at
                ? `Начало: ${formatDateTime(publication.starts_at)}`
                : publication.valid_until
                  ? `Актуально до: ${formatDateTime(publication.valid_until)}`
                  : "Срок не указан";

            return (
              <Card key={publication.id}>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={statusVariant(publication.status)}>
                          {businessPublicationStatusLabels[publication.status]}
                        </Badge>
                        <Badge variant="muted">{businessPublicationTypeLabels[publication.type]}</Badge>
                      </div>
                      <h2 className="text-lg font-semibold">{publication.title}</h2>
                    </div>
                    {canEdit ? (
                      <LinkButton
                        href={`/business/${organizationId}/publications/${publication.id}`}
                        variant="outline"
                        size="sm"
                      >
                        Редактировать
                      </LinkButton>
                    ) : null}
                  </div>
                  <p className="line-clamp-2 text-sm leading-6 text-foreground-muted">{publication.description}</p>
                  <p className="text-sm text-foreground-muted">{publicDate}</p>
                  {publication.schedule_error ? (
                    <p className="rounded-md bg-error/10 p-3 text-sm text-error">
                      Ошибка планирования: {publication.schedule_error}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {publication.status === "published" || publication.status === "cancelled" ? (
                      <LinkButton href={`/publications/${publication.slug}`} variant="outline" size="sm">
                        Публичная страница
                      </LinkButton>
                    ) : null}
                    {publication.status === "published" ? (
                      <form action={changePublicationStatusAction}>
                        <input type="hidden" name="organizationId" value={organizationId} />
                        <input type="hidden" name="publicationId" value={publication.id} />
                        <input type="hidden" name="status" value="cancelled" />
                        <Button type="submit" variant="outline" size="sm">Отменить</Button>
                      </form>
                    ) : null}
                    {publication.status === "published" || publication.status === "cancelled" ? (
                      <form action={changePublicationStatusAction}>
                        <input type="hidden" name="organizationId" value={organizationId} />
                        <input type="hidden" name="publicationId" value={publication.id} />
                        <input type="hidden" name="status" value="completed" />
                        <Button type="submit" variant="outline" size="sm">Завершить</Button>
                      </form>
                    ) : null}
                    {publication.status === "draft" ? (
                      <form action={deleteDraftPublicationAction}>
                        <input type="hidden" name="organizationId" value={organizationId} />
                        <input type="hidden" name="publicationId" value={publication.id} />
                        <Button type="submit" variant="destructive" size="sm">Удалить черновик</Button>
                      </form>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="Публикации не найдены"
          description="Измените фильтры или создайте новый материал."
          actionLabel="Создать публикацию"
          actionHref={`/business/${organizationId}/publications/new`}
        />
      )}
    </div>
  );
}
