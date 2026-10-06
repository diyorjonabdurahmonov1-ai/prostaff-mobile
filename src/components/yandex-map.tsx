/**
 * A real Yandex map, in whichever form the device can actually render.
 *
 * Two implementations, picked at runtime:
 *
 *  1. **Interactive** — the Yandex JS API (2.1) inside a WebView. Needs the
 *     `react-native-webview` native module, so it only appears in a build that
 *     was compiled with it. It does *not* need an API key: the endpoint serves
 *     the library without one, and a key only raises the quota.
 *  2. **Static** — `static-yandex-map.tsx`, a real Yandex map served as a PNG.
 *     No native module, so it still renders in a dev build made before the
 *     WebView was added. Kept as the fallback for when the JS API cannot be
 *     reached at all. Supports pins, the radius ring, zoom and tap-to-pick.
 *
 * The choice is silent: a screen asks for a map and gets the best one available,
 * which is why requiring the WebView is wrapped in a try/catch — importing it
 * without the native module throws at module scope.
 *
 * Modes: **preview** (default; display-only, the card hands off to the Yandex
 * Maps app), **interactive** (pan/zoom stay with the map) and **picker**
 * (`onPick` reports the coordinate the user chose).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/text';

import { MapZoom } from '@/components/map-zoom';
import { Shimmer } from '@/components/motion';
import { StaticYandexMap } from '@/components/static-yandex-map';
import { Icon } from '@/components/ui/icon';
import { Hairline, Radius, Shadow, Squircle, Type } from '@/constants/theme';
import { useTheme, useThemeMode } from '@/hooks/use-theme';
import { useI18n, useT } from '@/i18n';
import {
  DEFAULT_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  buildMapHtml,
  mapConfigJson,
  openInYandex,
  zoomForRadius,
  type LatLng,
  type MapMarker,
} from '@/lib/maps';

/** Longer than the document's own deadline, so its error message wins. */
export const LOAD_TIMEOUT_MS = 15000;

export type { MapMarker };

/**
 * The WebView, if this binary has it. Importing the package evaluates
 * `TurboModuleRegistry.getEnforcing('RNCWebViewModule')`, which throws when the
 * native module is missing — so the require is guarded and a failure simply
 * means the static map is used instead.
 */
type WebViewComponent = typeof import('react-native-webview').WebView;
type WebViewMessage = import('react-native-webview').WebViewMessageEvent;

const WebView: WebViewComponent | null = (() => {
  try {
    // Deliberately a require: a static import cannot be caught, and importing
    // the package without its native module throws at module scope.
    return require('react-native-webview').WebView as WebViewComponent;
  } catch {
    return null;
  }
})();

export interface YandexMapProps {
  /** Centre of the map and, unless `markers` is given, the single pin. */
  point: LatLng;
  markers?: MapMarker[];
  zoom?: number;
  height?: number;
  /** Draws a translucent circle of this radius (km) around `point`. */
  radiusKm?: number;
  /** Lets the map keep pan/zoom gestures. Implied by `onPick`. */
  interactive?: boolean;
  /** Turns the map into a location picker. */
  onPick?: (point: LatLng) => void;
  /** The hand-off button asks for directions instead of showing a pin. */
  route?: boolean;
  /** Small caption pinned to the top-left of the card. */
  caption?: string;
  /** Hide the "open in Yandex Maps" pill (e.g. while picking a location). */
  hideOpenButton?: boolean;
  /**
   * Makes the whole card a button.
   *
   * Nothing happens when a display-only map is tapped unless this is given. It
   * used to hand off to the Yandex Maps app, so a stray tap while scrolling
   * threw the user out of the app entirely — leaving the app is a decision, and
   * the pill in the corner is where it is made.
   */
  onPress?: () => void;
}

export function YandexMap(props: YandexMapProps) {
  const resolved = { ...props, zoom: resolveZoom(props) };
  // No WebView in this binary: the static map is a real map too. A missing API
  // key is not a reason to fall back — the JS API serves itself without one.
  if (!WebView) return <StaticYandexMap {...resolved} />;
  return <InteractiveYandexMap {...resolved} />;
}

/**
 * A map showing a search radius should open wide enough to show it; a map you
 * are dropping a pin on should open at street level. Callers can still say.
 */
export function resolveZoom({ zoom, radiusKm, onPick, height = 200, point }: YandexMapProps): number {
  if (zoom) return zoom;
  if (radiusKm && !onPick) return zoomForRadius(radiusKm, height, point.lat);
  return DEFAULT_ZOOM;
}

