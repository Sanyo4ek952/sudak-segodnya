"use client";

import { useActionState, useState } from "react";
import {
  approveApplicationAction,
  rejectApplicationAction,
  requestChangesApplicationAction
} from "@/features/admin-application-review/model/actions";
import {
  type AdminActionState,
  initialAdminActionState
} from "@/features/admin-application-review/model/types";
import { AdminActionMessage } from "@/features/admin-application-review/ui/admin-action-message";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Dialog } from "@/shared/ui/dialog";
import { FormField } from "@/shared/ui/form-field";
import { SubmitButton } from "@/shared/ui/submit-button";
import { Textarea } from "@/shared/ui/textarea";

type ApplicationReviewActionsProps = {
  applicationId: string;
  status: "draft" | "submitted" | "needs_changes" | "approved" | "rejected";
};

export function ApplicationReviewActions({
  applicationId,
  status
}: ApplicationReviewActionsProps) {
  const [approveOpen, setApproveOpen] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const approveWithClose = async (state: AdminActionState, formData: FormData) => {
    const result = await approveApplicationAction(state, formData);

    if (result.status === "success") {
      setApproveOpen(false);
    }

    return result;
  };
  const requestChangesWithClose = async (state: AdminActionState, formData: FormData) => {
    const result = await requestChangesApplicationAction(state, formData);

    if (result.status === "success") {
      setChangesOpen(false);
    }

    return result;
  };
  const rejectWithClose = async (state: AdminActionState, formData: FormData) => {
    const result = await rejectApplicationAction(state, formData);

    if (result.status === "success") {
      setRejectOpen(false);
    }

    return result;
  };
  const [approveState, approveAction] = useActionState(
    approveWithClose,
    initialAdminActionState
  );
  const [changesState, changesAction] = useActionState(
    requestChangesWithClose,
    initialAdminActionState
  );
  const [rejectState, rejectAction] = useActionState(
    rejectWithClose,
    initialAdminActionState
  );

  if (status !== "submitted" && status !== "needs_changes") {
    return (
      <Card>
        <CardContent>
          <p className="text-sm leading-6 text-foreground-muted">
            Заявка уже обработана. Повторные действия недоступны.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {status === "submitted" ? (
        <Card>
          <CardContent className="space-y-3">
            <h2 className="text-lg font-semibold">Одобрение</h2>
            <p className="text-sm leading-6 text-foreground-muted">
              Будет создана активная организация и членство заявителя с ролью владельца.
            </p>
            <Button type="button" className="w-full sm:w-auto" onClick={() => setApproveOpen(true)}>
              Одобрить
            </Button>
            <AdminActionMessage state={approveState} />
          </CardContent>
        </Card>
      ) : null}

      {status === "submitted" ? (
        <Card>
          <CardContent className="space-y-3">
            <h2 className="text-lg font-semibold">Запросить уточнение</h2>
            <p className="text-sm leading-6 text-foreground-muted">
              Комментарий будет виден заявителю в кабинете бизнеса.
            </p>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setChangesOpen(true)}
            >
              Запросить уточнение
            </Button>
            <AdminActionMessage state={changesState} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="space-y-3">
          <h2 className="text-lg font-semibold">Отклонение</h2>
          <p className="text-sm leading-6 text-foreground-muted">
            Организация и членство не будут созданы. Причина будет доступна заявителю.
          </p>
          <Button
            type="button"
            variant="destructive"
            className="w-full sm:w-auto"
            onClick={() => setRejectOpen(true)}
          >
            Отклонить
          </Button>
          <AdminActionMessage state={rejectState} />
        </CardContent>
      </Card>

      <Dialog
        open={approveOpen}
        title="Одобрить заявку?"
        description="Будет создана активная организация, а заявитель станет владельцем."
        onOpenChange={setApproveOpen}
      >
        <form action={approveAction} className="space-y-4">
          <input type="hidden" name="applicationId" value={applicationId} />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setApproveOpen(false)}>
              Отмена
            </Button>
            <SubmitButton pendingLabel="Одобряем...">Одобрить</SubmitButton>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={changesOpen}
        title="Запросить уточнение?"
        description="Заявка вернется пользователю с вашим комментарием."
        onOpenChange={setChangesOpen}
      >
        <form action={changesAction} className="space-y-4">
          <input type="hidden" name="applicationId" value={applicationId} />
          <FormField id="changesAdminComment" label="Комментарий администратора">
            <Textarea id="changesAdminComment" name="adminComment" required />
          </FormField>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setChangesOpen(false)}>
              Отмена
            </Button>
            <SubmitButton pendingLabel="Сохраняем...">Запросить уточнение</SubmitButton>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={rejectOpen}
        title="Отклонить заявку?"
        description="Это финальное действие: организация не будет создана."
        onOpenChange={setRejectOpen}
      >
        <form action={rejectAction} className="space-y-4">
          <input type="hidden" name="applicationId" value={applicationId} />
          <FormField id="rejectAdminComment" label="Причина отклонения">
            <Textarea id="rejectAdminComment" name="adminComment" required />
          </FormField>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setRejectOpen(false)}>
              Отмена
            </Button>
            <SubmitButton variant="destructive" pendingLabel="Отклоняем...">
              Отклонить
            </SubmitButton>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
