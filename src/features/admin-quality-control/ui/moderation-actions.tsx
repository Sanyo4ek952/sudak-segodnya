"use client";

import { useActionState, useState } from "react";
import {
  changeAdminOrganizationStatusAction,
  changeAdminPublicationStatusAction,
  reviewOrganizationTypeChangeAction
} from "@/features/admin-quality-control/model/actions";
import {
  initialAdminActionState,
  type AdminActionState
} from "@/features/admin-quality-control/model/types";
import { AdminActionMessage } from "@/features/admin-quality-control/ui/admin-action-message";
import { Button } from "@/shared/ui/button";
import { Dialog } from "@/shared/ui/dialog";
import { FormField } from "@/shared/ui/form-field";
import { SubmitButton } from "@/shared/ui/submit-button";
import { Textarea } from "@/shared/ui/textarea";

type PublicationModerationStatus = "published" | "hidden" | "blocked";
type OrganizationModerationStatus = "active" | "blocked";

function actionLabel(status: PublicationModerationStatus | OrganizationModerationStatus) {
  if (status === "hidden") return "Скрыть";
  if (status === "blocked") return "Блокировать";
  return "Восстановить";
}

function actionDescription(status: PublicationModerationStatus | OrganizationModerationStatus) {
  if (status === "hidden") {
    return "Публикация исчезнет из публичной ленты, но данные сохранятся.";
  }

  if (status === "blocked") {
    return "Доступ к публичному контенту будет заблокирован. Укажите проверяемую причину.";
  }

  return "Публичный доступ будет восстановлен. Зафиксируйте основание решения.";
}

function actionVariant(status: PublicationModerationStatus | OrganizationModerationStatus) {
  if (status === "blocked") return "destructive" as const;
  if (status === "hidden") return "outline" as const;
  return "primary" as const;
}

export function PublicationModerationActions({
  publicationId,
  status
}: {
  publicationId: string;
  status: string;
}) {
  const [nextStatus, setNextStatus] = useState<PublicationModerationStatus | null>(null);
  const actionWithClose = async (state: AdminActionState, formData: FormData) => {
    const result = await changeAdminPublicationStatusAction(state, formData);

    if (result.status === "success") {
      setNextStatus(null);
    }

    return result;
  };
  const [state, action] = useActionState(actionWithClose, initialAdminActionState);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {status !== "hidden" ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setNextStatus("hidden")}>
            Скрыть
          </Button>
        ) : null}
        {status !== "blocked" ? (
          <Button type="button" variant="destructive" size="sm" onClick={() => setNextStatus("blocked")}>
            Блокировать
          </Button>
        ) : null}
        {status === "hidden" || status === "blocked" ? (
          <Button type="button" size="sm" onClick={() => setNextStatus("published")}>
            Восстановить
          </Button>
        ) : null}
      </div>
      <AdminActionMessage state={state} />
      <Dialog
        open={nextStatus !== null}
        title={nextStatus ? `${actionLabel(nextStatus)} публикацию?` : "Изменить публикацию?"}
        description={nextStatus ? actionDescription(nextStatus) : ""}
        onOpenChange={(open) => {
          if (!open) setNextStatus(null);
        }}
      >
        {nextStatus ? (
          <form action={action} className="space-y-4">
            <input type="hidden" name="publicationId" value={publicationId} />
            <input type="hidden" name="status" value={nextStatus} />
            <FormField id={`publication-reason-${publicationId}`} label="Причина действия">
              <Textarea
                id={`publication-reason-${publicationId}`}
                name="comment"
                required
                minLength={3}
                maxLength={1000}
              />
            </FormField>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setNextStatus(null)}>
                Отмена
              </Button>
              <SubmitButton
                variant={actionVariant(nextStatus)}
                pendingLabel="Сохраняем..."
              >
                {actionLabel(nextStatus)}
              </SubmitButton>
            </div>
          </form>
        ) : null}
      </Dialog>
    </div>
  );
}

