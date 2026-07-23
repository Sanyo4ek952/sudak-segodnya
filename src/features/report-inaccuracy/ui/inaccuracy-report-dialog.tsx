"use client";

import { useActionState, useState } from "react";
import { submitInaccuracyReportAction } from "@/features/report-inaccuracy/model/actions";
import {
  inaccuracyReasonOptions,
  initialInaccuracyReportState
} from "@/features/report-inaccuracy/model/types";
import { Button } from "@/shared/ui/button";
import { Dialog } from "@/shared/ui/dialog";
import { FormField } from "@/shared/ui/form-field";
import { Select } from "@/shared/ui/select";
import { SubmitButton } from "@/shared/ui/submit-button";
import { Textarea } from "@/shared/ui/textarea";

type InaccuracyReportDialogProps = {
  publicationId: string;
};

export function InaccuracyReportDialog({ publicationId }: InaccuracyReportDialogProps) {
  const [open, setOpen] = useState(false);
  const submitWithClose = async (
    state: typeof initialInaccuracyReportState,
    formData: FormData
  ) => {
    const result = await submitInaccuracyReportAction(state, formData);

    if (result.status === "success") {
      setOpen(false);
    }

    return result;
  };
  const [state, action] = useActionState(submitWithClose, initialInaccuracyReportState);

  return (
    <>
      <Button type="button" variant="ghost" className="w-full justify-start px-0" onClick={() => setOpen(true)}>
        Сообщить о неточности
      </Button>
      {state.message ? (
        <p className={state.status === "error" ? "mt-2 text-sm text-error" : "mt-2 text-sm text-success"}>
          {state.message}
        </p>
      ) : null}

      <Dialog
        open={open}
        title="Сообщить о неточности"
        description="Выберите причину и при необходимости добавьте короткий комментарий."
        onOpenChange={setOpen}
      >
        <form action={action} className="space-y-4">
          <input type="hidden" name="publicationId" value={publicationId} />
          <FormField id="inaccuracyReason" label="Причина">
            <Select id="inaccuracyReason" name="reason" required defaultValue={inaccuracyReasonOptions[0].value}>
              {inaccuracyReasonOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="inaccuracyComment" label="Комментарий">
            <Textarea
              id="inaccuracyComment"
              name="comment"
              maxLength={1000}
              placeholder="Например: мероприятие перенесли на другой день."
            />
          </FormField>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <SubmitButton pendingLabel="Отправляем...">Отправить</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}
