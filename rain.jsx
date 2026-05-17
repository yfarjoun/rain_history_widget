const { useState, useEffect, useRef } = React

const DEFAULT_LOCATIONS = [
  { id: 'sainte-lucie', name: 'Sainte-Lucie', lat: 46.13, lon: -74.30, tz: 'America/Montreal' }
]

const WINDOWS = [
  { label: '1d',  days: 1  },
  { label: '7d',  days: 7  },
  { label: '14d', days: 14 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 }
]

const CONFIG_KEY = 'rain-widget-config-v1'
const REFRESH_MS = 6 * 60 * 60 * 1000

const loadConfig = () => {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (raw) {
      const cfg = JSON.parse(raw)
      if (cfg.locations && cfg.locations.length) return cfg
    }
  } catch (e) {}
  return { locations: DEFAULT_LOCATIONS, windowDays: 14 }
}

const saveConfig = (cfg) => {
  try { localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg)) } catch (e) {}
}

const fmtDate = (d) => d.toISOString().slice(0, 10)

const buildUrl = (loc, days) => {
  const tz = encodeURIComponent(loc.tz || 'auto')
  if (days <= 92) {
    return `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}` +
           `&daily=precipitation_sum&past_days=${days}&forecast_days=0&timezone=${tz}`
  }
  const end = new Date(); end.setDate(end.getDate() - 1)
  const start = new Date(); start.setDate(start.getDate() - days)
  return `https://archive-api.open-meteo.com/v1/archive?latitude=${loc.lat}&longitude=${loc.lon}` +
         `&daily=precipitation_sum&start_date=${fmtDate(start)}&end_date=${fmtDate(end)}&timezone=${tz}`
}

const fetchRain = async (loc, days) => {
  const res = await fetch(buildUrl(loc, days))
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  const vals = (data && data.daily && data.daily.precipitation_sum) || []
  return vals.reduce((a, b) => a + (b || 0), 0)
}

const searchPlaces = async (query) => {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json()
  return (data.results || []).map(r => ({
    id: `geo-${r.id}`,
    name: [r.name, r.admin1].filter(Boolean).join(', '),
    sub: r.country_code || '',
    lat: r.latitude,
    lon: r.longitude,
    tz: r.timezone || 'auto'
  }))
}

const Drop = () => (
  <svg width="11" height="14" viewBox="0 0 10 13" style={{ marginRight: 7, opacity: 0.55, verticalAlign: '-2px' }}>
    <path d="M5 0.5 C5 0.5 0.6 5.2 0.6 8.2 a4.4 4.4 0 0 0 8.8 0 C9.4 5.2 5 0.5 5 0.5z"
          fill="currentColor" />
  </svg>
)

