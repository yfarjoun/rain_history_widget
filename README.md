# rain_history_widget

An [Übersicht](https://tracesof.net/uebersicht/) widget that shows recent
precipitation totals for one or more places, using
[Open-Meteo](https://open-meteo.com/)'s free forecast + archive APIs.

![widget preview]( <!-- screenshot lives only in your imagination so far --> )

## Features

- **Multiple locations** — add any place via Open-Meteo's geocoding search;
  they render stacked in a single card.
- **Time-window picker** — 1d / 7d / 14d / 30d / 90d. Uses the forecast endpoint
  (`past_days`) for ≤92d and falls back to the archive endpoint for longer.
- **Persistent config** — locations and window selection are kept in
  `localStorage`, so they survive widget reloads.
- **macOS-native styling** — translucent dark card with backdrop blur,
  SF Pro typography, tabular numerals, hover states.

Default location is Sainte-Lucie-des-Laurentides (46.13°N, 74.30°W).

## Install

```sh
cp rain.jsx ~/Library/Application\ Support/Übersicht/widgets/rain.jsx
```

Übersicht hot-reloads on save. If the widget doesn't appear, check the
menu-bar icon for errors.

## How it works

- The widget no longer uses the `command` shell hook; instead it does its
  own `fetch()` calls from inside React, so the URL can change in response
  to user input (location, window).
- Refresh interval is 6 hours, driven by `setInterval` inside the
  component. `refreshFrequency` is set to `false` so Übersicht doesn't also
  re-fire anything.
- The geocoding API
  (`https://geocoding-api.open-meteo.com/v1/search?name=…`) returns
  lat/lon + IANA timezone, which gets passed through to the data query.

## Customizing the default

Edit `DEFAULT_LOCATIONS` at the top of `rain.jsx` to change what appears
the first time the widget loads (before anything is saved to
`localStorage`).
