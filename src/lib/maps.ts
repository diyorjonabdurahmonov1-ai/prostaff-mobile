/**
 * Yandex Maps plumbing.
 *
 * Two independent things live here, and they degrade separately:
 *
 *  - **Deep links** (`yandexMapsUrl`, `yandexRouteUrl`) need no key and always
 *    work — they hand the point to the Yandex Maps app, or to maps.yandex.uz in
 *    a browser when the app is not installed.
 *  - **The embedded map** (`<YandexMap>`) needs a JS API key. Put it in
 *    `EXPO_PUBLIC_YANDEX_MAPS_API_KEY` (see `.env.example`). Without one the
 *    component falls back to a static card, so a missing key costs a nice map,
 *    never a broken screen.
 */

import { Linking, Platform } from 'react-native';

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * JS API key, or empty when the project has not been given one.
 *
 * Optional: `api-maps.yandex.ru/2.1/` serves the whole library without one. A
 * key raises the request quota and lets the usage show up in Yandex's console,
 * so it is worth setting — but the map does not wait for it.
 */
export const YANDEX_API_KEY = process.env.EXPO_PUBLIC_YANDEX_MAPS_API_KEY ?? '';

export const hasYandexKey = YANDEX_API_KEY.length > 0;

/** Default map zoom — close enough to read the street, wide enough to orient. */
export const DEFAULT_ZOOM = 16;

/**
 * How far the zoom buttons may travel.
 *
 * Below 10 a city is a smudge and the pin means nothing; the useful range for
 * "where exactly is this job" starts around the district and ends at the
 * building.
 *
 * The two maps stop in different places because their imagery does. The static
 * endpoint serves nothing past 17 — asking for more returns the same picture
 * with a bigger scale bar, which reads as a broken zoom — while the JS API keeps
 * going, and those extra steps are exactly what somebody dropping a pin on a
 * particular entrance needs.
 */
export const MIN_ZOOM = 10;
export const MAX_STATIC_ZOOM = 17;
export const MAX_ZOOM = 19;

/**
 * Map labels in the user's language.
 *
 * The two Yandex endpoints do not accept the same set. The static API takes
 * `uz_UZ` and renders Uzbek street names; the JS API 2.1 does not, and an
 * unsupported locale there makes it fall back to Russian anyway — so Uzbek
 * users get the Russian cartography they are used to on the interactive map,
 * and proper Uzbek on the static one.
 */
export function staticMapLang(lang: string): string {
  return lang === 'en' ? 'en_US' : lang === 'uz' ? 'uz_UZ' : 'ru_RU';
}

export function jsApiLang(lang: string): string {
  return lang === 'en' ? 'en_US' : 'ru_RU';
}

/** Web URL for a pin. Opens the Yandex Maps app when it is installed. */
export function yandexMapsUrl({ lat, lng }: LatLng, zoom = DEFAULT_ZOOM): string {
  return `https://yandex.uz/maps/?ll=${lng},${lat}&z=${zoom}&pt=${lng},${lat},pm2rdm`;
}

/** Web URL for driving directions from wherever the user is to the point. */
export function yandexRouteUrl({ lat, lng }: LatLng): string {
  return `https://yandex.uz/maps/?rtext=~${lat},${lng}&rtt=auto`;
}

/**
 * Opens a point in Yandex Maps: the native app first (`yandexmaps://`), the
 * website if it is not installed. `route` asks for directions instead of a pin.
 */
export async function openInYandex(point: LatLng, route = false): Promise<void> {
  const app = route
    ? `yandexmaps://build_route_on_map?lat_to=${point.lat}&lon_to=${point.lng}`
    : `yandexmaps://maps.yandex.ru/?pt=${point.lng},${point.lat}&z=${DEFAULT_ZOOM}&l=map`;
  const web = route ? yandexRouteUrl(point) : yandexMapsUrl(point);

  try {
    // canOpenURL needs the scheme declared (iOS LSApplicationQueriesSchemes);
    // if it is not, we simply go to the web map rather than failing.
    if (Platform.OS !== 'web' && (await Linking.canOpenURL(app))) {
      await Linking.openURL(app);
      return;
    }
  } catch {
    // fall through to the web map
  }
  await Linking.openURL(web);
}

/** True when the coordinates are a real fix rather than an unset 0,0. */
export function hasCoords(point?: Partial<LatLng> | null): point is LatLng {
  return (
    !!point &&
    typeof point.lat === 'number' &&
    typeof point.lng === 'number' &&
    (point.lat !== 0 || point.lng !== 0)
  );
}

