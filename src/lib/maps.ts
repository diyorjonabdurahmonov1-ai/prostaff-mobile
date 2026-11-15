/**
 * Map plumbing — OpenFreeMap tiles drawn by MapLibre GL JS.
 *
 * Two independent things live here, and they degrade separately:
 *
 *  - **Hand-off** (`openInMaps`) needs nothing: it opens the point in whatever
 *    maps app the phone has set as its default (`geo:` on Android, Apple Maps on
 *    iOS, OpenStreetMap in a browser).
 *  - **The embedded map** (`<AppMap>`) is a MapLibre page inside a WebView. The
 *    tiles come from OpenFreeMap — free, no account, no API key, no cookies, no
 *    ads, no request limit. If the page cannot load (no network, the tile host
 *    is down) the component falls back to a plain address card, so a missing
 *    map costs a picture, never a broken screen.
 *
 * Swapping the tile source is one edit: `MAP_STYLE_URL` below. Self-hosting
 * OpenFreeMap (or any MapLibre-compatible style) needs nothing else.
 */

import { Linking, Platform } from 'react-native';

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * The map style (colours, roads, labels) and, through it, the tile source.
 *
 * `liberty` is OpenFreeMap's full-colour OpenStreetMap style. The public
 * instance has no request limit; if it ever needs replacing, point this at a
 * self-hosted copy.
 */
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

/**
 * MapLibre GL JS, pinned. An exact version, never a range: the map page must
 * not change behaviour because a new release appeared overnight.
 */
export const MAPLIBRE_VERSION = '4.7.1';
const MAPLIBRE_JS = `https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js`;
const MAPLIBRE_CSS = `https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css`;

/** Default map zoom — close enough to read the street, wide enough to orient. */
export const DEFAULT_ZOOM = 16;

/**
 * How far the zoom buttons may travel.
 *
 * Below 10 a city is a smudge and the pin means nothing; the useful range for
 * "where exactly is this job" starts around the district and ends at the
 * building.
 */
export const MIN_ZOOM = 10;
export const MAX_ZOOM = 19;

/** Web URL for a pin — OpenStreetMap, which works in any browser. */
export function osmUrl({ lat, lng }: LatLng, zoom = DEFAULT_ZOOM): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`;
}

/**
 * Opens a point in the phone's own maps app.
 *
 *  - Android: a `geo:` link, which the system hands to whichever maps app the
 *    user has chosen as default (Google Maps, 2GIS, Organic Maps…).
 *  - iOS: Apple Maps (`maps:`), with `daddr` for turn-by-turn when `route`.
 *  - Anywhere else, or if the phone has nothing for that link: OpenStreetMap.
 *
 * `route` asks for directions instead of a pin. We never force one app on the
 * user — they already picked the one they like.
 */
export async function openInMaps(point: LatLng, route = false): Promise<void> {
  const { lat, lng } = point;
  const native =
    Platform.OS === 'android'
      ? `geo:${lat},${lng}?q=${lat},${lng}`
      : Platform.OS === 'ios'
        ? route
          ? `http://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`
          : `http://maps.apple.com/?ll=${lat},${lng}&q=${lat},${lng}`
        : null;

  try {
    // No canOpenURL pre-check: on Android 11+ it answers false for schemes the app
    // has not declared, which would send everyone to the browser. openURL itself
    // rejects when nothing can handle the link, and the catch below covers that.
    if (native) {
      await Linking.openURL(native);
      return;
    }
  } catch {
    // fall through to the web map
  }
  await Linking.openURL(
    route ? `https://www.openstreetmap.org/directions?to=${lat}%2C${lng}` : osmUrl(point),
  );
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

/** How long the page waits for the map library before giving up on it. */
const MAP_LOAD_TIMEOUT_MS = 12000;

