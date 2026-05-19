# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Note: the `main` branch holds the real project — an Übersicht widget. If you're checked out on a different branch and see no source, run `git fetch origin && git show origin/main:rain.jsx` to inspect it.

## What this is

A single-file [Übersicht](https://tracesof.net/uebersicht/) widget (`rain.jsx`) that shows recent precipitation totals — and rain minus reference evapotranspiration (ET₀) — for one or more places on the macOS desktop, using Open-Meteo's free forecast + archive APIs. There is no build step, no package.json, no test suite: Übersicht loads `rain.jsx` directly and transpiles JSX itself.

## Working with the widget

- **Install / refresh on a Mac with Übersicht:** `./install.sh` (copies `rain.jsx` into `~/Library/Application Support/Übersicht/widgets/`).
- **Iterate on changes:** Übersicht watches its widgets directory and reloads on file change, but **it ignores symlinks**, so a bare `git pull` in this repo does not update the live widget. Re-copy after every edit: `./install.sh` or `./install.sh --update` (which also pulls).
- **Errors / logs:** the Übersicht menu-bar icon surfaces JS errors and a "Open widgets directory" shortcut. There is no terminal log.
- **Non-macOS dev:** you can't actually run the widget. Validate by reading `rain.jsx` and reasoning through the state machine; `install.sh` hard-fails on non-Darwin.

## Architecture

The widget uses **Übersicht's native state API**, not React hooks. The exported surface area is fixed by Übersicht:

- `initialState` — seeded from `loadConfig()` (reads `localStorage` key `rain-widget-config-v1`, falls back to `DEFAULT_LOCATIONS`).
- `command(dispatch)` — runs once on load; kicks off the initial `fetchAll` for the saved locations/window.
- `refreshFrequency` — 6 hours. Übersicht re-invokes `command` on this interval.
- `updateState(event, state) → state` — pure reducer. Events: `FETCH_OK`, `FETCH_ERR`, `SET_WINDOW`, `TOGGLE_SETTINGS`, `SET_QUERY`, `SET_RESULTS`, `ADD_LOC`, `REMOVE_LOC`, `SET_POSITION`. Anything user-driven (window change, add/remove location) also fires a fresh `fetchAll` from the render handlers — the reducer alone doesn't refetch.
- `render(a, b)` — must tolerate **both** calling conventions: older Übersicht passes `(state, dispatch)`, newer versions pass `({...state, dispatch})`. The defensive unpacking at the top of `render` is load-bearing; don't simplify it to a single signature.
- `className` — a CSS template string (not a class name). Übersicht scopes it to the widget's wrapper `<div>`. Selectors like `.card`, `.header`, etc. are relative to that wrapper.

### Data flow

1. `buildUrl(loc, days)` chooses endpoint by window size:
   - `days ≤ 92` → `api.open-meteo.com/v1/forecast` with `past_days=days-1` + `forecast_days=1` (so "today" is included).
   - `days > 92` → `archive-api.open-meteo.com/v1/archive` with explicit `start_date`/`end_date`.
   Both request `daily=precipitation_sum,et0_fao_evapotranspiration`. If you add new locations or windows, preserve this split — the archive API doesn't cover recent days, the forecast API caps `past_days` at 92.
2. `fetchRain` sums both arrays and returns `{ rain, et, net: rain - et }`.
3. `searchPlaces(query)` hits `geocoding-api.open-meteo.com/v1/search` and returns lat/lon **plus IANA timezone**, which must be threaded through to the data query — otherwise totals straddle the wrong calendar day. Search is debounced 300 ms via the module-level `searchTimer`.

### Persistence

`saveConfig` writes `{locations, windowDays, position}` to `localStorage` on every state-changing event that should survive a reload. `position` is `null` until the user drags the card; `applyPosition` (a `ref` callback on `.card`) then writes `left`/`top` onto the **parent wrapper** that Übersicht injects, overriding the `top`/`left` declared in the `className` block. Drag handling in `onDragStart` is plain DOM mouse events — no library — and must call `dispatch({type:'SET_POSITION',...})` on mouseup to persist.

### Defaults to know

- `DEFAULT_LOCATIONS` at the top of `rain.jsx` is the seed when `localStorage` is empty. Editing it does **not** affect users who already have saved config.
- `CONFIG_KEY = 'rain-widget-config-v1'`. Bump the version suffix when changing the persisted shape in a backwards-incompatible way.
- Default window is 14 days (matches `WINDOWS[2]`).

## Branch convention

Active feature branch: `claude/init-project-setup-Izazg`. Develop and push there, not `main`.
