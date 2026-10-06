/**
 * The web twin of `yandex-map.tsx`.
 *
 * `react-native-webview` has no browser implementation, so on web the very same
 * map document (`buildMapHtml`) goes into an iframe instead. Picking works the
 * same way — the document posts to `window.parent` when there is no
 * `ReactNativeWebView` bridge to use.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
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
  openInYandex,
  type MapMarker,
} from '@/lib/maps';

import { LOAD_TIMEOUT_MS, resolveZoom } from './yandex-map';

import type { YandexMapProps } from './yandex-map';

export type { MapMarker };

export function YandexMap(props: YandexMapProps) {
  const resolved = { ...props, zoom: resolveZoom(props) };
  return <InteractiveYandexMap {...resolved} />;
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
  /** Where the map actually is — the user can move it, with the buttons or by
   *  scrolling — so the +/- can go flat at the ends of the range. */
  const [zoomLevel, setZoomLevel] = useState(zoom);
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  const pickable = !!onPick;
  const canPan = interactive || pickable;

  const [lastZoomProp, setLastZoomProp] = useState(zoom);
  if (zoom !== lastZoomProp) {
    setLastZoomProp(zoom);
    setZoomLevel(zoom);
  }

  /**
   * One step, through the map's own API so it animates like a scroll-wheel zoom.
   *
   * `srcDoc` inherits this page's origin, so the document's own hook is simply
   * callable — no message plumbing for something this small.
   */
  const stepZoom = (delta: 1 | -1) => {
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel + delta));
    if (next === zoomLevel) return;
    setZoomLevel(next);
    try {
      (frameRef.current?.contentWindow as { __zoom?: (d: number) => void } | null)?.__zoom?.(delta);
    } catch {
      // a cross-origin frame would refuse; the state above still moves the label
    }
  };

  // As on native: the map's own centre updates must not rebuild the document.
  const fromMapRef = useRef<{ lat: number; lng: number } | null>(null);
  const [docPoint, setDocPoint] = useState(point);
  useEffect(() => {
    const mine = fromMapRef.current;
    if (mine && Math.abs(mine.lat - point.lat) < 1e-6 && Math.abs(mine.lng - point.lng) < 1e-6) {
      return;
    }
    setDocPoint(point);
  }, [point]);

  const pins: MapMarker[] = useMemo(
    () => (markers && markers.length > 0 ? markers : [{ ...docPoint }]),
    [markers, docPoint],
  );

  const html = useMemo(
    () => buildMapHtml({ markers: pins, center: docPoint, zoom, radiusKm, pickable, lang }),
    [pins, docPoint, zoom, radiusKm, pickable, lang],
  );

  // Same deadline as native: a JS API that never arrives must not leave the
  // card shimmering, it must hand over to the static map.
  useEffect(() => {
    if (ready || failed) return;
    const id = setTimeout(() => setFailed(true), LOAD_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [ready, failed]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (typeof event.data !== 'string') return;
      try {
        const msg = JSON.parse(event.data) as {
          type: string;
          lat?: number;
          lng?: number;
          zoom?: number;
        };
        if (msg.type === 'ready') setReady(true);
        else if (msg.type === 'error') setFailed(true);
        // Scroll-wheel and pinch are the other ways in, and the buttons have to
        // follow them.
        else if (msg.type === 'zoom' && msg.zoom != null) setZoomLevel(msg.zoom);
        else if (msg.type === 'pick' && msg.lat != null && msg.lng != null) {
          const picked = { lat: msg.lat, lng: msg.lng };
          fromMapRef.current = picked;
          onPick?.(picked);
        }
      } catch {
        // not one of ours
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onPick]);

  if (failed) {
    return (
      <StaticYandexMap
        point={point}
        markers={markers}
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
      <View style={StyleSheet.absoluteFill} pointerEvents={canPan ? 'auto' : 'none'}>
        <iframe
          ref={frameRef}
          title="Yandex map"
          srcDoc={html}
          style={{ width: '100%', height: '100%', border: 'none' }}
        />
      </View>

      {!ready ? (
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: theme.surfaceMuted }]}
          pointerEvents="none">
          <Shimmer color={dark ? '#FFFFFF' : '#0A0A0A'} intensity={0.06} radius={Radius.card} />
        </View>
      ) : null}

      {/* Zoom belongs to a map you can work with; a preview card is one button. */}
      {canPan && ready ? (
        <MapZoom zoom={zoomLevel} min={MIN_ZOOM} max={MAX_ZOOM} onZoom={stepZoom} />
      ) : null}

      {/* Inert unless the caller gave the card a job — see the native twin. */}
      {!canPan && onPress ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel={t('map.edit')}
          onPress={onPress}
        />
      ) : null}

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
