import { logoutAction } from "@/features/auth/model/actions";
import { getBusinessOrganizations } from "@/features/business-cabinet/model/actions";
import { getCurrentBusinessState } from "@/features/organization-application/model/actions";
import { organizationApplicationStatusLabels } from "@/entities/organization-application/model/types";
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

export default async function BusinessPage() {
  const [state, organizations] = await Promise.all([
    getCurrentBusinessState(),
    getBusinessOrganizations()
  ]);

  if (!state) {
    return null;
  }

  const hasMemberships = organizations.length > 0;
  const application = state.application;

  return (
    <div className="mx-auto max-w-form space-y-6">
      <SectionHeader
        as="h1"
        title="Для бизнеса"
        description="Статус аккаунта представителя и заявки организации."
        action={
          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="sm">
              Выйти
            </Button>
          </form>
        }
      />

      {!state.user.emailConfirmedAt ? (
        <Card>
          <CardContent className="space-y-2">
            <Badge variant="warning">Email не подтвержден</Badge>
            <p className="text-sm leading-6 text-foreground-muted">
              Если подтверждение email включено в Supabase, откройте письмо и завершите подтверждение.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {hasMemberships ? (
        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Ваши организации</h2>
              <Badge variant="success">Доступ открыт</Badge>
            </div>
            <div className="grid gap-3">
              {organizations.map((membership) => (
                <div key={membership.id} className="rounded-md border border-border bg-background p-3">
                  <p className="font-medium">{membership.organizations?.name ?? "Организация"}</p>
                  <p className="text-sm leading-6 text-foreground-muted">
                    Роль: {membership.role === "owner" ? "владелец" : "менеджер"}
                  </p>
                  <LinkButton
                    href={`/business/${membership.organization_id}`}
                    variant="outline"
                    size="sm"
                    className="mt-3"
                  >
                    Открыть кабинет
                  </LinkButton>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : application ? (
        <Card>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{application.organization_name ?? "Заявка организации"}</h2>
              <Badge variant={statusVariant(application.status)}>
                {organizationApplicationStatusLabels[application.status]}
              </Badge>
            </div>
            <p className="text-sm leading-6 text-foreground-muted">
              {application.status === "submitted"
                ? "Заявка на рассмотрении. Когда администратор примет решение, статус обновится здесь."
                : application.status === "needs_changes"
                  ? "Администратор запросил уточнение. Отредактируйте заявку и отправьте ее повторно."
                  : application.status === "rejected"
                    ? "Заявка отклонена. Данные остаются в истории."
                    : application.status === "approved"
                      ? "Заявка одобрена. Организация создана, доступ владельца открыт."
                      : "Черновик можно дополнить и отправить на рассмотрение."}
            </p>
            {application.admin_comment ? (
              <p className="rounded-md bg-surface-muted p-3 text-sm leading-6 text-foreground">
                {application.admin_comment}
              </p>
            ) : null}
            {application.status === "draft" || application.status === "needs_changes" ? (
              <LinkButton href="/business/application" variant="primary">
                Продолжить заявку
              </LinkButton>
            ) : (
              <LinkButton href="/business/application" variant="outline">
                Открыть заявку
              </LinkButton>
            )}
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="Заявка еще не подавалась"
          description="Заполните данные организации, чтобы администратор мог проверить связь с ней."
          actionLabel="Создать заявку"
          actionHref="/business/application"
        />
      )}
    </div>
  );
}
