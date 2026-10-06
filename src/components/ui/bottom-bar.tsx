/**
 * The app's bottom bar — one of them, for everybody.
 *
 * There used to be two. Customers got React Navigation's tab bar, configured
 * through `screenOptions`; workers and firms got a hand-rolled `View` in
 * `ProviderNav`, because a provider's home is their panel and not a tab. The
 * two never matched, and on Android the configured one quietly dropped its
 * labels altogether: a fixed 62pt height left the 14pt label line with nowhere
 * to go. So the same app showed a labelled four-item bar on one screen and
 * three bare glyphs on the next.
 *
 * This is that bar, once, as plain views — which means what it measures is what
 * it draws. UIKit's proportions: a 49pt row of 25pt glyphs over 10pt captions,
 * a hairline on top, and a translucent ground so content scrolls under it.
 */

import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { Hairline, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Icon, type IconName } from './icon';

/**
 * Height of the row of tabs, before the home indicator. The bar as drawn is
 * this plus the bottom safe-area inset, which it adds itself: it is the last
 * thing above the system navigation bar, so that edge is its to own. A screen
 * that scrolls underneath clears `BOTTOM_BAR_HEIGHT + insets.bottom`.
 */
export const BOTTOM_BAR_HEIGHT = 49;

export interface BottomBarItem {
  key: string;
  icon: IconName;
  label: string;
  active: boolean;
  onPress: () => void;
}

export function BottomBar({
  items,
  floating = false,
}: {
  items: BottomBarItem[];
  /**
   * Overlay the content instead of sitting below it in the layout.
   *
   * A tab navigator stacks the bar under the screen and the screen is sized
   * around it, so the bar must stay in the flow or every customer screen loses
   * a bar's worth of its bottom. A provider panel is a plain screen that draws
   * its own bar on top and already reserves `PROVIDER_NAV_HEIGHT` of scroll
   * padding for it.
   */
  floating?: boolean;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        floating && styles.floating,
        {
          backgroundColor: theme.barBackground,
          borderTopColor: theme.separator,
          // Below the row, never taken out of it — otherwise the gesture bar
          // eats the labels on exactly the phones that have one.
          paddingBottom: insets.bottom,
        },
      ]}>
      <View style={styles.row}>
        {items.map((item) => {
          const color = item.active ? theme.primary : theme.textMuted;
          return (
            <Pressable
              key={item.key}
              onPress={item.onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: item.active }}
              accessibilityLabel={item.label}
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
              {/* Selection is carried by weight, not by a second glyph:
                  Phosphor has no outline/solid pair, it has six weights. The
                  selected tab picks up the duotone fill and the rest stay bare
                  strokes, which reads like UIKit's filled/outline convention
                  without two shapes fighting over one slot. */}
              <Icon
                name={item.icon}
                size={25}
                weight={item.active ? 'duotone' : 'regular'}
                duotoneOpacity={0.28}
                color={color}
              />
              <Text style={[Type.caption2Emphasized, styles.label, { color }]} numberOfLines={1}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderTopWidth: Hairline },
  row: { flexDirection: 'row', alignItems: 'center', height: BOTTOM_BAR_HEIGHT },
  floating: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 4 },
  pressed: { opacity: 0.5 },
  label: { fontSize: 10, lineHeight: 12, letterSpacing: 0.1 },
});
