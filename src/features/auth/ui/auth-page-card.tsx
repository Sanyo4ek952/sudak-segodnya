import type { ReactNode } from "react";
import { Card, CardContent } from "@/shared/ui/card";

type AuthPageCardProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function AuthPageCard({ title, description, children }: AuthPageCardProps) {
  return (
    <div className="mx-auto max-w-form py-6">
      <Card>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold leading-tight text-foreground">{title}</h1>
            <p className="text-sm leading-6 text-foreground-muted">{description}</p>
          </div>
          {children}
        </CardContent>
      </Card>
    </div>
  );
}
