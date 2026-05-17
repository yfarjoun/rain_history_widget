# rain_history_widget

An [Übersicht](https://tracesof.net/uebersicht/) widget that shows recent
precipitation totals for one or more places on your macOS desktop, using
[Open-Meteo](https://open-meteo.com/)'s free forecast + archive APIs.

- **Multiple locations** — add any place via Open-Meteo's geocoding search;
  they stack in a single card.
- **Time-window picker** — 1d / 7d / 14d / 30d / 90d. Uses the forecast
  endpoint (`past_days`) for windows up to 92 days and falls back to the
  archive endpoint beyond that.
- **Persistent config** — locations and window selection are kept in
  `localStorage`, so they survive widget reloads.
- **macOS-native styling** — translucent dark card with backdrop blur,
  SF Pro typography, tabular numerals, hover/active states.

Default location is Sainte-Lucie-des-Laurentides, QC (46.13°N, 74.30°W).

---

## Quick start

```sh
git clone https://github.com/yfarjoun/rain_history_widget.git ~/.rain_history_widget
cd ~/.rain_history_widget
./install.sh
```

`install.sh` checks that Übersicht is installed (and offers to install it
via Homebrew if not), then copies `rain.jsx` into Übersicht's widgets
directory. The widget appears as soon as Übersicht picks it up — usually
within a second.

> Übersicht's file watcher ignores symlinks, so the installer uses a plain
> copy. That means a bare `git pull` doesn't update the live widget — use
> the `--update` flag below, which pulls *and* re-copies.

To update later:

```sh
cd ~/.rain_history_widget
./install.sh --update      # git pull + re-copy
```

To uninstall:

```sh
./install.sh --remove
```

---

## Installing Übersicht (if you don't have it)

Übersicht is a free macOS app that lets you put widgets on your desktop
wallpaper. You only need to install it once.

**Option A — Homebrew (recommended):**

```sh
brew install --cask ubersicht
```

(`install.sh` will offer to do this for you if it doesn't find Übersicht.)

**Option B — Direct download:**

Get the latest release from <https://tracesof.net/uebersicht/> and drag
`Übersicht.app` into `/Applications`.

**After installing, launch the app once.** Look for its small icon in the
menu bar (top-right of the screen) — that's where errors and the widget
list live. If macOS prompts you about Screen Recording or Accessibility
permissions, those aren't required for this widget; you can skip them.

---

## Manual install (no script)

If you'd rather not run `install.sh`:

```sh
cp rain.jsx ~/Library/Application\ Support/Übersicht/widgets/rain.jsx
```

Re-run that `cp` after a `git pull` to update. (Symlinks don't work —
Übersicht's file watcher ignores them.)

---

## Using the widget

- The widget appears in the top-right of the desktop by default. Edit
  `top` / `right` in the `className` block at the bottom of `rain.jsx` to
  move it.
- Click the **⚙ gear icon** to add or remove locations. Typing in the
  search box queries Open-Meteo's free geocoding API and shows matches —
  click one to add it.
- Click any of the **window buttons** (1d / 7d / 14d / 30d / 90d) to
  change how far back the precipitation total covers.
- Your choices are saved to `localStorage`, so they persist across widget
  reloads, restarts, and updates.

---

## Troubleshooting

- **Widget doesn't appear:** open the Übersicht menu-bar icon → click
  "Open widgets directory" and confirm `rain.jsx` is there. The menu also
  surfaces any JavaScript errors.
- **Values show `—`:** Open-Meteo refused or returned no data. Hover the
  dash to see the HTTP error. Check your internet connection.
- **Blur looks wrong / no transparency:** older macOS versions may not
  support `backdrop-filter`. The card will still render with the solid
  semi-transparent background.

---

## How it works

- The widget no longer uses Übersicht's `command` shell hook; instead it
  does its own `fetch()` calls from inside React, so the URL can change
  in response to user input (location, window).
- Refresh interval is 6 hours, driven by `setInterval` inside the
  component. `refreshFrequency` is set to `false` so Übersicht doesn't
  also fire its own refresh.
- The geocoding API
  (`https://geocoding-api.open-meteo.com/v1/search?name=…`) returns
  lat/lon + IANA timezone, which gets passed through to the data query.

## Customizing the default

Edit `DEFAULT_LOCATIONS` at the top of `rain.jsx` to change what appears
the first time the widget loads (before anything is saved to
`localStorage`).
