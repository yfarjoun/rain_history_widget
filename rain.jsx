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

const loadConfig = () => {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (raw) {
      const cfg = JSON.parse(raw)
      if (cfg.locations && cfg.locations.length) return cfg
    }
  } catch (e) {}
  return { locations: DEFAULT_LOCATIONS, windowDays: 14, position: null }
}

const saveConfig = (state) => {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify({
      locations: state.locations,
      windowDays: state.windowDays,
      position: state.position || null
    }))
  } catch (e) {}
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

const fetchRain = (loc, days) =>
  fetch(buildUrl(loc, days))
    .then(res => { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json() })
    .then(data => {
      const vals = (data && data.daily && data.daily.precipitation_sum) || []
      return vals.reduce((a, b) => a + (b || 0), 0)
    })

const searchPlaces = (query) =>
  fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`)
    .then(res => res.ok ? res.json() : { results: [] })
    .then(data => (data.results || []).map(r => ({
      id: 'geo-' + r.id,
      name: [r.name, r.admin1].filter(Boolean).join(', '),
      sub: r.country_code || '',
      lat: r.latitude,
      lon: r.longitude,
      tz: r.timezone || 'auto'
    })))

const fetchAll = (locations, days, dispatch) => {
  locations.forEach(loc => {
    fetchRain(loc, days)
      .then(value => dispatch({ type: 'FETCH_OK', id: loc.id, value }))
      .catch(err => dispatch({ type: 'FETCH_ERR', id: loc.id, error: err.message }))
  })
}

let searchTimer = null
const debouncedSearch = (query, dispatch) => {
  if (searchTimer) clearTimeout(searchTimer)
  if (!query.trim()) { dispatch({ type: 'SET_RESULTS', results: [] }); return }
  searchTimer = setTimeout(() => {
    searchPlaces(query).then(results => dispatch({ type: 'SET_RESULTS', results }))
  }, 300)
}

const _initial = loadConfig()

export const refreshFrequency = 6 * 60 * 60 * 1000

export const initialState = {
  locations: _initial.locations,
  windowDays: _initial.windowDays,
  position: _initial.position || null,
  values: {},
  errors: {},
  showSettings: false,
  query: '',
  results: []
}

export const command = (dispatch) => {
  const cfg = loadConfig()
  fetchAll(cfg.locations, cfg.windowDays, dispatch)
}

export const updateState = (event, state) => {
  switch (event.type) {
    case 'FETCH_OK': {
      const values = Object.assign({}, state.values, { [event.id]: event.value })
      const errors = Object.assign({}, state.errors); delete errors[event.id]
      return Object.assign({}, state, { values, errors })
    }
    case 'FETCH_ERR': {
      const errors = Object.assign({}, state.errors, { [event.id]: event.error })
      const values = Object.assign({}, state.values); delete values[event.id]
      return Object.assign({}, state, { values, errors })
    }
    case 'SET_WINDOW': {
      const next = Object.assign({}, state, { windowDays: event.days, values: {}, errors: {} })
      saveConfig(next); return next
    }
    case 'TOGGLE_SETTINGS':
      return Object.assign({}, state, { showSettings: !state.showSettings, query: '', results: [] })
    case 'SET_QUERY':
      return Object.assign({}, state, { query: event.value })
    case 'SET_RESULTS':
      return Object.assign({}, state, { results: event.results })
    case 'ADD_LOC': {
      if (state.locations.some(l => l.id === event.loc.id)) return state
      const next = Object.assign({}, state, {
        locations: state.locations.concat([event.loc]),
        query: '', results: [], values: {}, errors: {}
      })
      saveConfig(next); return next
    }
    case 'REMOVE_LOC': {
      if (state.locations.length <= 1) return state
      const next = Object.assign({}, state, {
        locations: state.locations.filter(l => l.id !== event.id),
        values: {}, errors: {}
      })
      saveConfig(next); return next
    }
    case 'SET_POSITION': {
      const next = Object.assign({}, state, { position: event.position })
      saveConfig(next); return next
    }
    default:
      return state
  }
}

export const render = (props) => {
  const dispatch = props.dispatch
  const locations = props.locations || DEFAULT_LOCATIONS
  const windowDays = props.windowDays || 14
  const values = props.values || {}
  const errors = props.errors || {}
  const showSettings = !!props.showSettings
  const query = props.query || ''
  const results = props.results || []
  const position = props.position
  const win = WINDOWS.find(w => w.days === windowDays) || WINDOWS[2]

  const applyPosition = (el) => {
    if (!el || !position) return
    const wrapper = el.parentElement
    if (!wrapper) return
    if (position.left != null) { wrapper.style.left = position.left + 'px'; wrapper.style.right = 'auto' }
    if (position.top != null) wrapper.style.top = position.top + 'px'
  }

  const onDragStart = (e) => {
    if (e.button !== 0) return
    if (e.target && e.target.closest && e.target.closest('.iconBtn')) return
    const card = e.currentTarget.closest('.card')
    const wrapper = card && card.parentElement
    if (!wrapper) return
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    const rect = wrapper.getBoundingClientRect()
    let finalLeft = rect.left
    let finalTop = rect.top
    const onMove = (ev) => {
      finalLeft = rect.left + (ev.clientX - startX)
      finalTop = rect.top + (ev.clientY - startY)
      wrapper.style.left = finalLeft + 'px'
      wrapper.style.right = 'auto'
      wrapper.style.top = finalTop + 'px'
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      dispatch({ type: 'SET_POSITION', position: { left: finalLeft, top: finalTop } })
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const onWindow = (days) => {
    dispatch({ type: 'SET_WINDOW', days })
    fetchAll(locations, days, dispatch)
  }
  const onAdd = (loc) => {
    dispatch({ type: 'ADD_LOC', loc })
    fetchAll(locations.concat([loc]).filter((l, i, a) => a.findIndex(x => x.id === l.id) === i), windowDays, dispatch)
  }
  const onRemove = (id) => {
    dispatch({ type: 'REMOVE_LOC', id })
    fetchAll(locations.filter(l => l.id !== id), windowDays, dispatch)
  }
  const onQuery = (e) => {
    const value = e.target.value
    dispatch({ type: 'SET_QUERY', value })
    debouncedSearch(value, dispatch)
  }

  const drop = (
    <svg width="11" height="14" viewBox="0 0 10 13"
         style={{ marginRight: 7, opacity: 0.55, verticalAlign: '-2px' }}>
      <path d="M5 0.5 C5 0.5 0.6 5.2 0.6 8.2 a4.4 4.4 0 0 0 8.8 0 C9.4 5.2 5 0.5 5 0.5z"
            fill="currentColor" />
    </svg>
  )

  const renderValue = (loc) => {
    if (errors[loc.id]) return <span className="err" title={errors[loc.id]}>—</span>
    if (values[loc.id] != null) {
      return [
        <span key="n" className="num">{Math.round(values[loc.id])}</span>,
        <span key="u" className="unit"> mm</span>
      ]
    }
    return <span className="dim">…</span>
  }

  return (
    <div className="card" ref={applyPosition}>
      <div className="header" onMouseDown={onDragStart} title="Drag to move">
        <span className="title">{drop}Precipitation · past {win.label}</span>
        <button className="iconBtn"
                onClick={() => dispatch({ type: 'TOGGLE_SETTINGS' })}
                title={showSettings ? 'Close' : 'Settings'}>
          {showSettings ? '×' : '⚙'}
        </button>
      </div>

      {!showSettings ? (
        <div className="body">
          <div className="locations">
            {locations.map(loc => (
              <div className="locRow" key={loc.id}>
                <div className="locName">{loc.name}</div>
                <div className="locValue">{renderValue(loc)}</div>
              </div>
            ))}
          </div>
          <div className="windows">
            {WINDOWS.map(w => (
              <button key={w.days}
                      className={'winBtn' + (w.days === windowDays ? ' active' : '')}
                      onClick={() => onWindow(w.days)}>
                {w.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="settings">
          <div className="sectionLabel">Locations</div>
          <div className="locList">
            {locations.map(loc => (
              <div className="settingRow" key={loc.id}>
                <div className="settingName">{loc.name}</div>
                <div className="coord">{loc.lat.toFixed(2)}, {loc.lon.toFixed(2)}</div>
                <button className="rmBtn"
                        disabled={locations.length <= 1}
                        onClick={() => onRemove(loc.id)}
                        title="Remove">×</button>
              </div>
            ))}
          </div>
          <input className="search"
                 placeholder="Add a place…"
                 value={query}
                 onChange={onQuery} />
          {results.length > 0 && (
            <div className="results">
              {results.map(r => (
                <div className="resultRow" key={r.id} onClick={() => onAdd(r)}>
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

export const className = `
  top: 40px;
  left: 40px;
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
    cursor: grab;
    -webkit-user-select: none;
    user-select: none;
  }
  .header:active { cursor: grabbing; }

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

  .locName { font-size: 13px; opacity: 0.82; font-weight: 400; }

  .locValue { font-variant-numeric: tabular-nums; }
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

  .settings { display: flex; flex-direction: column; gap: 8px; }

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

  .resultSub {
    font-size: 10px;
    opacity: 0.5;
    letter-spacing: 0.04em;
  }
`
