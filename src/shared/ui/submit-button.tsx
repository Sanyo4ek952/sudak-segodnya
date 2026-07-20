"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/shared/ui/button";
import type { ComponentProps, ReactNode } from "react";

type SubmitButtonProps = Omit<ComponentProps<typeof Button>, "type"> & {
  pendingLabel?: string;
  children: ReactNode;
};

export function SubmitButton({ pendingLabel = "Сохраняем...", children, ...props }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
