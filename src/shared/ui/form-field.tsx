import type { ReactNode } from "react";

type FormFieldProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
};

export function FormField({ id, label, hint, error, children }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-sm leading-5 text-error">{error}</p>
      ) : hint ? (
        <p className="text-sm leading-5 text-foreground-muted">{hint}</p>
      ) : null}
    </div>
  );
}
