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
    <Link href="/weather" className="block">
      <Card>
        <CardContent className="flex items-center justify-between gap-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground-muted">Погода в Судаке</p>
            {forecast ? (
              <>
                <p className="truncate text-lg font-semibold">
                  {forecast.now.condition.icon} {forecast.now.temperature > 0 ? "+" : ""}
                  {forecast.now.temperature}, {forecast.now.condition.label}
                </p>
                <p className="truncate text-xs text-foreground-muted">
                  {formatRainLine(forecast.now.precipitation, nextHour?.precipitationProbability ?? null)}
                </p>
              </>
            ) : (
              <p className="text-base font-semibold">Погода временно недоступна</p>
            )}
          </div>
          <div className="shrink-0 text-right text-sm text-foreground-muted">
            {today ? (
              <>
                <p>
                  {today.temperatureMin > 0 ? "+" : ""}
                  {today.temperatureMin} / {today.temperatureMax > 0 ? "+" : ""}
                  {today.temperatureMax}
                </p>
                <p>подробнее</p>
              </>
            ) : (
              <>
                <p>прогноз</p>
                <p>подробнее</p>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
