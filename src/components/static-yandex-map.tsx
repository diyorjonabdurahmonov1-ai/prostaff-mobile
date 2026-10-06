/**
 * A real Yandex map with no native module and no API key.
 *
 * The static-map endpoint returns the cartography as a PNG, so this renders in
 * Expo Go and in any dev build — including one compiled before
 * `react-native-webview` was added. `YandexMap` falls back to it whenever the
 * WebView is unavailable, which means a map always shows up.
 *
 * **Everything on top of the map is ours.** The image is asked for without pins
 * or overlays; the marks, the search radius and the chrome are React Native
 * views positioned by projecting coordinates into pixels. That is what keeps a
 * map card looking like the rest of the app instead of like a Yandex screenshot.
 *
 * **Picking works the taxi-app way**: the pin is painted at the centre and never
 * moves — you drag the *map* under it and the address follows. Only then is the
 * image fetched larger than the card (`BLEED`), so there is map to spare mid
 * drag; on release the new centre is reported and a fresh image slides in. A
 * card that cannot be dragged asks for exactly what it shows.
 */

import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/text';

import { MapPin, pinHeight } from '@/components/map-pin';
import { MAP_INSET, MapZoom } from '@/components/map-zoom';
import { Shimmer } from '@/components/motion';
import { Icon } from '@/components/ui/icon';
import { Hairline, Radius, Shadow, Squircle, Type } from '@/constants/theme';
import { useTheme, useThemeMode } from '@/hooks/use-theme';
import { useI18n, useT } from '@/i18n';
import {
  DEFAULT_ZOOM,
  MAX_STATIC_ZOOM,
  MIN_ZOOM,
  latLngFromWorld,
  metresPerPixel,
  openInYandex,
  staticMapSize,
  staticMapUrl,
  worldFromLatLng,
  type LatLng,
  type MapMarker,
} from '@/lib/maps';

import type { YandexMapProps } from './yandex-map';

/** How much larger than the card the image is, to cover a drag in progress. */
const BLEED = 1.6;

/** Shared with the interactive card, so the two look identical. */
const INSET = MAP_INSET;

/**
 * How long to wait for the PNG before calling it a failure.
 *
 * A request that is refused reports `onError` and the card degrades. A request
 * that is simply never answered — which is what a throttled or blocked
 * static-map endpoint does — reports nothing at all, and without this the card
 * shimmers on an empty rectangle forever, which reads as a broken white map.
 */
const IMAGE_TIMEOUT_MS = 12000;

