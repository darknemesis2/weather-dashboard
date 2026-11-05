export type Place = {
  id: number
  name: string
  admin1?: string
  country?: string
  latitude: number
  longitude: number
  timezone?: string
}

export type Conditions = {
  temperature: number
  apparentTemperature: number
  humidity: number
  windSpeed: number
  weatherCode: number
  isDay: boolean
  time: string
  aqi: number | null
}

type GeocodingResponse = { results?: Place[] }
type WeatherResponse = {
  current: {
    temperature_2m: number
    relative_humidity_2m: number
    apparent_temperature: number
    is_day: number
    precipitation: number
    weather_code: number
    wind_speed_10m: number
    time: string
  }
}
type AirResponse = { current?: { us_aqi?: number } }

export async function findPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const params = new URLSearchParams({ name: query, count: '5', language: 'en', format: 'json' })
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, { signal })
  if (!response.ok) throw new Error('Location search is unavailable right now.')
  const data = (await response.json()) as GeocodingResponse
  return data.results ?? []
}

export async function getConditions(place: Place, signal?: AbortSignal): Promise<Conditions> {
  const coordinates = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m',
    timezone: place.timezone || 'auto',
    wind_speed_unit: 'kmh',
  })
  const airParams = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    current: 'us_aqi',
    timezone: place.timezone || 'auto',
  })
  const [weatherResponse, airResponse] = await Promise.all([
    fetch(`https://api.open-meteo.com/v1/forecast?${coordinates}`, { signal }),
    fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${airParams}`, { signal }),
  ])
  if (!weatherResponse.ok) throw new Error('Weather data is unavailable right now. Please try again.')
  const weather = (await weatherResponse.json()) as WeatherResponse
  const air: AirResponse | null = airResponse.ok ? ((await airResponse.json()) as AirResponse) : null
  const current = weather.current
  return {
    temperature: current.temperature_2m,
    apparentTemperature: current.apparent_temperature,
    humidity: current.relative_humidity_2m,
    windSpeed: current.wind_speed_10m,
    weatherCode: current.weather_code,
    isDay: current.is_day === 1,
    time: current.time,
    aqi: air?.current?.us_aqi ?? null,
  }
}

export function describeWeather(code: number): { title: string; detail: string; kind: 'sunny' | 'rainy' | 'cloudy' | 'snow' | 'storm' } {
  if (code === 0) return { title: 'Clear sky', detail: 'A little more room to breathe.', kind: 'sunny' }
  if (code <= 2) return { title: 'Mostly clear', detail: 'A soft mix of sun and clouds.', kind: 'sunny' }
  if (code === 3) return { title: 'Overcast', detail: 'A quiet, cloud-filled sky.', kind: 'cloudy' }
  if ([45, 48].includes(code)) return { title: 'Misty', detail: 'A little haze in the air.', kind: 'cloudy' }
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { title: 'Rainy', detail: 'Take a moment to enjoy the rain.', kind: 'rainy' }
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { title: 'Snowfall', detail: 'The world is taking it slow.', kind: 'snow' }
  if ([95, 96, 99].includes(code)) return { title: 'Thunderstorms', detail: 'A storm is moving through.', kind: 'storm' }
  return { title: 'Cloudy', detail: 'A quiet, cloud-filled sky.', kind: 'cloudy' }
}

export function aqiLabel(value: number): string {
  if (value <= 50) return 'Good'
  if (value <= 100) return 'Moderate'
  if (value <= 150) return 'Sensitive groups'
  if (value <= 200) return 'Unhealthy'
  if (value <= 300) return 'Very unhealthy'
  return 'Hazardous'
}

export function formatLocalTime(time: string): string {
  const date = new Date(time)
  return Number.isNaN(date.getTime()) ? time : new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date)
}
