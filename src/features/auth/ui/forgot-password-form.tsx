"use client";

import { useActionState } from "react";
import { requestPasswordResetAction } from "@/features/auth/model/actions";
import { initialAuthFormState } from "@/features/auth/model/types";
import { AuthMessage } from "@/features/auth/ui/auth-message";
import { FormField } from "@/shared/ui/form-field";
import { Input } from "@/shared/ui/input";
import { SubmitButton } from "@/shared/ui/submit-button";

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordResetAction, initialAuthFormState);

  return (
    <form action={action} className="space-y-4">
      <FormField id="email" label="Email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </FormField>
      <AuthMessage state={state} />
      <SubmitButton className="w-full" pendingLabel="Отправляем...">
        Отправить ссылку
      </SubmitButton>
    </form>
  );
}
