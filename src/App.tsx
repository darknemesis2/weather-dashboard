import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowUpRight, Cloud, CloudRain, Droplets, LocateFixed, MapPin, Search, Wind, X } from 'lucide-react'
import { aqiLabel, describeWeather, findPlaces, formatLocalTime, getConditions, type Conditions, type Place } from './weather'

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

function placeLabel(place: Place) {
  return [place.name, place.admin1, place.country].filter(Boolean).join(', ')
}

function App() {
  const [query, setQuery] = useState('')
  const [places, setPlaces] = useState<Place[]>([])
  const [place, setPlace] = useState<Place | null>(null)
  const [conditions, setConditions] = useState<Conditions | null>(null)
  const [searching, setSearching] = useState(false)
  const [loading, setLoading] = useState<LoadState>('idle')
  const [message, setMessage] = useState('')
  const [locationBusy, setLocationBusy] = useState(false)
  const searchController = useRef<AbortController | null>(null)
  const requestId = useRef(0)

  const loadPlace = async (nextPlace: Place) => {
    const id = ++requestId.current
    setPlace(nextPlace)
    setQuery('')
    setPlaces([])
    setSearching(false)
    setMessage('')
    setLoading('loading')
    try {
      const nextConditions = await getConditions(nextPlace)
      if (id !== requestId.current) return
      setConditions(nextConditions)
      setLoading('ready')
    } catch (error) {
      if (id !== requestId.current) return
      setLoading('error')
      setMessage(error instanceof Error ? error.message : 'Something went wrong. Please try again.')
    }
  }

  const search = async (event?: FormEvent) => {
    event?.preventDefault()
    const term = query.trim()
    if (!term) {
      setMessage('Type a city or place to search.')
      return
    }
    searchController.current?.abort()
    const controller = new AbortController()
    searchController.current = controller
    setSearching(true)
    setMessage('')
    setPlaces([])
    try {
      const results = await findPlaces(term, controller.signal)
      if (controller.signal.aborted) return
      if (results.length === 0) {
        setMessage(`We couldn’t find “${term}”. Try another city.`)
        setSearching(false)
      } else if (results.length === 1) {
        setSearching(false)
        await loadPlace(results[0])
      } else {
        setPlaces(results)
        setSearching(false)
      }
    } catch (error) {
      if (controller.signal.aborted) return
      setSearching(false)
      setMessage(error instanceof Error ? error.message : 'Search is unavailable. Please try again.')
    }
  }

  const locate = () => {
    if (!navigator.geolocation) {
      setMessage('Your browser does not support location. Search for a city instead.')
      return
    }
    setLocationBusy(true)
    setMessage('')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationBusy(false)
        void loadPlace({
          id: 0,
          name: 'Your location',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        })
      },
      (error) => {
        setLocationBusy(false)
        setMessage(error.code === error.PERMISSION_DENIED
          ? 'Location access was turned off. Search for a city to get started.'
          : 'We couldn’t get your location. Check your connection or search for a city.')
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    )
  }

  useEffect(() => () => searchController.current?.abort(), [])

  const description = conditions ? describeWeather(conditions.weatherCode) : null
  const scene = conditions && !conditions.isDay ? 'night' : description?.kind ?? 'cloudy'
  const dateLabel = conditions ? new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(conditions.time)) : ''

  return (
    <main className={`app-shell scene-${scene}`}>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="grain" />
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Atmos home">
          <span className="brand-mark"><span /></span>
          <span>atmos<span className="brand-period">.</span></span>
        </a>
        <div className="topbar-note"><span className="live-dot" /> A little closer to the sky</div>
      </header>

      <section className="dashboard" id="top" aria-label="Current weather">
        <div className="intro-row">
          <div>
            <p className="eyebrow">YOUR WEATHER, IN ITS ELEMENT</p>
            <h1>A moment outside<span className="heading-dot">.</span></h1>
            <p className="intro-copy">A clear little picture of what’s happening around you.</p>
          </div>
          <button className="location-button" type="button" onClick={locate} disabled={locationBusy}>
            <LocateFixed size={16} strokeWidth={1.8} />
            <span>{locationBusy ? 'Finding you…' : 'Use my location'}</span>
          </button>
        </div>

        <div className="search-wrap">
          <form className="search-form" onSubmit={search} role="search">
            <Search className="search-icon" size={19} strokeWidth={1.8} aria-hidden="true" />
            <label className="sr-only" htmlFor="city-search">Search for a city</label>
            <input id="city-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a city or place…" autoComplete="off" />
            {query && <button type="button" className="clear-search" aria-label="Clear search" onClick={() => { setQuery(''); setPlaces([]); setMessage('') }}><X size={16} /></button>}
            <button className="search-submit" type="submit" aria-label="Search" disabled={searching}>{searching ? <span className="button-spinner" /> : <ArrowUpRight size={19} />}</button>
          </form>
          {places.length > 0 && <div className="place-results" role="listbox" aria-label="Matching places">
            <p className="results-label">A few places we found</p>
            {places.map((result) => <button className="place-result" role="option" aria-selected="false" key={result.id} type="button" onClick={() => void loadPlace(result)}>
              <span className="result-pin"><MapPin size={16} /></span><span className="result-copy"><strong>{result.name}</strong><small>{[result.admin1, result.country].filter(Boolean).join(', ')}</small></span><ArrowUpRight size={16} className="result-arrow" />
            </button>)}
          </div>}
          {message && <p className="feedback" role="status">{message}</p>}
        </div>

        {loading === 'idle' && <div className="welcome-card">
          <div className="welcome-art" aria-hidden="true"><span className="welcome-sun" /><span className="welcome-cloud cloud-a" /><span className="welcome-cloud cloud-b" /></div>
          <div className="welcome-copy"><span className="welcome-kicker">A GOOD PLACE TO START</span><h2>Where are you today?</h2><p>Search for a place, or let us find the weather right where you are.</p></div>
          <button className="welcome-action" type="button" onClick={locate}><LocateFixed size={17} /> Find my weather <ArrowUpRight size={16} /></button>
        </div>}

        {loading === 'loading' && <div className="loading-card" role="status" aria-live="polite"><span className="loading-orbit"><span /></span><div><strong>Reading the sky</strong><p>Finding the latest conditions for {place?.name ?? 'your place'}…</p></div></div>}

        {loading === 'error' && <div className="error-card" role="alert"><div className="error-icon"><Cloud size={21} /></div><div><strong>Couldn’t read the sky just now</strong><p>{message || 'Please try another search in a moment.'}</p></div><button type="button" onClick={() => place && void loadPlace(place)}>Try again <ArrowUpRight size={15} /></button></div>}

        {loading === 'ready' && conditions && place && description && <div className="weather-content" aria-live="polite">
          <article className="hero-card">
            <div className="hero-topline"><div className="place-heading"><MapPin size={15} /><span>{placeLabel(place)}</span></div><span className="local-time">LOCAL TIME <b>{formatLocalTime(conditions.time)}</b></span></div>
            <div className="hero-main">
              <div className="weather-copy"><p className="date-label">{dateLabel}</p><div className="condition-line"><h2>{description.title}</h2><span className="condition-dot" /></div><p className="condition-note">{description.detail}</p><div className="feels-like">FEELS LIKE <strong>{Math.round(conditions.apparentTemperature)}°</strong></div></div>
              <div className="weather-art" aria-hidden="true"><div className="sky-orb" /><div className="sky-cloud sky-cloud-one" /><div className="sky-cloud sky-cloud-two" />{description.kind === 'rainy' && <div className="rain-streaks"><i /><i /><i /><i /><i /><i /><i /></div>}{scene === 'night' && <div className="stars"><i /><i /><i /><i /><i /><i /></div>}<div className="art-horizon" /></div>
              <div className="temperature"><span>{Math.round(conditions.temperature)}</span><sup>°</sup><small>C</small></div>
            </div>
            <div className="hero-footer"><div className="footer-icon"><CloudRain size={17} /></div><span>Take the day as it comes.</span><span className="updated-label">CURRENT CONDITIONS</span></div>
          </article>

          <div className="section-heading"><div><p className="eyebrow">THE LITTLE DETAILS</p><h2>Out there, right now</h2></div><span className="section-caption">A snapshot of your surroundings</span></div>
          <div className="metrics-grid">
            <article className="metric-card humidity-card"><div className="metric-top"><span className="metric-icon"><Droplets size={18} /></span><span className="metric-index">01 / 03</span></div><p className="metric-label">HUMIDITY</p><div className="metric-value">{Math.round(conditions.humidity)}<span>%</span></div><div className="humidity-meter"><span style={{ width: `${Math.min(conditions.humidity, 100)}%` }} /></div><p className="metric-hint">The air’s moisture, around you</p></article>
            <article className="metric-card aqi-card"><div className="metric-top"><span className="metric-icon"><span className="air-icon"><i /><i /><i /></span></span><span className="metric-index">02 / 03</span></div><p className="metric-label">AIR QUALITY <span className="us-badge">US AQI</span></p><div className={`metric-value aqi-value ${conditions.aqi === null ? 'muted-value' : ''}`}>{conditions.aqi === null ? '—' : conditions.aqi}<span>{conditions.aqi === null ? '' : ' AQI'}</span></div><div className={`aqi-status ${conditions.aqi === null ? 'aqi-unavailable' : ''}`}><span />{conditions.aqi === null ? 'Unavailable right now' : aqiLabel(conditions.aqi)}</div><p className="metric-hint">A little insight into the air</p></article>
            <article className="metric-card wind-card"><div className="metric-top"><span className="metric-icon"><Wind size={18} /></span><span className="metric-index">03 / 03</span></div><p className="metric-label">WIND SPEED</p><div className="metric-value">{Math.round(conditions.windSpeed)}<span> km/h</span></div><div className="wind-direction"><ArrowUpRight size={14} /> <span>Moving through your area</span></div><p className="metric-hint">A breeze, measured at 10 metres</p></article>
          </div>
        </div>}

        <footer className="footer"><span>Made for a slower look outside.</span><span>Weather by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> <span className="footer-separator">·</span> Air quality by <a href="https://open-meteo.com/en/docs/air-quality-api" target="_blank" rel="noreferrer">CAMS</a></span></footer>
      </section>
    </main>
  )
}

export default App
