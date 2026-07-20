import { Card, CardContent } from "@/shared/ui/card";
import { LinkButton } from "@/shared/ui/button";

type EmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
};

export function EmptyState({ title, description, actionLabel, actionHref }: EmptyStateProps) {
  return (
    <Card>
      <CardContent className="space-y-3 text-center">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mx-auto max-w-form text-sm leading-6 text-foreground-muted">{description}</p>
        {actionLabel && actionHref ? (
          <LinkButton href={actionHref} variant="outline" size="sm">
            {actionLabel}
          </LinkButton>
        ) : null}
      </CardContent>
    </Card>
  );
}
