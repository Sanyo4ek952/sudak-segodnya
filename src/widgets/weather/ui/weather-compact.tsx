import Link from "next/link";
import { Card, CardContent } from "@/shared/ui/card";

export function WeatherCompact() {
  return (
    <Link href="/weather" className="block">
      <Card>
        <CardContent className="flex items-center justify-between gap-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground-muted">Погода в Судаке</p>
            <p className="text-lg font-semibold">+28, ясно</p>
          </div>
          <div className="shrink-0 text-right text-sm text-foreground-muted">
            <p>+24 / +30</p>
            <p>подробнее</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
