# Cards reference

Short description of the options each card understands. Cards are Home Assistant **custom elements** (`type: custom:<name>`); entity ids below are fictitious examples.
Common options: `grid_options: { columns: 12, rows: auto }` (sections view) and, for the cards that support it, `align_bottom: true`
(with `maison-align.js` present, the card stretches so its column ends at the level of the lowest column of the row).

## `maison-interrupteurs-card`

Switch-style tiles. A tap toggles, a long press opens the entity dialog. The glow uses the **real `rgb_color` / colour temperature** of the lamp.

```yaml
type: custom:maison-interrupteurs-card
title: Salon            # optional header
icon: mdi:sofa
master:                 # big tile (e.g. a light group)
  entity: light.demo_living_all
  name: Tout le salon
  color_from: [light.demo_living_lamp]   # colour taken from the first of these lights that is on
collapse: true          # single lamps (items) are folded behind a "Détail des lampes" button
ambiances:              # buttons under the master tile (scenes)
  - { scene: scene.demo_daily, name: Quotidienne, icon: mdi:weather-sunny, color: "#ff4b00" }
items:
  - { entity: light.demo_living_lamp, name: Lampadaire, icon: mdi:floor-lamp }
  - { entity: light.demo_living_shelf, name: Étagère, icon: mdi:lamp, info: { entity: sensor.demo_plug_power, unit: W } }
```

Dimmable lights get a brightness slider (`dimmer: false` to hide it). Works with lights, switches, media players, fans.

## `maison-lumieres-card`

One tile per room, from the **area registry** (lights of the area, or `lights:` as a fallback). `script` is a script with a field `area` that toggles the lights of that area.

```yaml
type: custom:maison-lumieres-card
script: script.toggle_area_lights
groups:
  - title: Rez-de-chaussée
    rooms:
      - { area: living_room, name: Salon, icon: mdi:sofa }
```

## `maison-robot-card`

```yaml
type: custom:maison-robot-card
vacuum: vacuum.demo_ground_floor
name: Robot
battery: sensor.demo_ground_floor_battery
room: sensor.demo_ground_floor_room
color: "#4aa3ff"
rooms:
  select: input_select.demo_rooms        # only its `options` are used (room names)
  script: script.demo_clean_rooms        # script with a field `pieces` (list of room names)
settings:
  - { entity: select.demo_mode, name: Mode, icon: mdi:tune }
  - { entity: switch.demo_dnd, name: Ne pas déranger, icon: mdi:sleep }
```

Rooms are chips you toggle; the button then says “Nettoyer N pièces”.

## `maison-salon-card`

TV (+ optional soundbar) and a remote control (`remote.send_command` with `DPAD_UP`, `HOME`, `VOLUME_UP`…, apps through `remote.turn_on` + `activity`).

```yaml
type: custom:maison-salon-card
collapse_remote: false      # true = the remote is folded behind a button
tv: { media: media_player.demo_tv, remote: remote.demo_tv, name: TV, icon: mdi:television }
bar: { media: media_player.demo_soundbar, name: Barre de son }   # optional
apps: [{ name: Netflix, icon: mdi:netflix, color: "#e50914", activity: "https://www.netflix.com/title" }]
```

## Pets / litter box: `maison-litiere-card`, `maison-reglages-card`, `maison-air-card`, `maison-stats-card`

Gauges with low-level alerts, chips, main / secondary actions with confirmation, collapsible groups of switches / selects / numbers, purifier power + speed 1-5, big-number rows or tiles with “last event” lines.

## System: `maison-debit-card`, `maison-sante-card`, `maison-encre-card`, `maison-maj-card`

* `maison-debit-card`: `tests: [{ entity, name, color, max, invert }]`, `live: { wan, down, up, name }`, `live_first: true`, `compact: true`, `extra: [{ icon, entity, attr, label, warn_h }]`.
* `maison-sante-card`: `rows: [{ label, entity, attr, fmt: ago|when|problem, warn_h, tpl }]` — a banner summarises the worst row (OK / to watch / alert).
* `maison-encre-card`: `items: [{ entity, name, color }]`, `state`, `compact: true`.
* `maison-maj-card`: lists every `update.*` that is `on`, with *See* and *Install* (with confirmation).

## `maison-frigo-card`

`kind` omitted = compartment (`temp`, `setpoint`, `door`, `boost`); `kind: ice` = ice maker + water filter; `kind: compact` = one-line fridge / freezer / power.

## Others

`maison-liste-card` (rows with icon, value and bar, grouped panels), `maison-carte-card` (cropped robot map image with room labels; reloads itself when the tab comes back or the token expires; `refresh` / `refresh_entity` to throttle),
`maison-robots-card` (robot picker with photos), `maison-famille-card` (recipient chips, message popup, call buttons),
`maison-exterieur-card` (two cut-out exterior views that cross-fade).

## `maison-nav.js` — floating navigation button

A round button fixed at the bottom-right of every view of the dashboard (hidden in edit mode): tap = back home, long press / right click = list of all tabs (read from the dashboard config).
On the home view it opens the list directly. `window.MAISON_NAV_DASHBOARD` (url path, default `lovelace`) and optionally `window.MAISON_NAV_HOME` (path of the first view) configure it.