/* ------------------------------------------------------------------ *
 * Static maps — a real Yandex map as a plain image
 * ------------------------------------------------------------------ */
//
// This path needs neither an API key nor a native module, which is what makes
// it the safe default: it renders in Expo Go and in any dev build, old or new.
// The interactive WebView map is the upgrade, not the baseline.

/** Largest image the static API will return. */
const STATIC_MAX = { width: 650, height: 450 };

/** Web-Mercator pixel coordinates at a given zoom. */
export function worldFromLatLng({ lat, lng }: LatLng, zoom: number): { x: number; y: number } {
  const size = 256 * 2 ** zoom;
  const latRad = (Math.min(85.05112878, Math.max(-85.05112878, lat)) * Math.PI) / 180;
  return {
    x: ((lng + 180) / 360) * size,
    y: ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * size,
  };
}

/** Inverse of `worldFromLatLng` — what a tap on the image actually points at. */
export function latLngFromWorld(point: { x: number; y: number }, zoom: number): LatLng {
  const size = 256 * 2 ** zoom;
  return {
    lng: (point.x / size) * 360 - 180,
    lat: (Math.atan(Math.sinh(Math.PI * (1 - (2 * point.y) / size))) * 180) / Math.PI,
  };
}

/**
 * A Yandex static-map image URL. Keyless (the 1.x endpoint), so this is what
 * every device can render regardless of build or API key.
 *
 * Deliberately **cartography only** — no `pt=` pins, no `pl=` overlays. Yandex's
 * stock balloon markers look nothing like the rest of the app, so pins and the
 * search radius are drawn on top in React Native instead, where they can use the
 * product's own shapes and colours (see `static-yandex-map.tsx`).
 */
export function staticMapUrl(options: {
  center: LatLng;
  zoom: number;
  width: number;
  height: number;
  /** App language — the endpoint speaks uz_UZ, so street names can be Uzbek. */
  lang?: string;
}): string {
  const { width, height } = staticMapSize(options.width, options.height);
  const params = [
    `ll=${options.center.lng.toFixed(6)},${options.center.lat.toFixed(6)}`,
    `z=${Math.round(options.zoom)}`,
    `size=${width},${height}`,
    'l=map',
    `lang=${staticMapLang(options.lang ?? 'uz')}`,
  ];
  return `https://static-maps.yandex.ru/1.x/?${params.join('&')}`;
}

/** Metres one map pixel covers at this latitude and zoom. */
export function metresPerPixel(lat: number, zoom: number): number {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}

/**
 * The zoom at which a radius ring actually fits in the card.
 *
 * A 15 km ring on a street-level map is a circle the size of a city — invisible,
 * and therefore pointless. When a map is asked to show a radius, it should open
 * at the zoom where that radius is the subject of the picture.
 */
export function zoomForRadius(radiusKm: number, heightPx: number, lat: number): number {
  // Let the diameter take ~70% of the height, so the ring has air around it.
  const needed = (radiusKm * 2000) / Math.max(1, heightPx * 0.7);
  const zoom = Math.log2((156543.03392 * Math.cos((lat * Math.PI) / 180)) / needed);
  return Math.max(3, Math.min(17, Math.floor(zoom)));
}

/**
 * The image size the static API will actually return for a card of this size.
 *
 * Scaled down as a whole rather than clamped per axis: the card's proportions
 * have to survive, or `cover` crops the image and every tap lands somewhere
 * other than where the finger was.
 */
export function staticMapSize(width: number, height: number): { width: number; height: number } {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const scale = Math.min(1, STATIC_MAX.width / safeWidth, STATIC_MAX.height / safeHeight);
  return {
    width: Math.max(50, Math.round(safeWidth * scale)),
    height: Math.max(50, Math.round(safeHeight * scale)),
  };
}

/* ------------------------------------------------------------------ *
 * The map document
 * ------------------------------------------------------------------ */

export interface MapMarker extends LatLng {
  id?: string;
  /** Short label shown in the balloon when the pin is tapped. */
  hint?: string;
  /** Marker colour — defaults to the brand pin. */
  color?: 'primary' | 'success' | 'warning';
}

const PIN_COLORS: Record<NonNullable<MapMarker['color']>, string> = {
  primary: '#1B6EF3',
  success: '#12B76A',
  warning: '#F79009',
};

/** How long the page waits for the Yandex JS API before giving up on it. */
const MAP_LOAD_TIMEOUT_MS = 12000;