const Widget = () => {
  const [config, setConfig] = useState(loadConfig)
  const [values, setValues] = useState({})
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const cancelRef = useRef(0)

  const update = (next) => { setConfig(next); saveConfig(next) }

  useEffect(() => {
    const tag = ++cancelRef.current
    setLoading(true)
    const run = async () => {
      const v = {}, e = {}
      await Promise.all(config.locations.map(async (loc) => {
        try { v[loc.id] = await fetchRain(loc, config.windowDays) }
        catch (err) { e[loc.id] = err.message }
      }))
      if (tag !== cancelRef.current) return
      setValues(v); setErrors(e); setLoading(false)
    }
    run()
    const t = setInterval(run, REFRESH_MS)
    return () => clearInterval(t)
  }, [JSON.stringify(config.locations), config.windowDays])

  useEffect(() => {
    if (!query.trim()) { setResults([]); setSearching(false); return }
    setSearching(true)
    const t = setTimeout(async () => {
      const r = await searchPlaces(query)
      setResults(r); setSearching(false)
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  const addLocation = (loc) => {
    if (config.locations.find(l => l.id === loc.id)) return
    update({ ...config, locations: [...config.locations, loc] })
    setQuery(''); setResults([])
  }

  const removeLocation = (id) => {
    if (config.locations.length <= 1) return
    update({ ...config, locations: config.locations.filter(l => l.id !== id) })
  }

  const win = WINDOWS.find(w => w.days === config.windowDays) || WINDOWS[2]

  return (
    <div className="card">
      <div className="header">
        <span className="title"><Drop />Precipitation · past {win.label}</span>
        <button className="iconBtn" onClick={() => setShowSettings(s => !s)}
                title={showSettings ? 'Close' : 'Settings'}>
          {showSettings ? '×' : '⚙'}
        </button>
      </div>

      {!showSettings && (
        <div className="body">
          <div className="locations">
            {config.locations.map(loc => {
              const v = values[loc.id]
              const err = errors[loc.id]
              return (
                <div className="locRow" key={loc.id}>
                  <div className="locName">{loc.name}</div>
                  <div className="locValue">
                    {err ? <span className="err" title={err}>—</span>
                      : v != null ? <><span className="num">{Math.round(v)}</span><span className="unit"> mm</span></>
                      : loading ? <span className="dim">…</span>
                      : <span className="dim">—</span>}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="windows">
            {WINDOWS.map(w => (
              <button key={w.days}
                      className={`winBtn ${w.days === config.windowDays ? 'active' : ''}`}
                      onClick={() => update({ ...config, windowDays: w.days })}>
                {w.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {showSettings && (
        <div className="settings">
          <div className="sectionLabel">Locations</div>
          <div className="locList">
            {config.locations.map(loc => (
              <div className="settingRow" key={loc.id}>
                <div className="settingName">{loc.name}</div>
                <div className="coord">{loc.lat.toFixed(2)}, {loc.lon.toFixed(2)}</div>
                <button className="rmBtn"
                        disabled={config.locations.length <= 1}
                        onClick={() => removeLocation(loc.id)}
                        title="Remove">×</button>
              </div>
            ))}
          </div>
          <input className="search"
                 placeholder="Add a place…"
                 value={query}
                 onChange={(e) => setQuery(e.target.value)} />
          {(results.length > 0 || searching) && (
            <div className="results">
              {searching && results.length === 0 && <div className="resultRow dim">Searching…</div>}
              {results.map(r => (
                <div className="resultRow" key={r.id} onClick={() => addLocation(r)}>
                  <span>{r.name}</span>
                  <span className="resultSub">{r.sub}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export const refreshFrequency = false

export const render = () => <Widget />

export const className = `
  top: 40px;
  right: 40px;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
  color: #fff;
  -webkit-font-smoothing: antialiased;

  .card {
    background: rgba(22, 24, 30, 0.62);
    backdrop-filter: blur(24px) saturate(140%);
    -webkit-backdrop-filter: blur(24px) saturate(140%);
    border-radius: 14px;
    padding: 12px 14px 10px;
    min-width: 240px;
    max-width: 280px;
    border: 1px solid rgba(255,255,255,0.08);
    box-shadow: 0 10px 30px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05);
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .title {
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    opacity: 0.6;
    font-weight: 600;
    display: flex;
    align-items: center;
  }

  .iconBtn {
    background: transparent;
    border: none;
    color: rgba(255,255,255,0.45);
    font-size: 13px;
    cursor: pointer;
    padding: 2px 7px;
    border-radius: 5px;
    line-height: 1;
    transition: all 0.12s ease;
  }
  .iconBtn:hover { color: #fff; background: rgba(255,255,255,0.10); }

  .body { display: flex; flex-direction: column; }

  .locations {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 10px;
  }

  .locRow {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 2px 0;
  }

  .locName {
    font-size: 13px;
    opacity: 0.82;
    font-weight: 400;
  }

  .locValue {
    font-variant-numeric: tabular-nums;
  }
  .locValue .num { font-size: 19px; font-weight: 500; letter-spacing: -0.01em; }
  .locValue .unit { font-size: 11px; opacity: 0.55; margin-left: 2px; }
  .locValue .dim { font-size: 16px; opacity: 0.4; }
  .locValue .err { font-size: 16px; opacity: 0.4; color: #ff8a8a; }

  .windows {
    display: flex;
    gap: 3px;
    padding-top: 8px;
    border-top: 1px solid rgba(255,255,255,0.07);
  }

  .winBtn {
    flex: 1;
    background: transparent;
    border: none;
    color: rgba(255,255,255,0.55);
    font-size: 11px;
    padding: 4px 0;
    border-radius: 5px;
    cursor: pointer;
    font-weight: 500;
    font-family: inherit;
    transition: all 0.12s ease;
  }
  .winBtn:hover { background: rgba(255,255,255,0.07); color: #fff; }
  .winBtn.active { background: rgba(255,255,255,0.14); color: #fff; }

  .settings {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .sectionLabel {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    opacity: 0.45;
    font-weight: 600;
    margin-top: 2px;
  }

  .locList { display: flex; flex-direction: column; gap: 2px; }

  .settingRow {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    padding: 4px 0;
  }

  .settingName { flex: 1; opacity: 0.85; }

  .coord {
    opacity: 0.45;
    font-size: 10.5px;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.01em;
  }

  .rmBtn {
    background: transparent;
    border: none;
    color: rgba(255,255,255,0.35);
    cursor: pointer;
    font-size: 13px;
    line-height: 1;
    padding: 2px 5px;
    border-radius: 4px;
    font-family: inherit;
    transition: all 0.12s ease;
  }
  .rmBtn:hover:not(:disabled) { color: #ff8a8a; background: rgba(255,138,138,0.10); }
  .rmBtn:disabled { opacity: 0.15; cursor: default; }

  .search {
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 6px;
    padding: 6px 9px;
    color: #fff;
    font-size: 12px;
    outline: none;
    font-family: inherit;
    transition: border-color 0.12s ease;
  }
  .search::placeholder { color: rgba(255,255,255,0.32); }
  .search:focus { border-color: rgba(255,255,255,0.22); background: rgba(255,255,255,0.08); }

  .results {
    display: flex;
    flex-direction: column;
    gap: 1px;
    max-height: 180px;
    overflow-y: auto;
    margin-top: 2px;
  }

  .resultRow {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 5px 8px;
    font-size: 12px;
    border-radius: 5px;
    cursor: pointer;
    opacity: 0.85;
    transition: all 0.1s ease;
  }
  .resultRow:hover { background: rgba(255,255,255,0.09); opacity: 1; }
  .resultRow.dim { opacity: 0.45; cursor: default; }
  .resultRow.dim:hover { background: transparent; }

  .resultSub {
    font-size: 10px;
    opacity: 0.5;
    letter-spacing: 0.04em;
  }
`
