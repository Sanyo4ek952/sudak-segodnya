"use client";

import { useActionState } from "react";
import {
  inviteOrganizationRepresentativeAction,
  manageOrganizationRepresentativeAction,
  revokeOrganizationInvitationAction,
  transferOrganizationOwnershipAction
} from "@/features/business-cabinet/model/actions";
import {
  initialBusinessActionState,
  type OrganizationInvitation,
  type OrganizationRepresentative
} from "@/features/business-cabinet/model/types";
import { BusinessActionMessage } from "@/features/business-cabinet/ui/business-action-message";
import { formatDateTime } from "@/shared/lib/date";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { FormField } from "@/shared/ui/form-field";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { SubmitButton } from "@/shared/ui/submit-button";

type RepresentativeManagementProps = {
  organizationId: string;
  currentUserId: string;
  currentRole: "owner" | "manager";
  representatives: OrganizationRepresentative[];
  invitations: OrganizationInvitation[];
};

export function RepresentativeManagement({
  organizationId,
  currentUserId,
  currentRole,
  representatives,
  invitations
}: RepresentativeManagementProps) {
  const [state, inviteAction] = useActionState(
    inviteOrganizationRepresentativeAction,
    initialBusinessActionState
  );
  const isOwner = currentRole === "owner";

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Представители</h2>
          <p className="text-sm leading-6 text-foreground-muted">
            Owner управляет доступами. Manager работает с профилем, публикациями, меню и статистикой.
          </p>
        </div>
        <div className="grid gap-3">
          {representatives.map((representative) => (
            <div key={representative.member_id} className="rounded-md border border-border bg-background p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {representative.display_name || representative.email || "Представитель"}
                  </p>
                  {representative.email ? (
                    <p className="truncate text-sm text-foreground-muted">{representative.email}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-foreground-muted">
                    Добавлен: {formatDateTime(representative.added_at)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={representative.role === "owner" ? "success" : "info"}>
                    {representative.role === "owner" ? "Owner" : "Manager"}
                  </Badge>
                  <Badge variant={representative.is_active ? "success" : "muted"}>
                    {representative.is_active ? "Активен" : "Отключён"}
                  </Badge>
                </div>
              </div>

              {isOwner ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <form action={manageOrganizationRepresentativeAction}>
                    <input type="hidden" name="organizationId" value={organizationId} />
                    <input type="hidden" name="memberId" value={representative.member_id} />
                    <input type="hidden" name="action" value="change_role" />
                    <input
                      type="hidden"
                      name="role"
                      value={representative.role === "owner" ? "manager" : "owner"}
                    />
                    <Button type="submit" variant="outline" size="sm">
                      {representative.role === "owner" ? "Сделать manager" : "Сделать owner"}
                    </Button>
                  </form>
                  <form
                    action={manageOrganizationRepresentativeAction}
                    onSubmit={(event) => {
                      if (
                        representative.is_active
                        && !window.confirm("Отключить доступ этого представителя?")
                      ) {
                        event.preventDefault();
                      }
                    }}
                  >
                    <input type="hidden" name="organizationId" value={organizationId} />
                    <input type="hidden" name="memberId" value={representative.member_id} />
                    <input
                      type="hidden"
                      name="action"
                      value={representative.is_active ? "deactivate" : "activate"}
                    />
                    <Button
                      type="submit"
                      variant={representative.is_active ? "destructive" : "outline"}
                      size="sm"
                    >
                      {representative.is_active ? "Отключить" : "Включить"}
                    </Button>
                  </form>
                  {representative.user_id !== currentUserId && representative.is_active ? (
                    <form
                      action={transferOrganizationOwnershipAction}
                      onSubmit={(event) => {
                        if (
                          !window.confirm(
                            "Передать владение этому представителю? Ваша роль станет manager."
                          )
                        ) {
                          event.preventDefault();
                        }
                      }}
                    >
                      <input type="hidden" name="organizationId" value={organizationId} />
                      <input type="hidden" name="memberId" value={representative.member_id} />
                      <Button type="submit" variant="destructive" size="sm">
                        Передать владение
                      </Button>
                    </form>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {isOwner ? (
        <section className="space-y-4 border-t border-border pt-5">
          <div>
            <h2 className="text-lg font-semibold">Пригласить представителя</h2>
            <p className="text-sm leading-6 text-foreground-muted">
              Ссылка действует 7 дней и принимается только аккаунтом с указанным email.
            </p>
          </div>
          <form action={inviteAction} className="grid gap-4 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
            <input type="hidden" name="organizationId" value={organizationId} />
            <FormField id="representativeEmail" label="Email">
              <Input id="representativeEmail" name="email" type="email" required />
            </FormField>
            <FormField id="representativeRole" label="Роль">
              <Select id="representativeRole" name="role" defaultValue="manager">
                <option value="manager">Manager</option>
                <option value="owner">Owner</option>
              </Select>
            </FormField>
            <SubmitButton pendingLabel="Создаём...">Пригласить</SubmitButton>
          </form>
          <BusinessActionMessage state={state} />
          {state.invitationUrl ? (
            <FormField id="invitationUrl" label="Ссылка-приглашение">
              <Input
                id="invitationUrl"
                readOnly
                value={state.invitationUrl}
                onFocus={(event) => event.currentTarget.select()}
              />
            </FormField>
          ) : null}

          {invitations.length ? (
            <div className="space-y-3">
              <h3 className="font-semibold">Ожидают принятия</h3>
              {invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"
                >
                  <div>
                    <p className="font-medium">{invitation.email}</p>
                    <p className="text-xs text-foreground-muted">
                      {invitation.role} · до {formatDateTime(invitation.expires_at)}
                    </p>
                  </div>
                  <form
                    action={revokeOrganizationInvitationAction}
                    onSubmit={(event) => {
                      if (!window.confirm("Отозвать приглашение?")) {
                        event.preventDefault();
                      }
                    }}
                  >
                    <input type="hidden" name="organizationId" value={organizationId} />
                    <input type="hidden" name="invitationId" value={invitation.id} />
                    <Button type="submit" variant="ghost" size="sm">Отозвать</Button>
                  </form>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
