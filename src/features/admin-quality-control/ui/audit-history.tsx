import type { Tables } from "@/shared/api/supabase/database.types";
import { formatDateTime } from "@/shared/lib/date";
import { Badge } from "@/shared/ui/badge";

const actionLabels: Record<string, string> = {
  "organization_applications.created": "Заявка создана",
  "organization_applications.status.submitted": "Заявка отправлена",
  "organization_applications.status.needs_changes": "Запрошены уточнения",
  "organization_applications.status.approved": "Заявка одобрена",
  "organization_applications.status.rejected": "Заявка отклонена",
  "organizations.status.blocked": "Организация заблокирована",
  "organizations.status.active": "Организация восстановлена",
  "organizations.restored": "Организация восстановлена",
  "organizations.type_change.approved": "Изменение типа подтверждено",
  "organizations.type_change.rejected": "Изменение типа отклонено",
  "publications.status.hidden": "Публикация скрыта",
  "publications.status.blocked": "Публикация заблокирована",
  "publications.status.published": "Публикация опубликована",
  "publications.restored": "Публикация восстановлена",
  "organization_members.role.owner": "Роль изменена на владельца",
  "organization_members.role.manager": "Роль изменена на менеджера",
  "organization_members.access.true": "Доступ представителя включён",
  "organization_members.access.false": "Доступ представителя отключён"
};

export function getAuditActionLabel(action: string) {
  return actionLabels[action] ?? action.replaceAll("_", " ");
}

export function AuditHistory({
  events,
  actorNames
}: {
  events: Tables<"audit_events">[];
  actorNames?: Map<string, string>;
}) {
  if (!events.length) {
    return <p className="text-sm text-foreground-muted">История действий пока пуста.</p>;
  }

  return (
    <ol className="space-y-3">
      {events.map((event) => (
        <li key={event.id} className="rounded-md border border-border bg-background p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="space-y-1">
              <p className="text-sm font-medium">{getAuditActionLabel(event.action)}</p>
              <p className="text-xs text-foreground-muted">
                {event.actor_id
                  ? actorNames?.get(event.actor_id) ?? "Администратор или представитель"
                  : "Системный процесс"}
              </p>
            </div>
            <Badge variant="muted">{formatDateTime(event.created_at)}</Badge>
          </div>
          {event.reason ? (
            <p className="mt-2 text-sm leading-6 text-foreground-muted">{event.reason}</p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