/**
 * The map's state as JSON, safe to embed in a `<script>` block.
 *
 * Also the payload of a live update: `window.__update(json)` re-applies it to a
 * running map, so moving the pin does not mean downloading the whole map
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
 * Zoom numbers on the wire use the 256px-tile scale the rest of the app was
 * written against (`DEFAULT_ZOOM`, `zoomForRadius`); MapLibre counts 512px tiles,
 * which is exactly one step lower, so the page converts with `ZOFF`.
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
  const lang = options.lang === 'ru' || options.lang === 'en' ? options.lang : 'uz';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="${MAPLIBRE_CSS}" />
  <style>
    html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #E9EDF2; }
    /* The attribution OpenStreetMap and OpenFreeMap ask for stays visible, but is
       plain text: a tap on it must not try to navigate the card away. */
    .maplibregl-ctrl-attrib { font: 10px/1.4 sans-serif; }
    .maplibregl-ctrl-attrib a { pointer-events: none; color: inherit; text-decoration: none; }
    .maplibregl-ctrl-attrib-button { display: none !important; }
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
</head>
<body>
  <div id="map"></div>
  <script src="${MAPLIBRE_JS}"></script>
  <script>
    var CFG = ${config};
    var LANG = '${lang}';
    var ZOFF = 1;
    var settled = false;
    function send(msg) {
      try {
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
        else if (window.parent !== window) window.parent.postMessage(JSON.stringify(msg), '*');
      } catch (e) {}
    }
    function fail() {
      if (!settled) { settled = true; send({ type: 'error' }); }
    }
    // The product's own pin (see the picker below) in the app's colours.
    function pinSvg(color) {
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="42" viewBox="0 0 24 30">' +
        '<path d="M12 0.5C6.2 0.5 1.8 4.9 1.8 10.4 1.8 17.6 10.7 28 12 29.5c1.3-1.5 10.2-11.9 10.2-19.1C22.2 4.9 17.8 0.5 12 0.5z" fill="#fff" opacity=".9"/>' +
        '<path d="M12 2c-5 0-9 3.8-9 8.4C3 16.6 12 26.6 12 26.6S21 16.6 21 10.4C21 5.8 17 2 12 2z" fill="' + color + '"/>' +
        '<circle cx="12" cy="10.2" r="3.4" fill="#fff"/></svg>');
    }
    // A circle of radius r metres around [lat, lng], as a GeoJSON polygon.
    function circle(c, r) {
      var pts = [], d = r / 6371008.8, la0 = c[0] * Math.PI / 180, lo0 = c[1] * Math.PI / 180;
      for (var i = 0; i <= 72; i++) {
        var b = 2 * Math.PI * i / 72;
        var la = Math.asin(Math.sin(la0) * Math.cos(d) + Math.cos(la0) * Math.sin(d) * Math.cos(b));
        var lo = lo0 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la0), Math.cos(d) - Math.sin(la0) * Math.sin(la));
        pts.push([lo * 180 / Math.PI, la * 180 / Math.PI]);
      }
      return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [pts] }, properties: {} };
    }

    function start() {
      var map;
      try {
        map = new maplibregl.Map({
          container: 'map',
          style: '${MAP_STYLE_URL}',
          center: [CFG.center[1], CFG.center[0]],
          zoom: CFG.zoom - ZOFF,
          minZoom: ${MIN_ZOOM} - ZOFF,
          maxZoom: ${MAX_ZOOM} - ZOFF,
          attributionControl: { compact: false },
          dragRotate: false,
          pitchWithRotate: false,
          fadeDuration: 0
        });
      } catch (e) { fail(); return; }
      // North stays up: a rotated map in a job card is just a confusing one.
      map.touchZoomRotate.disableRotation();
      var lastZoom = CFG.zoom;
      var markers = [];

      // Labels in the app's language where the map data has them; the local
      // name stays as the fallback so nothing goes blank.
      function localise() {
        map.getStyle().layers.forEach(function (layer) {
          if (layer.type === 'symbol' && layer.layout && layer.layout['text-field']) {
            map.setLayoutProperty(layer.id, 'text-field',
              ['coalesce', ['get', 'name:' + LANG], ['get', 'name:latin'], ['get', 'name']]);
          }
        });
      }

      function drawRing(centre, radius) {
        var src = map.getSource('ring');
        var data = radius > 0 ? circle(centre, radius) : { type: 'FeatureCollection', features: [] };
        if (src) { src.setData(data); return; }
        map.addSource('ring', { type: 'geojson', data: data });
        map.addLayer({ id: 'ring-fill', type: 'fill', source: 'ring',
          paint: { 'fill-color': '#1B6EF3', 'fill-opacity': 0.12 } });
        map.addLayer({ id: 'ring-line', type: 'line', source: 'ring',
          paint: { 'line-color': '#1B6EF3', 'line-opacity': 0.7, 'line-width': 2 } });
      }

      function drawPins(list) {
        markers.forEach(function (m) { m.remove(); });
        markers = list.map(function (m) {
          var el = document.createElement('img');
          el.src = pinSvg(m.color);
          el.style.width = '34px';
          el.style.height = '42px';
          var marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([m.coords[1], m.coords[0]]);
          if (m.hint) {
            marker.setPopup(new maplibregl.Popup({ offset: 40, closeButton: false }).setText(m.hint));
          }
          return marker.addTo(map);
        });
      }

      /**
       * Re-apply state to the running map. Called from the app instead of
       * rebuilding this document — a rebuild remounts the WebView and fetches
       * the whole map library again, which on a phone is a visible stall.
       */
      window.__update = function (json) {
        try {
          var next = JSON.parse(json);
          map.easeTo({ center: [next.center[1], next.center[0]], zoom: next.zoom - ZOFF, duration: 250 });
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
        var current = map.getZoom() + ZOFF;
        var next = Math.max(${MIN_ZOOM}, Math.min(${MAX_ZOOM}, Math.round(current) + delta));
        if (next !== current) map.easeTo({ zoom: next - ZOFF, duration: 200 });
      };

      // Pinching is the other way to zoom, and the buttons have to know about
      // it — otherwise a map pinched to the limit still shows a live "+".
      // Reported once the gesture settles, not on every frame of it.
      map.on('zoomend', function () {
        var z = Math.round((map.getZoom() + ZOFF) * 100) / 100;
        if (Math.abs(z - lastZoom) > 0.01) {
          lastZoom = z;
          send({ type: 'zoom', zoom: z });
        }
      });

      // The window can change size (rotation, keyboard); without this the map
      // keeps the old viewport and the centre stops being the centre.
      window.addEventListener('resize', function () { map.resize(); });

      map.on('load', function () {
        if (settled) return;
        settled = true;
        try { localise(); } catch (e) {}
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
          map.on('movestart', function (e) { if (e.originalEvent) lift(true); });
          // Only report when the user's own gesture ends, never for the moves the
          // app makes itself (an update would otherwise echo straight back), and
          // never on every frame of a drag, which would flood the bridge.
          // NB: no backticks in here — this comment lives inside the template
          // literal that builds the page, and one would close it.
          map.on('moveend', function (e) {
            lift(false);
            if (!e.originalEvent) return;
            var c = map.getCenter();
            send({ type: 'pick', lat: c.lat, lng: c.lng });
          });
        } else {
          drawPins(CFG.markers);
        }
        send({ type: 'ready' });
      });

      // The style itself failing to load (host down, blocked) is fatal. A single
      // missing tile later is not, and must not tear the map down.
      map.on('error', function (e) {
        if (!settled && e && e.error && !e.tile) fail();
      });
    }

    // A hung request is the failure that used to leave a shimmering grey card
    // forever: nothing errors, it simply never arrives. Past the deadline the
    // app is told, and it falls back to the address card.
    setTimeout(fail, ${MAP_LOAD_TIMEOUT_MS});

    if (window.maplibregl) start(); else fail();
  </script>
</body>
</html>`;
}
