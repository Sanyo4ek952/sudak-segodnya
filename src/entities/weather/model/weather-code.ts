import type { WeatherCondition } from "@/entities/weather/model/types";

const conditions: Record<number, Omit<WeatherCondition, "code">> = {
  0: { label: "ясно", icon: "☀" },
  1: { label: "преимущественно ясно", icon: "🌤" },
  2: { label: "переменная облачность", icon: "⛅" },
  3: { label: "пасмурно", icon: "☁" },
  45: { label: "туман", icon: "≋" },
  48: { label: "изморозь", icon: "≋" },
  51: { label: "слабая морось", icon: "🌦" },
  53: { label: "морось", icon: "🌦" },
  55: { label: "сильная морось", icon: "🌧" },
  56: { label: "ледяная морось", icon: "🌧" },
  57: { label: "сильная ледяная морось", icon: "🌧" },
  61: { label: "слабый дождь", icon: "🌦" },
  63: { label: "дождь", icon: "🌧" },
  65: { label: "сильный дождь", icon: "🌧" },
  66: { label: "ледяной дождь", icon: "🌧" },
  67: { label: "сильный ледяной дождь", icon: "🌧" },
  71: { label: "слабый снег", icon: "❄" },
  73: { label: "снег", icon: "❄" },
  75: { label: "сильный снег", icon: "❄" },
  77: { label: "снежные зерна", icon: "❄" },
  80: { label: "слабые ливни", icon: "🌦" },
  81: { label: "ливни", icon: "🌧" },
  82: { label: "сильные ливни", icon: "🌧" },
  85: { label: "снегопад", icon: "❄" },
  86: { label: "сильный снегопад", icon: "❄" },
  95: { label: "гроза", icon: "⚡" },
  96: { label: "гроза с градом", icon: "⚡" },
  99: { label: "сильная гроза с градом", icon: "⚡" }
};

export function getWeatherCondition(code: number): WeatherCondition {
  const condition = conditions[code] ?? { label: "погода уточняется", icon: "•" };

  return {
    code,
    ...condition
  };
}

