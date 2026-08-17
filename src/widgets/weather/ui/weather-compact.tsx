import Link from "next/link";
import { getSudakWeather } from "@/entities/weather/api/open-meteo";
import { Card, CardContent } from "@/shared/ui/card";

function formatRainLine(precipitation: number, probability: number | null) {
  if (precipitation > 0) {
    return `осадки ${precipitation.toFixed(1)} мм`;
  }

  if (probability !== null && probability >= 50) {
    return `дождь возможен, ${probability}%`;
  }

  return "без заметных осадков";
}

export async function WeatherCompact() {
  const { forecast } = await getSudakWeather();
  const today = forecast?.days[0] ?? null;
  const nextHour = forecast?.hours[0] ?? null;

  return (
    <Link
      href="/weather"
      className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <Card className="border-primary/10 shadow-none transition-shadow hover:shadow-card">
        <CardContent className="flex items-center justify-between gap-3 py-3 sm:gap-4">
          <div className="min-w-0 space-y-0.5">
            <p className="text-xs font-medium text-foreground-muted">
              Погода в Судаке
            </p>
            {forecast ? (
              <>
                <p className="truncate text-lg font-semibold leading-6 text-foreground">
                  {forecast.now.condition.icon} {forecast.now.temperature > 0 ? "+" : ""}
                  {forecast.now.temperature}, {forecast.now.condition.label}
                </p>
                <p className="hidden truncate text-xs text-foreground-muted sm:block">
                  {formatRainLine(forecast.now.precipitation, nextHour?.precipitationProbability ?? null)}
                </p>
              </>
            ) : (
              <p className="text-base font-semibold">Погода временно недоступна</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2 text-right text-sm text-foreground-muted">
            <div>
              {today ? (
                <>
                  <p>
                    {today.temperatureMin > 0 ? "+" : ""}
                    {today.temperatureMin} / {today.temperatureMax > 0 ? "+" : ""}
                    {today.temperatureMax}
                  </p>
                  <p className="font-medium text-primary">Подробнее</p>
                </>
              ) : (
                <>
                  <p>прогноз</p>
                  <p className="font-medium text-primary">Подробнее</p>
                </>
              )}
            </div>
            <span aria-hidden="true" className="text-xl leading-none text-primary">›</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
