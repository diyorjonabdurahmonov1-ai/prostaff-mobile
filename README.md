# IshTopish — Mobile (Expo)

Multilingual (uz/ru/en) marketplace app connecting customers with daily workers and service
companies. Built with **Expo SDK 57**, **expo-router** (typed routes), React 19 / RN 0.86.

## Design system
An iOS 17 × Material You hybrid. Tokens live in
[`src/constants/theme.ts`](src/constants/theme.ts); the motion curves that need Reanimated live in
[`src/constants/motion.ts`](src/constants/motion.ts). Light + dark throughout.

| | |
|---|---|
| **Colour** | One brand blue `#1B6EF3` + three semantic accents — green `#12B76A` (online / accepted), amber `#F79009` (pending / timer), rose `#F43F5E` (cancel / reject / ban). Everything else is a neutral. Ink is `#0A0A0A`, canvas `#F8F9FA`, dark-mode page `#0D0D0D`. |
| **Type** | **DM Sans** 600 for anything titular, **Inter** 400 for body. Variants set `fontFamily` and never `fontWeight` — with static faces the family *is* the weight. Full Latin-Extended (oʻ gʻ) and Cyrillic coverage. |
| **Geometry** | 8pt grid (`Space`), cards at 20–28pt continuous corners, 56pt primary buttons at 16pt corners. |
| **Icons** | Phosphor **Duotone**, 24px, 1.5px stroke, never solid-filled. One wrapper — [`components/ui/icon.tsx`](src/components/ui/icon.tsx) — maps every name the app uses, so the whole set swaps from one file. Icons are imported one file deep; the package barrel would pull ~1500 modules into the bundle. |
| **Motion** | Signature curve `cubic-bezier(0.34, 1.56, 0.64, 1)` — overshoots once, no second bounce. Durations: micro 120ms · standard 280ms · page 420ms, never beyond. Stagger: 70ms per list item, 100ms per card. Loops (pulse, shimmer, ripple) are informational only — a pulse on screen always means something is genuinely live. |

Screens compose the primitives in [`src/components/motion/`](src/components/motion) rather than
hand-rolling a `withTiming`; that is what keeps the curve identical everywhere.

### Fonts
Both families are imported **one weight deep** (`@expo-google-fonts/inter/400Regular`). Each
package's barrel `require()`s all 18 of its faces at module scope — importing it costs ~7 MB of
unused TTFs in the bundle.

## Run
```bash
npm install            # if node_modules is missing
npx expo start         # then press a (Android), i (iOS), or w (web)
```
The app talks to the Go backend. Default base URL:
- iOS / web: `http://localhost:8080`
- Android emulator: `http://10.0.2.2:8080` (auto)

Override with an env var (e.g. a LAN IP for a physical device):
```bash
EXPO_PUBLIC_API_URL=http://192.168.1.10:8080 npx expo start
```

Start the backend first (see `../backend/README.md`). Log in with any phone — in dev the server
returns the OTP `dev_code`, which the OTP screen auto-fills. Seeded demo phones:
`+998900000000` (customer + admin), `+998901111111` / `+998902222222` (online workers).

## Verify
```bash
npx tsc --noEmit                       # type check (clean)
npx expo export --platform web         # bundle all routes
```

