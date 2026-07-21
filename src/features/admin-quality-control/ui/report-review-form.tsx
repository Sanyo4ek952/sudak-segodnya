"use client";

import { useActionState } from "react";
import { changeAdminReportStatusAction } from "@/features/admin-quality-control/model/actions";
import { initialAdminActionState } from "@/features/admin-quality-control/model/types";
import { AdminActionMessage } from "@/features/admin-quality-control/ui/admin-action-message";
import { FormField } from "@/shared/ui/form-field";
import { Select } from "@/shared/ui/select";
import { SubmitButton } from "@/shared/ui/submit-button";
import { Textarea } from "@/shared/ui/textarea";

type ReportReviewFormProps = {
  reportId: string;
};

export function ReportReviewForm({ reportId }: ReportReviewFormProps) {
  const [state, action] = useActionState(changeAdminReportStatusAction, initialAdminActionState);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="reportId" value={reportId} />
      <FormField id={`reportStatus-${reportId}`} label="Статус обработки">
        <Select id={`reportStatus-${reportId}`} name="status" defaultValue="reviewing">
          <option value="reviewing">В работе</option>
          <option value="resolved">Решено</option>
          <option value="rejected">Отклонено</option>
        </Select>
      </FormField>
      <FormField id={`reportComment-${reportId}`} label="Комментарий администратора">
        <Textarea id={`reportComment-${reportId}`} name="adminComment" maxLength={1000} />
      </FormField>
      <SubmitButton size="sm" pendingLabel="Сохраняем...">Обновить</SubmitButton>
      <AdminActionMessage state={state} />
    </form>
  );
}
