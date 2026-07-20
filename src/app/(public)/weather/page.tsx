import Link from "next/link";
import { Card, CardContent } from "@/shared/ui/card";
import { SectionHeader } from "@/shared/ui/section-header";

export default function WeatherPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/" className="inline-flex min-h-10 items-center text-sm font-medium text-primary">
        Назад в ленту
      </Link>
      <SectionHeader title="Погода" description="Mock-прогноз для первого публичного прототипа." />
      <Card>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-foreground-muted">Сейчас в Судаке</p>
            <p className="text-4xl font-semibold">+28</p>
            <p className="text-base text-foreground-muted">Ясно, легкий ветер</p>
          </div>
          <dl className="grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-foreground-muted">Минимум</dt>
              <dd className="text-lg font-semibold">+24</dd>
            </div>
            <div>
              <dt className="text-sm text-foreground-muted">Максимум</dt>
              <dd className="text-lg font-semibold">+30</dd>
            </div>
            <div>
              <dt className="text-sm text-foreground-muted">Обновлено</dt>
              <dd className="text-lg font-semibold">09:00</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
