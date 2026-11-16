/**
 * The notification tray's door, with the number of messages not yet read.
 *
 * Every panel had a bell and none of them said anything: a message from the
 * office could arrive, ring the phone, and leave nothing on screen to say it was
 * still waiting. The count comes from the stored messages themselves, so it is
 * what the tray will show — and it clears when the tray is opened.
 */

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components/text';

import { Icon } from '@/components/ui/icon';
import { Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { useNotifications } from '@/store/realtime';

export function NotificationBell({
  size = 24,
  style,
  dotColor,
  color,
}: {
  /** The bell's colour, for use on a coloured surface. */
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
  /**
   * A plain dot for when nothing is unread but something else needs a look —
   * the worker panel uses it for an order in hand. The count wins when there is
   * one.
   */
  dotColor?: string | null;
}) {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const { notifications, refresh } = useNotifications(true);

  // Coming back from the tray, where everything was marked read.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <Pressable
      onPress={() => router.push('/notifications')}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `${t('push.title')}: ${unread}` : t('push.title')}
      style={({ pressed }) => [styles.bell, style, pressed && styles.pressed]}>
      <Icon name="notifications" size={size} color={color ?? theme.text} />
      {unread > 0 ? (
        <View style={[styles.badge, { backgroundColor: theme.danger, borderColor: theme.background }]}>
          <Text style={[Type.caption2Emphasized, styles.badgeText]}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      ) : dotColor ? (
        <View style={[styles.dot, { backgroundColor: dotColor, borderColor: theme.background }]} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bell: { padding: 4, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.5 },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', lineHeight: 13, textAlign: 'center' },
  dot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
});
