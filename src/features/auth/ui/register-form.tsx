"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerAction } from "@/features/auth/model/actions";
import { initialAuthFormState } from "@/features/auth/model/types";
import { AuthMessage } from "@/features/auth/ui/auth-message";
import { FormField } from "@/shared/ui/form-field";
import { Input } from "@/shared/ui/input";
import { SubmitButton } from "@/shared/ui/submit-button";

export function RegisterForm({ nextPath }: { nextPath: string }) {
  const [state, action] = useActionState(registerAction, initialAuthFormState);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={nextPath} />
      <FormField id="displayName" label="Имя представителя" hint="Можно будет уточнить позже.">
        <Input id="displayName" name="displayName" autoComplete="name" />
      </FormField>
      <FormField id="email" label="Email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </FormField>
      <FormField id="password" label="Пароль" hint="Не меньше 8 символов.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
      </FormField>
      <AuthMessage state={state} />
      <SubmitButton className="w-full" pendingLabel="Создаем аккаунт...">
        Зарегистрироваться
      </SubmitButton>
      <p className="text-sm leading-6 text-foreground-muted">
        Уже есть аккаунт?{" "}
        <Link className="text-primary" href={`/login?next=${encodeURIComponent(nextPath)}`}>
          Войти
        </Link>
      </p>
    </form>
  );
}
