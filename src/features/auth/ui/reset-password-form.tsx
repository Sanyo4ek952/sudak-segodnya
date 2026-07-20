"use client";

import { useActionState } from "react";
import { updatePasswordAction } from "@/features/auth/model/actions";
import { initialAuthFormState } from "@/features/auth/model/types";
import { AuthMessage } from "@/features/auth/ui/auth-message";
import { FormField } from "@/shared/ui/form-field";
import { Input } from "@/shared/ui/input";
import { SubmitButton } from "@/shared/ui/submit-button";

export function ResetPasswordForm() {
  const [state, action] = useActionState(updatePasswordAction, initialAuthFormState);

  return (
    <form action={action} className="space-y-4">
      <FormField id="password" label="Новый пароль" hint="Не меньше 8 символов.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
      </FormField>
      <FormField id="passwordConfirm" label="Повторите пароль">
        <Input id="passwordConfirm" name="passwordConfirm" type="password" autoComplete="new-password" required />
      </FormField>
      <AuthMessage state={state} />
      <SubmitButton className="w-full" pendingLabel="Обновляем...">
        Обновить пароль
      </SubmitButton>
    </form>
  );
}
