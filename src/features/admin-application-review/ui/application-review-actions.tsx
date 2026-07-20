"use client";

import { useActionState } from "react";
import {
  approveApplicationAction,
  rejectApplicationAction,
  requestChangesApplicationAction
} from "@/features/admin-application-review/model/actions";
import { initialAdminActionState } from "@/features/admin-application-review/model/types";
import { AdminActionMessage } from "@/features/admin-application-review/ui/admin-action-message";
import { Card, CardContent } from "@/shared/ui/card";
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
  const [approveState, approveAction] = useActionState(
    approveApplicationAction,
    initialAdminActionState
  );
  const [changesState, changesAction] = useActionState(
    requestChangesApplicationAction,
    initialAdminActionState
  );
  const [rejectState, rejectAction] = useActionState(
    rejectApplicationAction,
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
            <form
              action={approveAction}
              onSubmit={(event) => {
                if (!window.confirm("Одобрить заявку и создать организацию?")) {
                  event.preventDefault();
                }
              }}
            >
              <input type="hidden" name="applicationId" value={applicationId} />
              <SubmitButton pendingLabel="Одобряем...">Одобрить</SubmitButton>
            </form>
            <AdminActionMessage state={approveState} />
          </CardContent>
        </Card>
      ) : null}

      {status === "submitted" ? (
        <Card>
          <CardContent className="space-y-3">
            <h2 className="text-lg font-semibold">Запросить уточнение</h2>
            <form
              action={changesAction}
              className="space-y-3"
              onSubmit={(event) => {
                if (!window.confirm("Отправить комментарий и вернуть заявку на уточнение?")) {
                  event.preventDefault();
                }
              }}
            >
              <input type="hidden" name="applicationId" value={applicationId} />
              <FormField id="changesAdminComment" label="Комментарий администратора">
                <Textarea id="changesAdminComment" name="adminComment" required />
              </FormField>
              <SubmitButton variant="outline" pendingLabel="Сохраняем...">
                Запросить уточнение
              </SubmitButton>
            </form>
            <AdminActionMessage state={changesState} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="space-y-3">
          <h2 className="text-lg font-semibold">Отклонение</h2>
          <form
            action={rejectAction}
            className="space-y-3"
            onSubmit={(event) => {
              if (!window.confirm("Отклонить заявку? Организация не будет создана.")) {
                event.preventDefault();
              }
            }}
          >
            <input type="hidden" name="applicationId" value={applicationId} />
            <FormField id="rejectAdminComment" label="Причина отклонения">
              <Textarea id="rejectAdminComment" name="adminComment" required />
            </FormField>
            <SubmitButton variant="destructive" pendingLabel="Отклоняем...">
              Отклонить
            </SubmitButton>
          </form>
          <AdminActionMessage state={rejectState} />
        </CardContent>
      </Card>
    </div>
  );
}