export function OrganizationModerationActions({
  organizationId,
  status
}: {
  organizationId: string;
  status: string;
}) {
  const [nextStatus, setNextStatus] = useState<OrganizationModerationStatus | null>(null);
  const actionWithClose = async (state: AdminActionState, formData: FormData) => {
    const result = await changeAdminOrganizationStatusAction(state, formData);

    if (result.status === "success") {
      setNextStatus(null);
    }

    return result;
  };
  const [state, action] = useActionState(actionWithClose, initialAdminActionState);
  const availableStatus: OrganizationModerationStatus = status === "blocked" ? "active" : "blocked";

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant={actionVariant(availableStatus)}
        size="sm"
        onClick={() => setNextStatus(availableStatus)}
      >
        {actionLabel(availableStatus)}
      </Button>
      <AdminActionMessage state={state} />
      <Dialog
        open={nextStatus !== null}
        title={nextStatus ? `${actionLabel(nextStatus)} организацию?` : "Изменить организацию?"}
        description={nextStatus ? actionDescription(nextStatus) : ""}
        onOpenChange={(open) => {
          if (!open) setNextStatus(null);
        }}
      >
        {nextStatus ? (
          <form action={action} className="space-y-4">
            <input type="hidden" name="organizationId" value={organizationId} />
            <input type="hidden" name="status" value={nextStatus} />
            <FormField id={`organization-reason-${organizationId}`} label="Причина действия">
              <Textarea
                id={`organization-reason-${organizationId}`}
                name="comment"
                required
                minLength={3}
                maxLength={1000}
              />
            </FormField>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setNextStatus(null)}>
                Отмена
              </Button>
              <SubmitButton
                variant={actionVariant(nextStatus)}
                pendingLabel="Сохраняем..."
              >
                {actionLabel(nextStatus)}
              </SubmitButton>
            </div>
          </form>
        ) : null}
      </Dialog>
    </div>
  );
}

export function OrganizationTypeReviewActions({
  organizationId,
  currentType,
  pendingType
}: {
  organizationId: string;
  currentType: string;
  pendingType: string;
}) {
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const actionWithClose = async (state: AdminActionState, formData: FormData) => {
    const result = await reviewOrganizationTypeChangeAction(state, formData);

    if (result.status === "success") {
      setDecision(null);
    }

    return result;
  };
  const [state, action] = useActionState(actionWithClose, initialAdminActionState);

  return (
    <div className="space-y-3 rounded-md border border-warning/40 bg-warning/10 p-3">
      <p className="text-sm font-medium">Запрошено изменение типа</p>
      <p className="text-sm text-foreground-muted">
        {currentType} → {pendingType}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => setDecision("approve")}>
          Подтвердить
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setDecision("reject")}>
          Отклонить
        </Button>
      </div>
      <AdminActionMessage state={state} />
      <Dialog
        open={decision !== null}
        title={decision === "approve" ? "Подтвердить новый тип?" : "Отклонить изменение типа?"}
        description="Решение и комментарий сохранятся в истории организации."
        onOpenChange={(open) => {
          if (!open) setDecision(null);
        }}
      >
        {decision ? (
          <form action={action} className="space-y-4">
            <input type="hidden" name="organizationId" value={organizationId} />
            <input type="hidden" name="approve" value={decision === "approve" ? "true" : "false"} />
            <FormField id={`type-review-reason-${organizationId}`} label="Комментарий">
              <Textarea
                id={`type-review-reason-${organizationId}`}
                name="reason"
                required
                minLength={3}
                maxLength={1000}
              />
            </FormField>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setDecision(null)}>
                Отмена
              </Button>
              <SubmitButton
                variant={decision === "approve" ? "primary" : "destructive"}
                pendingLabel="Сохраняем..."
              >
                {decision === "approve" ? "Подтвердить" : "Отклонить"}
              </SubmitButton>
            </div>
          </form>
        ) : null}
      </Dialog>
    </div>
  );
}

