"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "@/features/auth/model/actions";
import { initialAuthFormState } from "@/features/auth/model/types";
import { AuthMessage } from "@/features/auth/ui/auth-message";
import { FormField } from "@/shared/ui/form-field";
import { Input } from "@/shared/ui/input";
import { SubmitButton } from "@/shared/ui/submit-button";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [state, action] = useActionState(loginAction, initialAuthFormState);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={nextPath} />
      <FormField id="email" label="Email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </FormField>
      <FormField id="password" label="Пароль">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </FormField>
      <AuthMessage state={state} />
      <SubmitButton className="w-full" pendingLabel="Входим...">
        Войти
      </SubmitButton>
      <div className="flex flex-wrap justify-between gap-3 text-sm text-primary">
        <Link href="/forgot-password">Забыли пароль?</Link>
        <Link href={`/register?next=${encodeURIComponent(nextPath)}`}>Создать аккаунт</Link>
      </div>
    </form>
  );
}
