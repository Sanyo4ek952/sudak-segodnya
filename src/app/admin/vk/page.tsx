/* eslint-disable @next/next/no-img-element */
import {
  getVkExternalItems,
  ignoreVkExternalItemAction,
  prepareVkExternalItemAction
} from "@/features/vk-import/model/actions";
import {
  parseVkExternalItemStatus,
  vkExternalItemStatuses,
  vkExternalItemStatusLabels,
  type VkExternalItemStatus
} from "@/features/vk-import/model/types";
import { vkFallbackImagePath } from "@/features/vk-import/model/media";
import { VkImportNavigation } from "@/features/vk-import/ui/vk-import-navigation";
import { RunVkImportForm } from "@/features/vk-import/ui/vk-source-controls";
import { formatDateTime } from "@/shared/lib/date";
import { Badge } from "@/shared/ui/badge";
import { LinkButton } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { SectionHeader } from "@/shared/ui/section-header";
import { SubmitButton } from "@/shared/ui/submit-button";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300;

const filterLabels: Record<VkExternalItemStatus, string> = {
  new: "Новые",
  imported: "Импортированные",
  ignored: "Игнорированные",
  error: "Ошибки"
};

type AdminVkQueuePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePage(value: string | undefined) {
  const page = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function statusVariant(status: VkExternalItemStatus) {
  if (status === "imported") return "success";
  if (status === "new") return "info";
  if (status === "ignored") return "muted";
  return "error";
}

function containsVideo(value: unknown) {
  return Array.isArray(value) && value.some((item) => (
    Boolean(item) && typeof item === "object" && (item as Record<string, unknown>).type === "video"
  ));
}

function queueHref(status: VkExternalItemStatus, page?: number) {
  const params = new URLSearchParams({ status });
  if (page && page > 1) params.set("page", String(page));
  return `/admin/vk?${params.toString()}`;
}

export default async function AdminVkQueuePage({ searchParams }: AdminVkQueuePageProps) {
  const params = (await searchParams) ?? {};
  const status = parseVkExternalItemStatus(firstValue(params.status));
  const page = parsePage(firstValue(params.page));
  const result = await getVkExternalItems({ status, page });
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const prepareError = firstValue(params.error) === "prepare";

  return (
    <div className="mx-auto max-w-content space-y-6">
      <VkImportNavigation />
      <SectionHeader
        as="h1"
        title="Импорт VK"
        description="Закрытая очередь. VK-пост не попадает в ленту без проверки и решения администратора."
        action={<RunVkImportForm availability={result.availability} />}
      />

      {prepareError ? (
        <p className="rounded-md bg-surface-muted p-3 text-sm leading-6 text-error" role="alert">
          Не удалось открыть форму публикации. Материал не изменён; обновите страницу и повторите попытку.
        </p>
      ) : null}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {vkExternalItemStatuses.map((filter) => (
          <LinkButton
            key={filter}
            href={queueHref(filter)}
            variant={filter === status ? "primary" : "outline"}
            size="sm"
            className="shrink-0"
          >
            {filterLabels[filter]}
          </LinkButton>
        ))}
      </div>

      <SectionHeader
        title={filterLabels[status]}
        description={`${result.total} материалов соответствуют выбранному фильтру.`}
      />

      {result.items.length === 0 ? (
        <EmptyState
          title="Материалов нет"
          description={status === "new"
            ? "Добавьте активный источник и запустите синхронизацию."
            : "В выбранном состоянии очередь пуста."}
        />
      ) : (
        <div className="grid gap-4">
          {result.items.map((item) => {
            const media = item.stagedMedia;
            const hasVideo = containsVideo(item.media);
            return (
              <Card key={item.id}>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-semibold">{item.external_sources?.name ?? "VK"}</p>
                      <p className="text-sm text-foreground-muted">{formatDateTime(item.published_at)}</p>
                    </div>
                    <Badge variant={statusVariant(item.status)}>{vkExternalItemStatusLabels[item.status]}</Badge>
                  </div>

                  {item.text ? (
                    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{item.text}</p>
                  ) : (
                    <p className="text-sm text-foreground-muted">Пост без текста.</p>
                  )}

                  {media.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {media.map((visual, index) => (
                        <a
                          key={`${visual.sourceUrl}-${index}`}
                          href={item.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="relative overflow-hidden rounded-lg border border-border bg-surface-muted"
                        >
                          <img
                            src={visual.signedUrl}
                            alt={visual.kind === "video_preview" ? "Постер видео из VK-поста" : "Изображение из VK-поста"}
                            width={visual.width || 640}
                            height={visual.height || 360}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="aspect-video h-full w-full object-cover"
                          />
                          {visual.kind === "video_preview" ? (
                            <span className="absolute bottom-2 left-2 rounded-md bg-surface/90 px-2 py-1 text-xs font-medium text-foreground shadow-popover">
                              ▶ Видео
                            </span>
                          ) : null}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="max-w-md overflow-hidden rounded-lg border border-border bg-surface-muted">
                      <img
                        src={vkFallbackImagePath}
                        alt="Заглушка: набережная Судака"
                        width={1672}
                        height={941}
                        loading="lazy"
                        className="aspect-video h-full w-full object-cover"
                      />
                    </div>
                  )}

                  {hasVideo ? (
                    <p className="text-sm text-foreground-muted">
                      Видео остаётся в VK; сохранённый постер используется как изображение публикации.
                    </p>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-3">
                    <a
                      className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline"
                      href={item.source_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Открыть в VK
                    </a>
                    {item.status === "new" ? (
                      <>
                        <form action={prepareVkExternalItemAction}>
                          <input type="hidden" name="itemId" value={item.id} />
                          <SubmitButton size="sm" pendingLabel="Открываем…">
                            {item.content_candidate_id ? "Продолжить создание" : "Создать публикацию"}
                          </SubmitButton>
                        </form>
                        <form action={ignoreVkExternalItemAction}>
                          <input type="hidden" name="itemId" value={item.id} />
                          <SubmitButton size="sm" variant="outline" pendingLabel="Игнорируем…">
                            Игнорировать
                          </SubmitButton>
                        </form>
                      </>
                    ) : null}
                    {item.publication_id ? (
                      <LinkButton href={`/admin/publications/${item.publication_id}`} variant="outline" size="sm">
                        Открыть публикацию
                      </LinkButton>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {totalPages > 1 ? (
        <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="Страницы очереди VK">
          <LinkButton
            href={queueHref(status, Math.max(1, result.page - 1))}
            variant="outline"
            size="sm"
            aria-disabled={result.page <= 1}
            className={result.page <= 1 ? "pointer-events-none opacity-50" : undefined}
          >
            Назад
          </LinkButton>
          <p className="text-sm text-foreground-muted">Страница {result.page} из {totalPages}</p>
          <LinkButton
            href={queueHref(status, Math.min(totalPages, result.page + 1))}
            variant="outline"
            size="sm"
            aria-disabled={result.page >= totalPages}
            className={result.page >= totalPages ? "pointer-events-none opacity-50" : undefined}
          >
            Далее
          </LinkButton>
        </nav>
      ) : null}
    </div>
  );
}
