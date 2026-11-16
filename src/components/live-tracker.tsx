/**
 * "Where is my worker?" — the customer's live view once the worker has set off.
 *
 * Taxi-style: a map with the worker moving toward the address, how far and how
 * long, and a road with a little scooter driving along it. The line under it is
 * deliberately light-hearted — it changes with how close the worker is — because
 * waiting for somebody is dull and a joke makes it shorter.
 *
 * The position comes from `GET /orders/{id}/tracking`, polled every few seconds;
 * the server only answers it between "I'm on my way" and "I've arrived".
 */

import { useEffect, useMemo, useState } from 'react';
import { Animated, AppState, Easing, StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';

import { AppMap } from '@/components/app-map';
import { Hairline, Radius, Shadow, Squircle, Type } from '@/constants/theme';
import { useTheme, useThemeMode } from '@/hooks/use-theme';
import { useI18n, useT } from '@/i18n';
import { api } from '@/lib/api';
import type { LatLng } from '@/lib/maps';

interface Tracking {
  departed_at?: string | null;
  arrived_at?: string | null;
  dest: LatLng;
  position?: { lat: number; lng: number; at: string };
  stale?: boolean;
}

const POLL_MS = 3000;
/** City driving, with turns and traffic — a deliberately honest, slow guess. */
const AVG_KMH = 22;
/** Straight line to road distance. */
const ROAD_FACTOR = 1.3;

function km(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Which bucket of jokes fits how far away the worker is. */
function bucket(distance: number, stale: boolean): 'lost' | 'far' | 'mid' | 'near' | 'door' {
  if (stale) return 'lost';
  if (distance < 0.25) return 'door';
  if (distance < 1.2) return 'near';
  if (distance < 4) return 'mid';
  return 'far';
}

/** Who is coming, by how close they are. */
const CHARACTER = { lost: '📡', far: '🦸', mid: '🏃', near: '🚀', door: '🎉' } as const;

export function LiveTracker({ orderId, workerName }: { orderId: string; workerName?: string }) {
  const t = useT();
  const { lang } = useI18n();
  const theme = useTheme();
  const dark = useThemeMode() === 'dark';
  const [data, setData] = useState<Tracking | null>(null);
  /** The farthest the worker has been, so the road can show how much is done. */
  const [startDistance, setStartDistance] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    // Only while the app is on screen: a phone in a pocket has nobody watching
    // the map, and every poll costs battery and data. Coming back reads at once.
    const load = () => {
      if (AppState.currentState !== 'active') return;
      return api
        .get<Tracking>(`/orders/${orderId}/tracking`)
        .then((r) => {
          if (!live) return;
          setData(r);
          if (r.position) {
            const d = km({ lat: r.position.lat, lng: r.position.lng }, r.dest);
            setStartDistance((prev) => Math.max(prev, d));
          }
        })
        .catch(() => {});
    };
    load();
    const id = setInterval(load, POLL_MS);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') load();
    });
    return () => {
      live = false;
      clearInterval(id);
      appState.remove();
    };
  }, [orderId]);

  // A new joke every few seconds, so the card stays alive between positions.
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 6000);
    return () => clearInterval(id);
  }, []);

  const pos = data?.position ? { lat: data.position.lat, lng: data.position.lng } : null;
  const distance = pos && data ? km(pos, data.dest) : null;
  const progress =
    distance != null && startDistance > 0.05
      ? Math.min(1, Math.max(0, 1 - distance / startDistance))
      : 0;

  const roadKm = distance != null ? distance * ROAD_FACTOR : null;
  const minutes = roadKm != null ? Math.max(1, Math.round((roadKm / AVG_KMH) * 60)) : null;

  const [slide] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(slide, {
      toValue: progress,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, slide]);

  const [bob] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 450, useNativeDriver: false }),
        Animated.timing(bob, { toValue: 0, duration: 450, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bob]);

  const joke = useMemo(() => {
    const key = bucket(distance ?? 99, !!data?.stale);
    const options = [1, 2, 3].map((n) => t(`trip.${key}${n}` as never));
    return options[tick % options.length];
  }, [distance, data?.stale, tick, t]);

  if (!data?.departed_at || data.arrived_at) return null;

  // Centre between the two, so both are in the picture; wider when far apart.
  const centre = pos ? { lat: (pos.lat + data.dest.lat) / 2, lng: (pos.lng + data.dest.lng) / 2 } : data.dest;
  const zoom =
    distance == null
      ? 15
      : distance > 8 ? 11 : distance > 4 ? 12 : distance > 2 ? 13 : distance > 1 ? 14 : distance > 0.5 ? 15 : 16;

  return (
    <View
      style={[
        styles.card,
        Squircle,
        dark ? null : Shadow.card,
        { backgroundColor: theme.surface, borderColor: theme.borderLight },
      ]}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={[Type.title3, { color: theme.text }]} numberOfLines={1}>
            {minutes != null ? t('trip.eta', { n: minutes }) : t('trip.waitingSignal')}
          </Text>
          <Text style={[Type.footnote, { color: theme.textSecondary }]} numberOfLines={1}>
            {workerName ? `${workerName} · ` : ''}
            {distance != null ? t('trip.away', { d: distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km` }) : t('trip.onTheWay')}
          </Text>
        </View>
      </View>

      {pos ? (
        <AppMap
          point={centre}
          zoom={zoom}
          height={210}
          markers={[
            { lat: data.dest.lat, lng: data.dest.lng, hint: t('order.location'), color: 'primary' },
            // A character, not a dot: it hops toward the house, changes as it
            // gets closer, and says something about it.
            {
              lat: pos.lat,
              lng: pos.lng,
              hint: workerName ?? '',
              label: CHARACTER[bucket(distance ?? 99, false)],
              say: t(`trip.say.${bucket(distance ?? 99, false)}` as never),
              color: 'success',
            },
          ]}
          hideOpenButton
        />
      ) : null}

      {/* The road: the scooter drives toward the house as the worker nears. */}
      <View style={styles.road}>
        <View style={[styles.line, { backgroundColor: theme.fillQuaternary }]} />
        <Animated.View
          style={[
            styles.lineDone,
            { backgroundColor: theme.primary, width: slide.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
          ]}
        />
        <Animated.Text
          style={[
            styles.rider,
            {
              left: slide.interpolate({ inputRange: [0, 1], outputRange: ['0%', '88%'] }),
              transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }],
            },
          ]}>
          🛵
        </Animated.Text>
        <Text style={styles.house}>🏠</Text>
      </View>

      <View style={[styles.joke, { backgroundColor: theme.primarySoft }]}>
        <Text key={`${lang}-${tick}-${joke}`} style={[Type.subheadEmphasized, { color: theme.primary, textAlign: 'center' }]}>
          {joke}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: Hairline,
    overflow: 'hidden',
    padding: 14,
    gap: 12,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  road: { height: 30, justifyContent: 'center', marginHorizontal: 4 },
  line: { height: 6, borderRadius: 3 },
  lineDone: { position: 'absolute', left: 0, height: 6, borderRadius: 3 },
  rider: { position: 'absolute', fontSize: 22, top: 1 },
  house: { position: 'absolute', right: 0, fontSize: 22, top: 1 },
  joke: { borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10 },
});
