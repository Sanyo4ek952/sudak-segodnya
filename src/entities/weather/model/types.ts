export type WeatherCondition = {
  code: number;
  label: string;
  icon: string;
};

export type WeatherNow = {
  temperature: number;
  apparentTemperature: number;
  precipitation: number;
  rain: number;
  showers: number;
  windSpeed: number;
  windGusts: number;
  condition: WeatherCondition;
  updatedAt: string;
};

export type WeatherHour = {
  time: string;
  temperature: number;
  precipitationProbability: number | null;
  precipitation: number;
  rain: number;
  showers: number;
  windSpeed: number;
  condition: WeatherCondition;
};

export type WeatherDay = {
  date: string;
  temperatureMin: number;
  temperatureMax: number;
  precipitationSum: number;
  precipitationProbabilityMax: number | null;
  windSpeedMax: number;
  condition: WeatherCondition;
};

export type WeatherForecast = {
  locationName: string;
  sourceName: string;
  yandexUrl: string;
  now: WeatherNow;
  hours: WeatherHour[];
  days: WeatherDay[];
};