/**
 * The `<script>` that loads the map library.
 *
 * `apikey` is left off entirely when there is no key, rather than sent empty:
 * an empty parameter is a malformed key, and it costs nothing to omit a
 * parameter the endpoint treats as optional.
 */
export function jsApiUrl(lang: string): string {
  const params = [`lang=${jsApiLang(lang)}`];
  if (hasYandexKey) params.unshift(`apikey=${encodeURIComponent(YANDEX_API_KEY)}`);
  return `https://api-maps.yandex.ru/2.1/?${params.join('&')}`;
}

/**
 * The map's state as JSON, safe to embed in a `<script>` block.
 *
 * Also the payload of a live update: `window.__update(json)` re-applies it to a
 * running map, so moving the pin does not mean downloading the whole Yandex JS
 * API again.
 */
export function mapConfigJson(options: {
  markers: MapMarker[];
  center: LatLng;
  zoom: number;
  radiusKm?: number;
  pickable: boolean;
}): string {
  return (
    JSON.stringify({
      center: [options.center.lat, options.center.lng],
      zoom: options.zoom,
      radius: options.radiusKm ? options.radiusKm * 1000 : 0,
      pickable: options.pickable,
      markers: options.markers.map((m) => ({
        coords: [m.lat, m.lng],
        hint: m.hint ?? '',
        color: PIN_COLORS[m.color ?? 'primary'],
      })),
    })
      // Pin labels are user-entered; a stray "</script>" must not end the block.
      .replace(/</g, '\\u003c')
  );
}

/**
 * The whole map as one self-contained HTML document — the same markup drives
 * the native WebView and the web iframe, so the map looks and behaves
 * identically on every platform.
 *
 * It talks back through `ReactNativeWebView.postMessage` when it has one and
 * `parent.postMessage` otherwise; both carry the same `{type, lat, lng}`.
 */
export function buildMapHtml(options: {
  markers: MapMarker[];
  center: LatLng;
  zoom: number;
  radiusKm?: number;
  pickable: boolean;
  lang?: string;
}): string {
  const config = mapConfigJson(options);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <style>
    html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #E9EDF2; }
    .ymaps-2-1-79-map-copyrights-promo { display: none !important; }
    /* The pin that stays put while the map moves under it. */
    #pin {
      position: absolute; left: 50%; top: 50%; margin-left: -17px; margin-top: -42px;
      width: 34px; height: 42px; pointer-events: none; z-index: 5;
      transition: transform .12s ease-out;
    }
    #pin.lifted { transform: translateY(-6px); }
    #shadow {
      position: absolute; left: 50%; top: 50%; margin-left: -6px; margin-top: -3px;
      width: 12px; height: 5px; border-radius: 50%; background: rgba(0,0,0,.32);
      pointer-events: none; z-index: 4; transition: all .12s ease-out;
    }
    #shadow.lifted { width: 18px; margin-left: -9px; background: rgba(0,0,0,.18); }
  </style>
  <script src="${jsApiUrl(options.lang ?? 'uz')}"></script>
