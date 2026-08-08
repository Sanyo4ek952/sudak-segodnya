import { getVkSourceAdminData } from "@/features/vk-import/model/actions";
import { VkImportNavigation } from "@/features/vk-import/ui/vk-import-navigation";
import {
  CreateVkSourceForm,
  RunVkImportForm,
  VkSourceSettingsForm
} from "@/features/vk-import/ui/vk-source-controls";
import { formatDateTime } from "@/shared/lib/date";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { SectionHeader } from "@/shared/ui/section-header";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminVkSourcesPage() {
  const { sources, organizations, availability } = await getVkSourceAdminData();
  return (
    <div className="mx-auto max-w-content space-y-6">
      <VkImportNavigation />
      <SectionHeader
        as="h1"
        title="Источники VK"
        description="Разрешённые публичные сообщества. Токен VK хранится только в Supabase Edge Function Secrets."
        action={<RunVkImportForm availability={availability} />}
      />

      <Card>
        <CardContent className="space-y-4">
          <SectionHeader
            title="Добавить сообщество"
            description="Укажите domain из адреса vk.com. Повторный источник с тем же domain добавить нельзя."
          />
          <CreateVkSourceForm organizations={organizations} />
        </CardContent>
      </Card>

      <section className="space-y-4">
        <SectionHeader title="Настроенные источники" description={`Всего: ${sources.length}.`} />
        {sources.length === 0 ? (
          <EmptyState
            title="Источников пока нет"
            description="Добавьте публичное VK-сообщество, чтобы его новые посты попадали в закрытую очередь."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {sources.map((source) => (
              <Card key={source.id}>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <a
                        className="break-all font-semibold text-primary hover:underline"
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        vk.com/{source.domain}
                      </a>
                      <p className="text-sm text-foreground-muted">
                        {source.organizations?.name ?? "Без привязанной организации"}
                      </p>
                    </div>
                    <Badge variant={source.is_active ? "success" : "muted"}>
                      {source.is_active ? "Активен" : "Приостановлен"}
                    </Badge>
                  </div>
                  <dl className="grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-foreground-muted">Последняя синхронизация</dt>
                      <dd>{source.last_synced_at ? formatDateTime(source.last_synced_at) : "Ещё не запускалась"}</dd>
                    </div>
                    <div>
                      <dt className="text-foreground-muted">VK owner id</dt>
                      <dd>{source.external_id ?? "Определится при синхронизации"}</dd>
                    </div>
                  </dl>
                  {source.last_sync_error ? (
                    <p className="rounded-md bg-surface-muted p-3 text-sm leading-6 text-error" role="status">
                      Последняя ошибка: {source.last_sync_error}
                    </p>
                  ) : null}
                  <VkSourceSettingsForm source={source} organizations={organizations} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
