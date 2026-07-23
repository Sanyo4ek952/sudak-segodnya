import Link from "next/link";
import { notFound } from "next/navigation";
import { getBusinessOverview } from "@/features/business-cabinet/model/actions";
import { businessPublicationStatusLabels } from "@/features/business-cabinet/model/types";
import { Badge } from "@/shared/ui/badge";
import { LinkButton } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { SectionHeader } from "@/shared/ui/section-header";
import { formatDateTime } from "@/shared/lib/date";

type BusinessOrganizationPageProps = {
  params: Promise<{
    organizationId: string;
  }>;
};

export default async function BusinessOrganizationPage({ params }: BusinessOrganizationPageProps) {
  const { organizationId } = await params;
  const overview = await getBusinessOverview(organizationId);

  if (!overview) {
    notFound();
  }

  const analyticsActions = (overview.analytics?.phoneClicks ?? 0)
    + (overview.analytics?.routeClicks ?? 0)
    + (overview.analytics?.menuOpens ?? 0);

  return (
    <div className="space-y-6">
      <SectionHeader
        as="h1"
        title={overview.organization.name}
        description="Главная кабинета: состояние профиля, контента и действий за 30 дней."
        action={
          <LinkButton href={`/business/${organizationId}/publications/new`} size="sm">
            Создать публикацию
          </LinkButton>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent>
            <p className="text-sm text-foreground-muted">Статус</p>
            <Badge variant="success">{overview.organization.status === "active" ? "Активна" : overview.organization.status}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-foreground-muted">Профиль заполнен</p>
            <p className="mt-2 text-3xl font-semibold">{overview.profileCompleteness}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-foreground-muted">Активные публикации</p>
            <p className="mt-2 text-3xl font-semibold">{overview.activePublications}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-foreground-muted">Просмотры за 30 дней</p>
            <p className="mt-2 text-3xl font-semibold">
              {(overview.analytics?.organizationViews ?? 0) + (overview.analytics?.publicationViews ?? 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {(overview.profileCompleteness < 100
        || overview.expiringPublications > 0
        || overview.adminComment
        || overview.organization.pending_type_id) ? (
        <Card className="border-warning">
          <CardContent className="space-y-3">
            <h2 className="text-lg font-semibold">Требует действия</h2>
            <div className="grid gap-2 text-sm leading-6">
              {overview.profileCompleteness < 100 ? (
                <p>
                  Профиль заполнен не полностью.{" "}
                  <Link className="font-medium text-primary" href={`/business/${organizationId}/profile`}>
                    Дополнить профиль
                  </Link>
                </p>
              ) : null}
              {overview.expiringPublications > 0 ? (
                <p>В ближайшие 7 дней истекают публикации: {overview.expiringPublications}.</p>
              ) : null}
              {overview.organization.pending_type_id ? (
                <p>Запрос на смену основного типа ожидает проверки администратора.</p>
              ) : null}
              {overview.adminComment ? (
                <p className="rounded-md bg-surface-muted p-3">{overview.adminComment}</p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-sm text-foreground-muted">Действия за 30 дней</p>
            <p className="mt-2 text-3xl font-semibold">{analyticsActions}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-foreground-muted">Истекают за 7 дней</p>
            <p className="mt-2 text-3xl font-semibold">{overview.expiringPublications}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-foreground-muted">Позиции меню</p>
            <p className="mt-2 text-3xl font-semibold">{overview.menuItems}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Ближайшие публикации</h2>
            <LinkButton href={`/business/${organizationId}/publications`} variant="outline" size="sm">
              Все публикации
            </LinkButton>
          </div>
          {overview.upcomingPublications.length ? (
            <div className="grid gap-3">
              {overview.upcomingPublications.map((publication) => (
                <div key={publication.id} className="rounded-md border border-border bg-background p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{publication.title}</p>
                    <Badge variant="info">{businessPublicationStatusLabels[publication.status]}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-foreground-muted">
                    {publication.starts_at
                      ? formatDateTime(publication.starts_at)
                      : publication.valid_until
                        ? `Актуально до ${formatDateTime(publication.valid_until)}`
                        : "Дата не указана"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-6 text-foreground-muted">Ближайших публикаций пока нет.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