</head>
<body>
  <div id="map"></div>
  <script>
    var CFG = ${config};
    function send(msg) {
      try {
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
        else if (window.parent !== window) window.parent.postMessage(JSON.stringify(msg), '*');
      } catch (e) {}
    }
    // The product's own pin (see components/map-pin.tsx) — Yandex's stock
    // balloon belongs to a different design language.
    function pinSvg(color) {
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="42" viewBox="0 0 24 30">' +
        '<path d="M12 0.5C6.2 0.5 1.8 4.9 1.8 10.4 1.8 17.6 10.7 28 12 29.5c1.3-1.5 10.2-11.9 10.2-19.1C22.2 4.9 17.8 0.5 12 0.5z" fill="#fff" opacity=".9"/>' +
        '<path d="M12 2c-5 0-9 3.8-9 8.4C3 16.6 12 26.6 12 26.6S21 16.6 21 10.4C21 5.8 17 2 12 2z" fill="' + color + '"/>' +
        '<circle cx="12" cy="10.2" r="3.4" fill="#fff"/></svg>');
    }
    function pin(color) {
      return {
        iconLayout: 'default#image',
        iconImageHref: pinSvg(color),
        iconImageSize: [34, 42],
        iconImageOffset: [-17, -42]
      };
    }
    function start() {
      settled = true;
      // No Yandex controls: the app draws its own +/- (components/map-zoom.tsx)
      // and talks to window.__zoom below, so a map card matches every other
      // card in the product instead of wearing Yandex's furniture.
      var map = new ymaps.Map('map', {
        center: CFG.center, zoom: CFG.zoom, controls: []
      }, { suppressMapOpenBlock: true, yandexMapDisablePoiInteractivity: true });
      // What the app last believes the zoom to be, so a pinch can be reported
      // once rather than on every frame of it.
      var lastZoom = CFG.zoom;

      // Markers and the ring live in their own collections so an update can
      // replace them without touching the map or reloading the API.
      var pins = new ymaps.GeoObjectCollection();
      var rings = new ymaps.GeoObjectCollection();
      map.geoObjects.add(rings);
      map.geoObjects.add(pins);

      function drawRing(centre, radius) {
        rings.removeAll();
        if (radius > 0) {
          rings.add(new ymaps.Circle([centre, radius], {}, {
            fillColor: '#1B6EF31F', strokeColor: '#1B6EF3', strokeOpacity: 0.7, strokeWidth: 2
          }));
        }
      }

      function drawPins(list) {
        pins.removeAll();
        list.forEach(function (m) {
          pins.add(new ymaps.Placemark(m.coords,
            { hintContent: m.hint, balloonContent: m.hint }, pin(m.color)));
        });
      }

      /**
       * Re-apply state to the running map. Called from the app instead of
       * rebuilding this document — a rebuild remounts the WebView and fetches
       * the entire Yandex JS API again, which on a phone is a visible stall.
       */
      window.__update = function (json) {
        try {
          var next = JSON.parse(json);
          map.setCenter(next.center, next.zoom, { duration: 250 });
          lastZoom = next.zoom;
          drawRing(next.center, next.radius);
          if (!next.pickable) drawPins(next.markers);
        } catch (e) {}
      };

      /**
       * One step of zoom, from the app's own +/- buttons.
       *
       * Clamped here as well as in the app: the buttons go flat at the ends of
       * the range, but a rounding difference between the two sides must not be
       * able to ask this map for a zoom it has no tiles for.
       */
      window.__zoom = function (delta) {
        var next = Math.max(${MIN_ZOOM}, Math.min(${MAX_ZOOM}, map.getZoom() + delta));
        if (next !== map.getZoom()) map.setZoom(next, { duration: 200 });
      };

      // Pinching is the other way to zoom, and the buttons have to know about
      // it — otherwise a map pinched to the limit still shows a live "+".
      // Only a changed zoom is reported: boundschange also fires on every pan.
      map.events.add('boundschange', function () {
        var z = map.getZoom();
        if (z !== lastZoom) {
          lastZoom = z;
          send({ type: 'zoom', zoom: z });
        }
      });

      // The window can change size (rotation, keyboard); without this the map
      // keeps the old viewport and the centre stops being the centre.
      window.addEventListener('resize', function () {
        map.container.fitToViewport();
      });

      drawRing(CFG.center, CFG.radius);

      // While picking, the pin is a fixed overlay at the centre of the map —
      // you drag the map, not the pin, exactly like ordering a taxi.
      if (CFG.pickable) {
        var shadow = document.createElement('div');
        shadow.id = 'shadow';
        document.body.appendChild(shadow);
        var marker = document.createElement('img');
        marker.id = 'pin';
        marker.src = pinSvg('#1B6EF3');
        document.body.appendChild(marker);

        var lift = function (on) {
          marker.className = on ? 'lifted' : '';
          shadow.className = on ? 'lifted' : '';
        };
        map.events.add('actionbegin', function () { lift(true); });
        // Only report on gesture end. A boundschange event fires on every frame
        // during a drag, which floods the bridge and forces the parent (and the
        // static fallback beneath it) to re-render on every pixel of motion.
        // NB: no backticks in here — this comment lives inside the template
        // literal that builds the page, and one would close it.
        map.events.add('actionend', function () {
          lift(false);
          var c = map.getCenter();
          send({ type: 'pick', lat: c[0], lng: c[1] });
        });
      } else {
        drawPins(CFG.markers);
      }
      send({ type: 'ready' });
    }

    // A hung request is the failure that used to leave a shimmering grey card
    // forever: the script never errors, it simply never arrives. Past the
    // deadline the app is told, and it falls back to the static map.
    var settled = false;
    setTimeout(function () {
      if (!settled) { settled = true; send({ type: 'error' }); }
    }, ${MAP_LOAD_TIMEOUT_MS});

    if (window.ymaps) { ymaps.ready(start); } else { settled = true; send({ type: 'error' }); }
  </script>
</body>
</html>`;
}
