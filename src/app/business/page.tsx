import { logoutAction } from "@/features/auth/model/actions";
import { getBusinessOrganizations } from "@/features/business-cabinet/model/actions";
import { getCurrentBusinessState } from "@/features/organization-application/model/actions";
import { organizationApplicationStatusLabels } from "@/entities/organization-application/model/types";
import { formatDateTime } from "@/shared/lib/date";
import { Badge } from "@/shared/ui/badge";
import { Button, LinkButton } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { SectionHeader } from "@/shared/ui/section-header";

function statusVariant(status: keyof typeof organizationApplicationStatusLabels) {
  if (status === "approved") {
    return "success";
  }

  if (status === "needs_changes") {
    return "warning";
  }

  if (status === "rejected") {
    return "error";
  }

  return "info";
}

type BusinessPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BusinessPage({ searchParams }: BusinessPageProps) {
  const params = (await searchParams) ?? {};
  const [state, organizations] = await Promise.all([
    getCurrentBusinessState(),
    getBusinessOrganizations()
  ]);

  if (!state) {
    return null;
  }

  const applicationNotice = firstSearchValue(params.application);
  const showSubmittedNotice = applicationNotice === "submitted"
    && state.applications.some((application) => application.status === "submitted");

  return (
    <div className="mx-auto max-w-form space-y-6">
      <SectionHeader
        as="h1"
        title="Мои организации"
        description="Все организации, роли и заявки на добавление организации."
        action={
          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="sm">
              Выйти
            </Button>
          </form>
        }
      />

      {showSubmittedNotice ? (
        <Card>
          <CardContent className="space-y-2">
            <Badge variant="success">Заявка отправлена</Badge>
            <p className="text-sm leading-6 text-foreground-muted">
              Заявка принята и находится на рассмотрении. Все изменения статуса появятся в списке ниже.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {!state.user.emailConfirmedAt ? (
        <Card>
          <CardContent className="space-y-2">
            <Badge variant="warning">Email не подтверждён</Badge>
            <p className="text-sm leading-6 text-foreground-muted">
              Откройте письмо Supabase и завершите подтверждение email.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {state.profile?.role === "admin" ? (
        <Card>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold">Администрирование</h2>
                <p className="text-sm leading-6 text-foreground-muted">
                  Проверка заявок организаций, публикаций и важных объявлений.
                </p>
              </div>
              <Badge variant="info">Админ</Badge>
            </div>
            <LinkButton href="/admin" variant="outline" size="sm">
              Открыть админ-панель
            </LinkButton>
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Организации с доступом</h2>
            <p className="text-sm leading-6 text-foreground-muted">
              Переключайтесь между кабинетами независимо от количества организаций.
            </p>
          </div>
          <LinkButton href="/business/application?new=1" size="sm">
            Добавить организацию
          </LinkButton>
        </div>

        {organizations.length ? (
          <div className="grid gap-3">
            {organizations.map((membership) => (
              <Card key={membership.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">{membership.organizations?.name ?? "Организация"}</p>
                    <p className="text-sm leading-6 text-foreground-muted">
                      Роль: {membership.role === "owner" ? "владелец" : "менеджер"}
                    </p>
                  </div>
                  <LinkButton href={`/business/${membership.organization_id}`} variant="outline" size="sm">
                    Открыть кабинет
                  </LinkButton>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Доступных организаций пока нет"
            description="Создайте заявку на добавление первой организации."
            actionLabel="Добавить организацию"
            actionHref="/business/application?new=1"
          />
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Заявки на добавление организации</h2>
          <p className="text-sm leading-6 text-foreground-muted">
            История всех заявок, комментарии администратора и связанные организации.
          </p>
        </div>

        {state.applications.length ? (
          <div className="grid gap-3">
            {state.applications.map((application) => (
              <Card key={application.id}>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">
                        {application.organization_name ?? "Новая организация"}
                      </h3>
                      <p className="text-sm leading-6 text-foreground-muted">
                        {application.submitted_at
                          ? `Подана: ${formatDateTime(application.submitted_at)}`
                          : `Создана: ${formatDateTime(application.created_at)}`}
                      </p>
                    </div>
                    <Badge variant={statusVariant(application.status)}>
                      {organizationApplicationStatusLabels[application.status]}
                    </Badge>
                  </div>

                  {application.admin_comment ? (
                    <div className="rounded-md bg-surface-muted p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                        Комментарий администратора
                      </p>
                      <p className="mt-1 text-sm leading-6">{application.admin_comment}</p>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-3">
                    <LinkButton
                      href={`/business/application?id=${application.id}`}
                      variant={application.status === "draft" || application.status === "needs_changes" ? "primary" : "outline"}
                      size="sm"
                    >
                      {application.status === "draft" || application.status === "needs_changes"
                        ? "Продолжить заявку"
                        : "Открыть заявку"}
                    </LinkButton>
                    {application.status === "approved" && application.organization_id ? (
                      <LinkButton
                        href={`/business/${application.organization_id}`}
                        variant="outline"
                        size="sm"
                      >
                        Перейти в кабинет
                      </LinkButton>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="rounded-md border border-border bg-surface p-4 text-sm text-foreground-muted">
            Заявок пока нет.
          </p>
        )}
      </section>
    </div>
  );
}
