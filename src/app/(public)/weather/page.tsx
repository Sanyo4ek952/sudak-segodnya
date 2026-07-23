import Link from "next/link";
import { getSudakWeather, YANDEX_SUDAK_WEATHER_URL } from "@/entities/weather/api/open-meteo";
import type { WeatherDay, WeatherHour } from "@/entities/weather/model/types";
import { Badge } from "@/shared/ui/badge";
import { LinkButton } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { SectionHeader } from "@/shared/ui/section-header";
import { createPageMetadata } from "@/shared/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "Погода в Судаке | Судак Сегодня",
  description: "Актуальная погода в Судаке: температура, осадки, ветер, почасовой и семидневный прогноз.",
  path: "/weather"
});

function signedTemperature(value: number) {
  return `${value > 0 ? "+" : ""}${value}`;
}

function formatHour(value: string) {
  return value.slice(11, 16);
}

function formatDay(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "short"
  }).format(date);
}

function formatUpdatedAt(value: string) {
  const [date, time] = value.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":");
  const displayDate = new Date(Date.UTC(year, month - 1, day));
  const formattedDate = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long"
  }).format(displayDate);

  return `${formattedDate}, ${hour}:${minute}`;
}

function rainText(precipitation: number, probability?: number | null) {
  if (precipitation > 0) {
    return `${precipitation.toFixed(1)} мм осадков`;
  }

  if (probability !== null && probability !== undefined) {
    return `вероятность ${probability}%`;
  }

  return "без заметных осадков";
}

function HourCard({ hour }: { hour: WeatherHour }) {
  return (
    <li className="min-w-24 rounded-md border border-border bg-surface-muted px-3 py-3 text-center">
      <p className="text-xs font-medium text-foreground-muted">{formatHour(hour.time)}</p>
      <p className="mt-2 text-xl font-semibold">
        {hour.condition.icon} {signedTemperature(hour.temperature)}
      </p>
      <p className="mt-1 text-xs leading-5 text-foreground-muted">{rainText(hour.precipitation, hour.precipitationProbability)}</p>
    </li>
  );
}

function DayRow({ day }: { day: WeatherDay }) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="font-medium capitalize">{formatDay(day.date)}</p>
        <p className="truncate text-sm text-foreground-muted">
          {day.condition.icon} {day.condition.label}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-semibold">
          {signedTemperature(day.temperatureMin)} / {signedTemperature(day.temperatureMax)}
        </p>
        <p className="text-xs text-foreground-muted">{rainText(day.precipitationSum, day.precipitationProbabilityMax)}</p>
      </div>
    </li>
  );
}

export default async function WeatherPage() {
  const { forecast, error } = await getSudakWeather();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/" className="inline-flex min-h-10 items-center text-sm font-medium text-primary">
        Назад в ленту
      </Link>

      <SectionHeader
        as="h1"
        title="Погода"
        description="Актуальный прогноз для Судака. Данные обновляются примерно раз в 30 минут."
      />
      <LinkButton
        href={forecast?.yandexUrl ?? YANDEX_SUDAK_WEATHER_URL}
        target="_blank"
        rel="noreferrer"
        variant="primary"
        size="sm"
        className="w-full justify-center whitespace-nowrap !rounded-full border border-[#c8c8c8] bg-white font-semibold text-black shadow-[0_6px_18px_rgba(0,0,0,0.14)] hover:bg-white hover:opacity-100 sm:w-auto"
      >
        <span className="inline-flex size-5 items-center justify-center rounded-md border border-[#e5e5e5] bg-white text-sm font-bold text-[#fc3f1d] shadow-[0_2px_6px_rgba(0,0,0,0.12)]">
          Я
        </span>
        Погода на Яндексе
      </LinkButton>

      {forecast ? (
        <>
          <Card>
            <CardContent className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-foreground-muted">Сейчас в Судаке</p>
                  <p className="mt-1 text-4xl font-semibold">
                    {forecast.now.condition.icon} {signedTemperature(forecast.now.temperature)}
                  </p>
                  <p className="text-base text-foreground-muted">
                    {forecast.now.condition.label}, ощущается как {signedTemperature(forecast.now.apparentTemperature)}
                  </p>
                </div>
                <Badge variant="info">Open-Meteo</Badge>
              </div>
              <dl className="grid gap-3 sm:grid-cols-3">
                <div>
                  <dt className="text-sm text-foreground-muted">Ветер</dt>
                  <dd className="text-lg font-semibold">{forecast.now.windSpeed} км/ч</dd>
                </div>
                <div>
                  <dt className="text-sm text-foreground-muted">Порывы</dt>
                  <dd className="text-lg font-semibold">{forecast.now.windGusts} км/ч</dd>
                </div>
                <div>
                  <dt className="text-sm text-foreground-muted">Обновлено</dt>
                  <dd className="text-lg font-semibold">{formatUpdatedAt(forecast.now.updatedAt)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2">
              <p className="text-sm font-medium text-foreground-muted">Дождь и осадки</p>
              <p className="text-2xl font-semibold">{rainText(forecast.now.precipitation, forecast.hours[0]?.precipitationProbability)}</p>
              <p className="text-sm leading-6 text-foreground-muted">
                Дождь: {forecast.now.rain.toFixed(1)} мм, ливни: {forecast.now.showers.toFixed(1)} мм.
              </p>
            </CardContent>
          </Card>

          <section className="space-y-3">
            <SectionHeader title="Ближайшие часы" />
            <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0">
              {forecast.hours.map((hour) => (
                <HourCard key={hour.time} hour={hour} />
              ))}
            </ul>
          </section>

          <section className="space-y-3">
            <SectionHeader title="На 7 дней" />
            <Card>
              <CardContent className="py-1">
                <ul>
                  {forecast.days.map((day) => (
                    <DayRow key={day.date} day={day} />
                  ))}
                </ul>
              </CardContent>
            </Card>
          </section>
        </>
      ) : (
        <Card>
          <CardContent className="space-y-4">
            <div>
              <p className="text-lg font-semibold">{error}</p>
              <p className="mt-2 text-sm leading-6 text-foreground-muted">
                Мы не показываем mock-значения, чтобы не вводить в заблуждение. Подробный прогноз можно открыть в Яндекс Погоде.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
