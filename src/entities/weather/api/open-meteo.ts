import { z } from "zod";
import { getWeatherCondition } from "@/entities/weather/model/weather-code";
import type { WeatherDay, WeatherForecast, WeatherHour } from "@/entities/weather/model/types";

const SUDAK_LATITUDE = 44.85;
const SUDAK_LONGITUDE = 34.97;
const WEATHER_REVALIDATE_SECONDS = 60 * 30;
export const YANDEX_SUDAK_WEATHER_URL = "https://yandex.ru/pogoda/sudak";

const openMeteoSchema = z.object({
  current: z.object({
    time: z.string(),
    temperature_2m: z.number(),
    apparent_temperature: z.number(),
    precipitation: z.number(),
    rain: z.number(),
    showers: z.number(),
    weather_code: z.number(),
    wind_speed_10m: z.number(),
    wind_gusts_10m: z.number()
  }),
  hourly: z.object({
    time: z.array(z.string()),
    temperature_2m: z.array(z.number()),
    precipitation_probability: z.array(z.number().nullable()),
    precipitation: z.array(z.number()),
    rain: z.array(z.number()),
    showers: z.array(z.number()),
    weather_code: z.array(z.number()),
    wind_speed_10m: z.array(z.number())
  }),
  daily: z.object({
    time: z.array(z.string()),
    weather_code: z.array(z.number()),
    temperature_2m_max: z.array(z.number()),
    temperature_2m_min: z.array(z.number()),
    precipitation_sum: z.array(z.number()),
    precipitation_probability_max: z.array(z.number().nullable()),
    wind_speed_10m_max: z.array(z.number())
  })
});

type OpenMeteoResponse = z.infer<typeof openMeteoSchema>;

type WeatherResult =
  | { forecast: WeatherForecast; error: null }
  | { forecast: null; error: string };

function buildOpenMeteoUrl() {
  const params = new URLSearchParams({
    latitude: String(SUDAK_LATITUDE),
    longitude: String(SUDAK_LONGITUDE),
    timezone: "Europe/Moscow",
    forecast_days: "7",
    current: [
      "temperature_2m",
      "apparent_temperature",
      "precipitation",
      "rain",
      "showers",
      "weather_code",
      "wind_speed_10m",
      "wind_gusts_10m"
    ].join(","),
    hourly: [
      "temperature_2m",
      "precipitation_probability",
      "precipitation",
      "rain",
      "showers",
      "weather_code",
      "wind_speed_10m"
    ].join(","),
    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "precipitation_probability_max",
      "wind_speed_10m_max"
    ].join(",")
  });

  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

function round(value: number) {
  return Math.round(value);
}

function hourlyItem(data: OpenMeteoResponse, index: number): WeatherHour | null {
  const time = data.hourly.time[index];
  const temperature = data.hourly.temperature_2m[index];
  const precipitation = data.hourly.precipitation[index];
  const rain = data.hourly.rain[index];
  const showers = data.hourly.showers[index];
  const weatherCode = data.hourly.weather_code[index];
  const windSpeed = data.hourly.wind_speed_10m[index];

  if (
    time === undefined ||
    temperature === undefined ||
    precipitation === undefined ||
    rain === undefined ||
    showers === undefined ||
    weatherCode === undefined ||
    windSpeed === undefined
  ) {
    return null;
  }

  return {
    time,
    temperature: round(temperature),
    precipitationProbability: data.hourly.precipitation_probability[index] ?? null,
    precipitation,
    rain,
    showers,
    windSpeed: round(windSpeed),
    condition: getWeatherCondition(weatherCode)
  };
}

function dailyItem(data: OpenMeteoResponse, index: number): WeatherDay | null {
  const date = data.daily.time[index];
  const weatherCode = data.daily.weather_code[index];
  const temperatureMin = data.daily.temperature_2m_min[index];
  const temperatureMax = data.daily.temperature_2m_max[index];
  const precipitationSum = data.daily.precipitation_sum[index];
  const windSpeedMax = data.daily.wind_speed_10m_max[index];

  if (
    date === undefined ||
    weatherCode === undefined ||
    temperatureMin === undefined ||
    temperatureMax === undefined ||
    precipitationSum === undefined ||
    windSpeedMax === undefined
  ) {
    return null;
  }

  return {
    date,
    temperatureMin: round(temperatureMin),
    temperatureMax: round(temperatureMax),
    precipitationSum,
    precipitationProbabilityMax: data.daily.precipitation_probability_max[index] ?? null,
    windSpeedMax: round(windSpeedMax),
    condition: getWeatherCondition(weatherCode)
  };
}

function normalizeWeather(data: OpenMeteoResponse): WeatherForecast {
  const currentHour = data.current.time.slice(0, 13);
  const currentHourIndex = data.hourly.time.findIndex((time) => time.slice(0, 13) >= currentHour);
  const firstHourIndex = currentHourIndex >= 0 ? currentHourIndex : 0;

  const hours = data.hourly.time
    .slice(firstHourIndex, firstHourIndex + 12)
    .map((_, offset) => hourlyItem(data, firstHourIndex + offset))
    .filter((hour): hour is WeatherHour => Boolean(hour));

  const days = data.daily.time
    .map((_, index) => dailyItem(data, index))
    .filter((day): day is WeatherDay => Boolean(day));

  return {
    locationName: "Судак",
    sourceName: "Open-Meteo",
    yandexUrl: YANDEX_SUDAK_WEATHER_URL,
    now: {
      temperature: round(data.current.temperature_2m),
      apparentTemperature: round(data.current.apparent_temperature),
      precipitation: data.current.precipitation,
      rain: data.current.rain,
      showers: data.current.showers,
      windSpeed: round(data.current.wind_speed_10m),
      windGusts: round(data.current.wind_gusts_10m),
      condition: getWeatherCondition(data.current.weather_code),
      updatedAt: data.current.time
    },
    hours,
    days
  };
}

export async function getSudakWeather(): Promise<WeatherResult> {
  try {
    const response = await fetch(buildOpenMeteoUrl(), {
      next: { revalidate: WEATHER_REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      return { forecast: null, error: "Погода временно недоступна" };
    }

    const parsed = openMeteoSchema.safeParse(await response.json());

    if (!parsed.success) {
      return { forecast: null, error: "Погода временно недоступна" };
    }

    return { forecast: normalizeWeather(parsed.data), error: null };
  } catch {
    return { forecast: null, error: "Погода временно недоступна" };
  }
}