function InteractiveYandexMap({
  point,
  markers,
  zoom = DEFAULT_ZOOM,
  height = 200,
  radiusKm,
  interactive = false,
  onPick,
  route = false,
  caption,
  hideOpenButton = false,
  onPress,
}: YandexMapProps) {
  const t = useT();
  const { lang } = useI18n();
  const theme = useTheme();
  const dark = useThemeMode() === 'dark';
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  /**
   * Where the map actually is, which is not the same as the `zoom` prop.
   *
   * The user can move it — with the buttons or by pinching — and the map reports
   * back. Kept here so the buttons can go flat at the ends of the range, and so
   * the updates pushed into the running map carry the zoom the user chose
   * rather than resetting them to the one the screen opened at.
   */
  const [zoomLevel, setZoomLevel] = useState(zoom);

  const pickable = !!onPick;
  const canPan = interactive || pickable;

  // A caller that changes the zoom (a radius that grew, a different card) has
  // to be able to move a map that has already mounted.
  const [lastZoomProp, setLastZoomProp] = useState(zoom);
  if (zoom !== lastZoomProp) {
    setLastZoomProp(zoom);
    setZoomLevel(zoom);
  }

  const pins: MapMarker[] = useMemo(
    () => (markers && markers.length > 0 ? markers : [{ ...point }]),
    [markers, point],
  );

  /**
   * The document is built once and then *updated*.
   *
   * It used to be rebuilt whenever the centre changed, which remounts the
   * WebView and re-downloads the entire Yandex JS API — a visible stall every
   * time the pin moved. Now the initial view is captured here and every later
   * change is injected into the running map.
   */
  const [html] = useState(() =>
    buildMapHtml({ markers: pins, center: point, zoom, radiusKm, pickable, lang })
  );

  /**
   * Panning reports a new centre, which the parent stores, which comes straight
   * back in as `point`. Pushing that back into the map mid-gesture would fight
   * the user's finger, so the map's own last answer is remembered and skipped.
   */
  const fromMapRef = useRef<LatLng | null>(null);
  const webRef = useRef<InstanceType<WebViewComponent> | null>(null);

  /**
   * The live zoom, readable by the update effect without waking it.
   *
   * The effect has to *send* the current zoom — otherwise moving the pin resets
   * the view the user zoomed to — but it must not re-run when only the zoom
   * changed: `__zoom` has already animated that, and a second `setCenter` on top
   * of it is the same move played twice.
   */
  const zoomRef = useRef(zoomLevel);
  useEffect(() => {
    zoomRef.current = zoomLevel;
  }, [zoomLevel]);

  useEffect(() => {
    if (!ready) return;
    const mine = fromMapRef.current;
    if (mine && Math.abs(mine.lat - point.lat) < 1e-6 && Math.abs(mine.lng - point.lng) < 1e-6) {
      return;
    }
    // The live zoom, not the prop: a picker whose parent re-renders on every
    // drag would otherwise be yanked back to its opening zoom the moment the
    // user zoomed in to place the pin precisely.
    const config = mapConfigJson({
      markers: pins,
      center: point,
      zoom: zoomRef.current,
      radiusKm,
      pickable,
    });
    webRef.current?.injectJavaScript(`window.__update && window.__update(${JSON.stringify(config)}); true;`);
  }, [ready, point, pins, radiusKm, pickable]);

  /** One step, through the map's own API so it animates like a pinch. */
  const stepZoom = (delta: 1 | -1) => {
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel + delta));
    if (next === zoomLevel) return;
    setZoomLevel(next);
    webRef.current?.injectJavaScript(`window.__zoom && window.__zoom(${delta}); true;`);
  };

  /**
   * If the page never answers at all — no `ready`, no `error` — the card would
   * shimmer forever. The document has its own deadline; this one covers the
   * case where its JavaScript never runs in the first place.
   */
  useEffect(() => {
    if (ready || failed) return;
    const id = setTimeout(() => setFailed(true), LOAD_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [ready, failed]);

  const onMessage = (event: WebViewMessage) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data) as {
        type: string;
        lat?: number;
        lng?: number;
        zoom?: number;
      };
      if (msg.type === 'ready') setReady(true);
      else if (msg.type === 'error') setFailed(true);
      // Pinching is the other way in, and the buttons have to follow it —
      // otherwise a map pinched to the limit still shows a live "+".
      else if (msg.type === 'zoom' && msg.zoom != null) setZoomLevel(msg.zoom);
      else if (msg.type === 'pick' && msg.lat != null && msg.lng != null) {
        const picked = { lat: msg.lat, lng: msg.lng };
        // Remembered so the round-trip back through props is not pushed back in.
        fromMapRef.current = picked;
        onPick?.(picked);
      }
    } catch {
      // a message we do not understand is not worth breaking the map over
    }
  };

  // The JS API did not load (bad key, no network): drop to the static map,
  // which is served by a different endpoint and needs no key.
  if (failed || !WebView) {
    return (
      <StaticYandexMap
        point={point}
        markers={markers}
        // Whatever the user had reached before the JS API gave up, so falling
        // back does not also throw away the view they had zoomed to.
        zoom={zoomLevel}
        height={height}
        radiusKm={radiusKm}
        interactive={interactive}
        onPick={onPick}
        route={route}
        caption={caption}
        hideOpenButton={hideOpenButton}
        onPress={onPress}
      />
    );
  }

  return (
    <View
      style={[
        styles.card,
        Squircle,
        dark ? null : Shadow.card,
        { height, backgroundColor: theme.surfaceMuted, borderColor: theme.borderLight },
      ]}>
      {/* Display-only maps must not swallow the parent scroll gesture. */}
      <View style={StyleSheet.absoluteFill} pointerEvents={canPan ? 'auto' : 'none'}>
        <WebView
          // Centre, zoom, ring and pins are all updated in place. Only the one
          // thing the document is *built* differently for — a fixed centre pin
          // versus placemarks — is worth a remount, and it never changes in
          // practice; the key is here so it would still be correct if it did.
          key={pickable ? 'picker' : 'viewer'}
          ref={webRef}
          originWhitelist={['*']}
          source={{ html, baseUrl: 'https://ishtopish.uz/' }}
          style={styles.web}
          javaScriptEnabled
          domStorageEnabled
          scrollEnabled={false}
          bounces={false}
          onMessage={onMessage}
          onError={() => setFailed(true)}
          onHttpError={() => setFailed(true)}
          androidLayerType={Platform.OS === 'android' ? 'hardware' : undefined}
          setSupportMultipleWindows={false}
          /**
           * Nothing may navigate this card away from the map — and nothing may
           * leave the app on its own either. Yandex's own tiles are full of
           * links (POI labels, the logo, the terms line); handing those to
           * `Linking` meant a tap anywhere near one closed the app and opened
           * Yandex Maps, which is not what tapping a map on a profile means.
           * The navigation is simply refused and the map stays put.
           */
          onShouldStartLoadWithRequest={(request) => {
            if (request.url.startsWith('about:') || request.url.startsWith('data:')) return true;
            return request.url.startsWith('https://ishtopish.uz/');
          }}
        />
      </View>

      {!ready ? (
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: theme.surfaceMuted }]}
          pointerEvents="none">
          <Shimmer color={dark ? '#FFFFFF' : '#0A0A0A'} intensity={0.06} radius={Radius.card} />
        </View>
      ) : null}

      {/* A display-only card is inert unless the caller gave it a job. */}
      {!canPan && onPress ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel={t('map.edit')}
          onPress={onPress}
        />
      ) : null}

      {/* Chrome matches the static card exactly, so the two are indistinguishable. */}
      {caption ? (
        <View
          style={[
            styles.chip,
            styles.topLeft,
            dark ? null : Shadow.thumb,
            { backgroundColor: theme.surface, borderColor: theme.borderLight },
          ]}
          pointerEvents="none">
          <Icon name="location" size={12} color={theme.primary} />
          <Text style={[Type.caption1Emphasized, { color: theme.text }]} numberOfLines={1}>
            {caption}
          </Text>
        </View>
      ) : null}

      {/* Zoom belongs to a map you can work with. On a preview card the whole
          thing is one button, so buttons on top of it are two controls fighting
          over the same tap. */}
      {canPan && ready ? (
        <MapZoom zoom={zoomLevel} min={MIN_ZOOM} max={MAX_ZOOM} onZoom={stepZoom} />
      ) : null}

      {pickable ? (
        <View
          style={[
            styles.chip,
            styles.topCentre,
            dark ? null : Shadow.thumb,
            { backgroundColor: theme.surface, borderColor: theme.borderLight },
          ]}
          pointerEvents="none">
          <Icon name="crosshair" size={12} color={theme.primary} />
          <Text style={[Type.caption1Emphasized, { color: theme.text }]} numberOfLines={1}>
            {t('map.pickHint')}
          </Text>
        </View>
      ) : hideOpenButton ? null : (
        // Bottom-left: Yandex's watermark owns the opposite corner.
        <Pressable
          onPress={() => openInYandex(point, route)}
          style={({ pressed }) => [
            styles.action,
            dark ? null : Shadow.card,
            { backgroundColor: theme.surface, borderColor: theme.borderLight },
            pressed && styles.pressed,
          ]}>
          <Icon name={route ? 'location' : 'arrow-forward'} size={14} color={theme.primary} />
          <Text style={[Type.footnoteEmphasized, { color: theme.text }]} numberOfLines={1}>
            {route ? t('map.route') : t('map.open')}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.card,
    borderWidth: Hairline,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  web: { flex: 1, backgroundColor: 'transparent' },
  pressed: { opacity: 0.55 },

  chip: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    borderWidth: Hairline,
    maxWidth: '78%',
  },
  topLeft: { top: 10, left: 10 },
  topCentre: { top: 10, alignSelf: 'center' },

  action: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: Hairline,
  },
});
