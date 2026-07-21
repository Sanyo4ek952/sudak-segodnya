import Link from "next/link";
import {
  changeImportantAnnouncementStatusAction,
  getAdminAnnouncements
} from "@/features/admin-quality-control/model/actions";
import {
  adminAnnouncementFilters,
  parseAdminPage,
  parseFilter
} from "@/features/admin-quality-control/model/types";
import { ImportantAnnouncementForm } from "@/features/admin-quality-control/ui/important-announcement-form";
import { formatDate, formatDateTime } from "@/shared/lib/date";
import { Badge } from "@/shared/ui/badge";
import { LinkButton } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { SectionHeader } from "@/shared/ui/section-header";
import { SubmitButton } from "@/shared/ui/submit-button";

const filterLabels = {
  active: "Активные",
  draft: "Черновики",
  expired: "Завершённые",
  hidden: "Снятые",
  all: "Все"
} as const;

const statusLabels = {
  draft: "Черновик",
  active: "Активно",
  expired: "Завершено",
  hidden: "Снято"
} as const;

type AdminAnnouncementsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function statusVariant(status: string): "success" | "warning" | "muted" {
  if (status === "active") return "success";
  if (status === "draft") return "warning";
  return "muted";
}

export default async function AdminAnnouncementsPage({ searchParams }: AdminAnnouncementsPageProps) {
  const params = (await searchParams) ?? {};
  const status = parseFilter(firstSearchValue(params.status), adminAnnouncementFilters, "active");
  const page = parseAdminPage(firstSearchValue(params.page));
  const result = await getAdminAnnouncements({ status, page });
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="mx-auto max-w-content space-y-6">
      <SectionHeader
        as="h1"
        title="Важные объявления"
        description="Компактные объявления над городской лентой с периодом показа."
      />

      <Card>
        <CardContent className="space-y-4">
          <h2 className="text-lg font-semibold">Создать объявление</h2>
          <ImportantAnnouncementForm />
        </CardContent>
      </Card>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {adminAnnouncementFilters.map((filter) => (
          <LinkButton
            key={filter}
            href={`/admin/important-announcements?status=${filter}`}
            variant={filter === status ? "primary" : "outline"}
            size="sm"
            className="shrink-0"
          >
            {filterLabels[filter]}
          </LinkButton>
        ))}
      </div>

      {result.items.length === 0 ? (
        <EmptyState title="Объявлений нет" description="В выбранном фильтре пока нет важных объявлений." />
      ) : (
        <div className="grid gap-4">
          {result.items.map((announcement) => (
            <Card key={announcement.id}>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <h2 className="text-lg font-semibold">{announcement.title}</h2>
                    <p className="text-sm leading-6 text-foreground-muted">{announcement.description}</p>
                  </div>
                  <Badge variant={statusVariant(announcement.status)}>{statusLabels[announcement.status]}</Badge>
                </div>
                <div className="grid gap-2 text-sm leading-6 text-foreground-muted sm:grid-cols-2">
                  <p>С: {announcement.active_from ? formatDateTime(announcement.active_from) : "не задано"}</p>
                  <p>До: {announcement.active_until ? formatDateTime(announcement.active_until) : "не задано"}</p>
                  <p>Обновлено: {formatDate(announcement.updated_at)}</p>
                  <p>
                    Публикация:{" "}
                    {announcement.publications ? (
                      <Link href={`/publications/${announcement.publications.slug}`} className="text-primary">
                        {announcement.publications.title}
                      </Link>
                    ) : (
                      "не связана"
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <LinkButton href={`/admin/important-announcements/${announcement.id}`} variant="outline" size="sm">
                    Редактировать
                  </LinkButton>
                  {announcement.status !== "hidden" ? (
                    <form action={changeImportantAnnouncementStatusAction}>
                      <input type="hidden" name="announcementId" value={announcement.id} />
                      <input type="hidden" name="status" value="hidden" />
                      <SubmitButton variant="outline" size="sm" pendingLabel="Снимаем...">Снять</SubmitButton>
                    </form>
                  ) : null}
                  {announcement.status === "active" ? (
                    <form action={changeImportantAnnouncementStatusAction}>
                      <input type="hidden" name="announcementId" value={announcement.id} />
                      <input type="hidden" name="status" value="expired" />
                      <SubmitButton variant="outline" size="sm" pendingLabel="Завершаем...">Завершить</SubmitButton>
                    </form>
                  ) : null}
                  {announcement.status !== "active" && announcement.active_from && announcement.active_until ? (
                    <form action={changeImportantAnnouncementStatusAction}>
                      <input type="hidden" name="announcementId" value={announcement.id} />
                      <input type="hidden" name="status" value="active" />
                      <SubmitButton size="sm" pendingLabel="Активируем...">Активировать</SubmitButton>
                    </form>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <LinkButton
          href={`/admin/important-announcements?status=${status}&page=${Math.max(1, result.page - 1)}`}
          variant="outline"
          size="sm"
          aria-disabled={result.page <= 1}
          className={result.page <= 1 ? "pointer-events-none opacity-50" : undefined}
        >
          Назад
        </LinkButton>
        <p className="text-sm text-foreground-muted">Страница {result.page} из {totalPages}</p>
        <LinkButton
          href={`/admin/important-announcements?status=${status}&page=${Math.min(totalPages, result.page + 1)}`}
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
