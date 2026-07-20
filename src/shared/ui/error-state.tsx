import { Card, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";

type ErrorStateProps = {
  title?: string;
  description?: string;
  onRetry?: () => void;
};

export function ErrorState({
  title = "Не получилось загрузить данные",
  description = "Попробуйте обновить экран чуть позже.",
  onRetry
}: ErrorStateProps) {
  return (
    <Card>
      <CardContent className="space-y-3 text-center">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm leading-6 text-foreground-muted">{description}</p>
        {onRetry ? (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Повторить
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
