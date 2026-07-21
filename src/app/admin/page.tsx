import { getAdminApplicationSummary } from "@/features/admin-application-review/model/actions";
import { getAdminAnalyticsSummary, getAdminQualitySummary } from "@/features/admin-quality-control/model/actions";
import { LinkButton } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { SectionHeader } from "@/shared/ui/section-header";

export default async function AdminPage() {
  const [summary, quality, analytics] = await Promise.all([
    getAdminApplicationSummary(),
    getAdminQualitySummary(),
    getAdminAnalyticsSummary()
  ]);

  return (
    <div className="mx-auto max-w-content space-y-6">
      <SectionHeader
        as="h1"
        title="Администрирование"
        description="Заявки организаций, модерация публикаций, сообщения о неточности и важные объявления."
        action={
          <LinkButton href="/admin/applications" variant="outline" size="sm">
            Заявки
          </LinkButton>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="space-y-2">
            <p className="text-sm leading-6 text-foreground-muted">На рассмотрении</p>
            <p className="text-4xl font-semibold">{summary.submitted}</p>
            <LinkButton href="/admin/applications?status=submitted" variant="link">
              Открыть список
            </LinkButton>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2">
            <p className="text-sm leading-6 text-foreground-muted">Требуют внимания</p>
            <p className="text-4xl font-semibold">{summary.needsChanges}</p>
            <LinkButton href="/admin/applications?status=needs_changes" variant="link">
              Открыть список
            </LinkButton>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-4">
        <SectionHeader
          title="Аналитика за 30 дней"
          description="Базовые публичные события без сложной аналитической системы."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardContent className="space-y-2">
              <p className="text-sm leading-6 text-foreground-muted">Всего событий</p>
              <p className="text-4xl font-semibold">{analytics.totalEvents}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2">
              <p className="text-sm leading-6 text-foreground-muted">Организации</p>
              <p className="text-4xl font-semibold">{analytics.organizationViews}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2">
              <p className="text-sm leading-6 text-foreground-muted">Публикации</p>
              <p className="text-4xl font-semibold">{analytics.publicationViews}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2">
              <p className="text-sm leading-6 text-foreground-muted">Звонки</p>
              <p className="text-4xl font-semibold">{analytics.phoneClicks}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2">
              <p className="text-sm leading-6 text-foreground-muted">Маршруты</p>
              <p className="text-4xl font-semibold">{analytics.routeClicks}</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="space-y-2">
            <p className="text-sm leading-6 text-foreground-muted">Новые неточности</p>
            <p className="text-4xl font-semibold">{quality.newReports}</p>
            <LinkButton href="/admin/reports?status=new" variant="link">
              Обработать
            </LinkButton>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2">
            <p className="text-sm leading-6 text-foreground-muted">Скрытые публикации</p>
            <p className="text-4xl font-semibold">{quality.hiddenPublications}</p>
            <LinkButton href="/admin/publications?status=hidden" variant="link">
              Открыть
            </LinkButton>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2">
            <p className="text-sm leading-6 text-foreground-muted">Заблокировано</p>
            <p className="text-4xl font-semibold">{quality.blockedOrganizations}</p>
            <LinkButton href="/admin/organizations?status=blocked" variant="link">
              Организации
            </LinkButton>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2">
            <p className="text-sm leading-6 text-foreground-muted">Важные объявления</p>
            <p className="text-4xl font-semibold">{quality.activeAnnouncements}</p>
            <LinkButton href="/admin/important-announcements?status=active" variant="link">
              Управлять
            </LinkButton>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