export function StaticYandexMap({
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
  const [layout, setLayout] = useState<{ width: number; height: number } | null>(null);
  const [zoomLevel, setZoomLevel] = useState(zoom);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [dragging, setDragging] = useState(false);

  const pickable = !!onPick;
  // One animated offset for the life of the card — the drag writes to it, the
  // image reads it. `useMemo` rather than a ref so nothing is read at render.
  const pan = useMemo(() => new Animated.ValueXY({ x: 0, y: 0 }), []);

  /**
   * Only a map that can be dragged needs map to spare around the edges.
   *
   * Every other card — the job location, the worker's area, the order preview —
   * was asking for an image 1.6× the card and then stretching it back down,
   * which cost bandwidth and lost detail for nothing.
   */
  const bleed = pickable ? BLEED : 1;
  const canvas = layout
    ? { width: layout.width * bleed, height: layout.height * bleed }
    : { width: 400 * bleed, height: height * bleed };
  const requested = staticMapSize(canvas.width, canvas.height);
  /** Map pixels per on-screen point — the exchange rate between the two. */
  const pxPerDp = requested.width / canvas.width;
  /** How far a drag may go before it would expose the edge of the image. */
  const limit = layout
    ? { x: (canvas.width - layout.width) / 2, y: (canvas.height - layout.height) / 2 }
    : { x: 0, y: 0 };

  // Point and zoom can change in bursts (rapid +/- taps, or a parent that
  // re-renders on every drag). Debouncing the URL means one PNG request per
  // burst instead of one per keystroke.
  const [debouncedPoint, setDebouncedPoint] = useState(point);
  const [debouncedZoom, setDebouncedZoom] = useState(zoomLevel);
  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedPoint(point);
      setDebouncedZoom(zoomLevel);
    }, 150);
    return () => clearTimeout(id);
  }, [point.lat, point.lng, zoomLevel]);

  // Only the first image is on the clock: once one has arrived the card has a
  // map on it, and a later request that stalls leaves the previous picture up
  // rather than throwing the whole card away.
  useEffect(() => {
    if (!loading || failed) return;
    const id = setTimeout(() => {
      setFailed(true);
      setLoading(false);
    }, IMAGE_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [loading, failed]);

  // A caller that changes the zoom (a radius that grew, a different card) has
  // to be able to move a map that has already mounted. Adjusted during render
  // rather than in an effect, which is React's own answer for state that has to
  // follow a prop without costing a second paint.
  const [lastZoomProp, setLastZoomProp] = useState(zoom);
  if (zoom !== lastZoomProp) {
    setLastZoomProp(zoom);
    setZoomLevel(zoom);
  }

  const url = layout
    ? staticMapUrl({
        center: debouncedPoint,
        zoom: debouncedZoom,
        width: canvas.width,
        height: canvas.height,
        lang,
      })
    : null;

  /**
   * Where a coordinate falls on the card, in points from its centre.
   *
   * Projected against the *debounced* view, because that is the picture on
   * screen. Using the live values drew pins where the map was about to be, so
   * for 150ms after every change the marks sat off the places they marked.
   */
  const offsetOf = (target: LatLng) => {
    const centre = worldFromLatLng(debouncedPoint, debouncedZoom);
    const other = worldFromLatLng(target, debouncedZoom);
    return { x: (other.x - centre.x) / pxPerDp, y: (other.y - centre.y) / pxPerDp };
  };

  // The search radius as a circle on screen. A ring far larger than the card
  // is not information, it is a coloured wash — so past a point it is dropped.
  const ringSize = radiusKm
    ? ((radiusKm * 1000) / metresPerPixel(debouncedPoint.lat, debouncedZoom) / pxPerDp) * 2
    : 0;
  const showRing = ringSize > 24 && ringSize < canvas.width * 3;

  /**
   * Dragging the map moves the world under a fixed pin: shift the centre by the
   * opposite of the gesture, then hand the new coordinate back.
   */
  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) =>
          pickable && (Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3),
        onPanResponderGrant: () => {
          setDragging(true);
          pan.setValue({ x: 0, y: 0 });
        },
        onPanResponderMove: (_e, g) => {
          pan.setValue({
            x: Math.max(-limit.x, Math.min(limit.x, g.dx)),
            y: Math.max(-limit.y, Math.min(limit.y, g.dy)),
          });
        },
        onPanResponderRelease: (_e, g) => {
          setDragging(false);
          const dx = Math.max(-limit.x, Math.min(limit.x, g.dx));
          const dy = Math.max(-limit.y, Math.min(limit.y, g.dy));
          if (!onPick || (Math.abs(dx) < 1 && Math.abs(dy) < 1)) {
            pan.setValue({ x: 0, y: 0 });
            return;
          }
          // The offset stays until the re-centred image arrives — snapping back
          // before it loads would make the map jump away and back again.
          const world = worldFromLatLng(point, zoomLevel);
          onPick(
            latLngFromWorld({ x: world.x - dx * pxPerDp, y: world.y - dy * pxPerDp }, zoomLevel),
          );
        },
        onPanResponderTerminate: () => {
          setDragging(false);
          pan.setValue({ x: 0, y: 0 });
        },
      }),
    [pickable, onPick, pan, limit.x, limit.y, point, zoomLevel, pxPerDp],
  );

  return (
    <View
      style={[
        styles.card,
        Squircle,
        dark ? null : Shadow.card,
        { height, backgroundColor: theme.surfaceMuted, borderColor: theme.borderLight },
      ]}
      onLayout={(e) => setLayout(e.nativeEvent.layout)}
      {...(pickable ? responder.panHandlers : null)}>
      {/* ---- The map, and everything pinned to it ---- */}
      {url && !failed ? (
        <Animated.View
          style={[
            styles.canvas,
            {
              width: canvas.width,
              height: canvas.height,
              marginLeft: -(canvas.width - (layout?.width ?? 0)) / 2,
              marginTop: -(canvas.height - (layout?.height ?? height)) / 2,
              transform: pan.getTranslateTransform(),
            },
          ]}>
          <Image
            source={{ uri: url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={dragging ? 0 : 200}
            onLoadEnd={() => {
              setLoading(false);
              // This image is centred on the current point, so the drag offset
              // has done its job and can go.
              if (!dragging) pan.setValue({ x: 0, y: 0 });
            }}
            onError={() => {
              setFailed(true);
              setLoading(false);
              pan.setValue({ x: 0, y: 0 });
            }}
          />

          {/* Overlays live inside the canvas so they travel with the map. */}
          <View style={styles.overlay} pointerEvents="none">
            {showRing ? (
              <View
                style={[
                  styles.ring,
                  {
                    width: ringSize,
                    height: ringSize,
                    borderRadius: ringSize / 2,
                    backgroundColor: `${theme.primary}14`,
                    borderColor: `${theme.primary}66`,
                  },
                ]}
              />
            ) : null}

            {/* While picking, the centre pin is chrome, not a map mark. */}
            {!pickable
              ? (markers ?? [{ ...point }]).map((m: MapMarker, i) => {
                  const at = offsetOf(m);
                  return (
                    <View
                      key={m.id ?? `${m.lat},${m.lng},${i}`}
                      style={[
                        styles.marker,
                        // The tip of the pin is what marks the spot.
                        { transform: [{ translateX: at.x }, { translateY: at.y - pinHeight(30) / 2 }] },
                      ]}>
                      <MapPin tone={m.color ?? 'primary'} size={30} halo={i === 0} />
                    </View>
                  );
                })
              : null}
          </View>
        </Animated.View>
      ) : null}

      {/* A card that is not being dragged does nothing on tap unless the caller
          asked for something. Handing off to Yandex Maps on any tap meant a
          finger that brushed the map on the way down the page left the app. */}
      {!pickable && onPress ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel={t('map.edit')}
          onPress={onPress}
        />
      ) : null}

      {loading && !failed ? (
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: theme.surfaceMuted }]}
          pointerEvents="none">
          <Shimmer color={dark ? '#FFFFFF' : '#0A0A0A'} intensity={0.06} radius={Radius.card} />
        </View>
      ) : null}

      {failed ? (
        <View style={styles.fallback} pointerEvents="none">
          <MapPin size={30} />
          <Text style={[Type.footnoteEmphasized, styles.fallbackText, { color: theme.text }]}>
            {`${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`}
          </Text>
          <Text style={[Type.caption1, styles.center, { color: theme.textSecondary }]}>
            {caption ?? t('map.openHint')}
          </Text>
        </View>
      ) : null}

      {/* The pin that never moves — the map moves under it. */}
      {pickable && !failed ? (
        <View style={styles.centrePin} pointerEvents="none">
          <MapPin size={38} lifted={dragging} />
        </View>
      ) : null}

      {/* ---- Chrome ---- */}
      {caption && !failed ? (
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

      {pickable && !failed ? (
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
      ) : null}

      {/* Zoom belongs to a map you can work with. On a preview card the whole
          thing is one button that opens Yandex Maps, so buttons on top of it
          are two controls fighting over the same tap. */}
      {!failed && (interactive || pickable) ? (
        <MapZoom
          zoom={zoomLevel}
          min={MIN_ZOOM}
          max={MAX_STATIC_ZOOM}
          onZoom={(delta) =>
            setZoomLevel((z) => Math.max(MIN_ZOOM, Math.min(MAX_STATIC_ZOOM, z + delta)))
          }
        />
      ) : null}

      {/* Bottom-left, clear of the Yandex watermark in the opposite corner. */}
      {!pickable && !hideOpenButton ? (
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
      ) : null}
    </View>
  );
}

export type { LatLng };

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.card,
    borderWidth: Hairline,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  canvas: { position: 'absolute', top: 0, left: 0 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  pressed: { opacity: 0.55 },

  ring: { position: 'absolute', borderWidth: 1.5 },
  marker: { position: 'absolute' },
  centrePin: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    // Half the pin's height, so its tip lands on the centre of the card.
    paddingBottom: pinHeight(38),
  },

  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flex: 1,
    paddingHorizontal: 16,
  },
  fallbackText: { marginTop: 2 },

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
  topLeft: { top: INSET, left: INSET },
  topCentre: { top: INSET, alignSelf: 'center' },

  action: {
    position: 'absolute',
    left: INSET,
    bottom: INSET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: Hairline,
  },
});