## Structure
```
src/
  app/                     expo-router routes
    _layout.tsx            providers + auth-gated Stack (Protected groups)
    auth/                  welcome(index) -> login | register -> otp
    (app)/
      (tabs)/              Home (workers | companies) · Orders · Profile
      details, review,     create-order flow: category -> details -> review(modal)
      rate                   -> the order is broadcast to every worker within 15 km
                             and lands in "Mening e'lonlarim" with its countdown
                             running -> first accept wins -> rate(modal)
      orders/[id]          order detail (status-aware actions: cancel / search again /
                             complete / rate)
      worker/              panel (online toggle + incoming jobs as cards) · orders · edit
      company/             panel · [id] (customer view + direct order)
      admin/               dashboard · worker-new / company-new (the only way to open a
                             worker or company account) · users · workers · companies · orders
      wallet               Click/Payme top-up (min 10 000 so'm)
  components/ui/           Icon (Phosphor), Button, Card, Chip, TextField, Segmented,
                             StepDots, ImageStrip, StatusDot, Badge, Avatar, Stars, ...
  components/motion/       FadeUp/PopIn, PulseRing, Shimmer, CountUp, ProgressRing,
                             DotGrid, Sparkline — every animated behaviour in the app
  components/brand-mark.tsx              the logo (briefcase merged into a location pin)
  components/online-toggle.tsx           the worker availability pill
  components/balance-card.tsx            wallet hero with count-up + shimmer
  components/app-map.tsx                 the map — OpenFreeMap + MapLibre in a WebView (.web.tsx = iframe)
  components/map-fallback.tsx            address card shown when the map cannot be drawn
  components/incoming-order-card.tsx     an incoming job as a list card (map, pay, countdown bar)
  store/                   auth · order-flow · realtime (polling)
  i18n/                    uz (default) · ru · en dictionaries
  lib/                     api client · types · format · location · maps · notifications
```

## Notes
- **Realtime** is polling-based (portable). `useWorkerOrders` polls `/worker/orders` and hands the
  still-open invites to the panel and the orders screen; the customer waiting screen polls the
  order until `accepted`/`expired`.
- **Incoming jobs are a list, not a takeover.** A new order arrives as a card the worker answers
  when they choose to — the notification tray does the alerting (`useInviteAlerts` posts a local
  banner, which is also what covers Expo Go, where remote push does not exist).
- **The customer waits in their own listings, not on a dedicated screen.** Placing an order returns
  to "Mening e'lonlarim", where the row carries a live countdown; the list polls every 4 s while
  anything is searching. When the clock reaches zero the server has already closed the order (it
  arms a timer for the exact deadline), so the row flips to "Muddati tugadi" and moves to the
  finished tab by itself. One tap on the order re-opens the search.
- **Wake-up push**: `expo-notifications` handler is configured at root. True background/killed-app
  wake-up needs a dev build + FCM/APNs credentials (out of scope for Expo Go).
- **Location**: `expo-location` with a graceful fallback to central Tashkent when permission is
  denied (useful on simulators).
- **Maps are OpenFreeMap tiles drawn by MapLibre GL JS.** `components/app-map.tsx` renders one
  self-contained HTML page (`buildMapHtml` in `lib/maps.ts`) in a WebView (an `<iframe>` on web).
  Free, no API key, no account, no cookies, no ads, no request limit on the public instance. The
  "© OpenStreetMap / OpenFreeMap" attribution is shown on the map, as both projects require.
  - The tile source is **one constant**, `MAP_STYLE_URL` in `lib/maps.ts`; MapLibre is pinned to an
    exact version (`MAPLIBRE_VERSION`). OpenFreeMap has no SLA — if it ever matters, self-host it
    (or any MapLibre-compatible style) and change that one line.
  - If the map cannot load (no network, no WebGL, no WebView module) `map-fallback.tsx` shows an
    address card with the same hand-off button instead of a grey box.
  - "Directions" / "Open" hand the point to the phone's own default maps app (`openInMaps`:
    `geo:` on Android, Apple Maps on iOS, OpenStreetMap in a browser) — no app is forced.
  - `onPick` turns the map into a picker: the pin is fixed at the centre and you drag the map under
    it, taxi-app style. A map asked to show a radius opens at the zoom where that radius fits
    (`zoomForRadius`), because a 15 km ring on a street-level map is invisible.
- **Bundle identifiers were left alone** (`com.prostaff.app` / `com.anonymous.mobile`). Changing
  them orphans the EAS project, the push credentials and every existing install, so that is a
  release decision rather than a rebrand one. The display name, scheme, icons and splash are all
  IshTopish.
