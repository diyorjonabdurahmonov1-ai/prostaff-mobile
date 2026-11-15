/**
 * What a map card shows when the map itself cannot be drawn.
 *
 * The interactive map needs the network (tiles) and WebGL; either can be missing.
 * Rather than a grey rectangle, the card turns into a plain address card — the
 * coordinates, the caption, and the same hand-off button — so the screen it sits
 * on still does its job: you can always open the point in the phone's maps app.
 *
 * It deliberately draws no tiles of its own. Picking a location needs a live map,
 * so a picker that has fallen back says so and offers nothing it cannot deliver.
 */

import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';

import { Icon } from '@/components/ui/icon';
import { Hairline, Radius, Shadow, Squircle, Type } from '@/constants/theme';
import { useTheme, useThemeMode } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { openInMaps } from '@/lib/maps';

import type { AppMapProps } from './app-map';

export function MapFallback({
  point,
  height = 200,
  onPick,
  route = false,
  caption,
  hideOpenButton = false,
  onPress,
}: AppMapProps) {
  const t = useT();
  const theme = useTheme();
  const dark = useThemeMode() === 'dark';
  const pickable = !!onPick;
  const coords = `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;

  return (
    <View
      style={[
        styles.card,
        Squircle,
        dark ? null : Shadow.card,
        { minHeight: Math.min(height, 150), backgroundColor: theme.surfaceMuted, borderColor: theme.borderLight },
      ]}>
      <View style={[styles.badge, { backgroundColor: theme.primarySoft }]}>
        <Icon name="location" size={22} color={theme.primary} />
      </View>
      {caption ? (
        <Text style={[Type.subheadEmphasized, { color: theme.text }]} numberOfLines={1}>
          {caption}
        </Text>
      ) : null}
      <Text style={[Type.footnote, { color: theme.textSecondary }]} numberOfLines={1}>
        {pickable ? t('map.unavailable') : coords}
      </Text>

      {!pickable && !hideOpenButton ? (
        <Pressable
          onPress={onPress ?? (() => openInMaps(point, route))}
          style={({ pressed }) => [
            styles.action,
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

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.card,
    borderWidth: Hairline,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 16,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  action: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: Hairline,
  },
  pressed: { opacity: 0.55 },
});
