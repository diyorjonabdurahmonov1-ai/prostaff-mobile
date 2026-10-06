import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';

import { EmptyState, LoadingState } from '@/components/ui/empty-state';
import { Header } from '@/components/ui/header';
import { Section } from '@/components/ui/list';
import { Screen } from '@/components/ui/screen';
import { Layout, Radius, Type } from '@/constants/theme';
import { useFocusEffect, useRouter } from 'expo-router';
import { useRefresh } from '@/hooks/use-refresh';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import type { AppNotification } from '@/lib/types';
import { useNotifications } from '@/store/realtime';

import { Icon, type IconName } from '@/components/ui/icon';

/**
 * The notification screen.
 *
 * It used to be diagnostics and nothing else: three test buttons, a token tail
 * and a socket status. That answered "is push working?" and never the question
 * people actually open this screen with — "what did I miss?". Messages were
 * being stored on the server the whole time and no screen in the app read them.
 *
 * The diagnostics are gone rather than tucked away: a socket URL and a push
 * token are engineering's business, and a customer being shown them learns
 * nothing and worries anyway. What is left is the messages.
 *
 * A permission check briefly lived back at the top of the list, on the argument
 * that an empty tray with push switched off looks the same as an empty tray with
 * nothing to say. It reads as a fault report on a screen people open for news,
 * and it was the first thing on it. `components/push-diagnostics.tsx` is still
 * there for whoever needs to debug delivery.
 */
export default function NotificationsScreen() {
  const t = useT();
  const router = useRouter();

  const { notifications, loading, refresh, markAllRead } = useNotifications(true);
  const { refreshControl } = useRefresh(refresh);

  // Opening the screen is reading them. Fired once per visit, after the list has
  // rendered with its dots — clearing them before the user sees them would make
  // "new" invisible.
  const unread = notifications.some((n) => !n.read);
  useFocusEffect(
    useCallback(() => {
      if (unread) markAllRead();
    }, [unread, markAllRead])
  );

  return (
    <Screen
      padded={false}
      header={<Header title={t('push.title')} back />}
      refreshControl={refreshControl}>
      {loading && notifications.length === 0 ? (
        <LoadingState />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon="notifications-outline"
          title={t('push.empty')}
          message={t('push.emptyHint')}
        />
      ) : (
        <Section
          header={t('push.inbox')}
          separatorInset={Layout.gutter + 38}
          style={styles.section}>
          {notifications.map((n) => (
            <NotificationRow
              key={n.id}
              notification={n}
              onPress={() => {
                const orderId = orderIdOf(n);
                if (!orderId) return;
                // A job offered *to* the reader opens on the provider screen,
                // where it can be answered. Everything else is news about an
                // order they placed, and belongs on the customer's screen.
                router.push(
                  isOffer(n)
                    ? { pathname: '/work/[id]', params: { id: orderId } }
                    : { pathname: '/orders/[id]', params: { id: orderId } }
                );
              }}
            />
          ))}
        </Section>
      )}
    </Screen>
  );
}

/* ===================== One message ===================== */

/** The order a notification is about, when it is about one. */
function orderIdOf(n: AppNotification): string | null {
  const id = (n.data as { order_id?: unknown } | undefined)?.order_id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

/**
 * Whether this message is a job being offered to the reader.
 *
 * `order.invite` rings a worker a job has been broadcast to; `order.new` rings
 * a firm one has been sent to. Both are decisions waiting to be made, and both
 * tapped through to the customer's read-only order screen — which shows the
 * reader their own would-be job with no way to answer it.
 */
function isOffer(n: AppNotification): boolean {
  return n.type === 'order.invite' || n.type === 'order.new';
}

/** Glyph + tint per message type, so the list is scannable without reading it. */
function glyphFor(
  type: string,
  theme: ReturnType<typeof useTheme>
): { icon: IconName; color: string } {
  switch (type) {
    case 'order.invite':
    case 'order.new':
      return { icon: 'notifications-ringing', color: theme.primary };
    case 'order.accepted':
      return { icon: 'checkmark-circle', color: theme.success };
    case 'order.expired':
      return { icon: 'hourglass', color: theme.warning };
    case 'order.status':
      return { icon: 'reader', color: theme.textSecondary };
    case 'role.changed':
      return { icon: 'shield-checkmark', color: theme.success };
    default:
      return { icon: 'notifications-outline', color: theme.textSecondary };
  }
}

function NotificationRow({
  notification,
  onPress,
}: {
  notification: AppNotification;
  onPress: () => void;
}) {
  const t = useT();
  const theme = useTheme();
  const { icon, color } = glyphFor(notification.type, theme);
  const tappable = orderIdOf(notification) !== null;

  return (
    <Pressable
      onPress={tappable ? onPress : undefined}
      style={({ pressed }) => [
        styles.row,
        pressed && tappable ? { backgroundColor: theme.highlight } : null,
      ]}>
      <View style={[styles.glyph, { backgroundColor: theme.fillQuaternary }]}>
        <Icon name={icon} size={18} color={color} />
      </View>

      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={[Type.bodyEmphasized, styles.title, { color: theme.text }]} numberOfLines={1}>
            {notification.title || t('push.title')}
          </Text>
          {!notification.read ? (
            <View style={[styles.unread, { backgroundColor: theme.primary }]} />
          ) : null}
        </View>
        {notification.body ? (
          <Text style={[Type.footnote, { color: theme.textSecondary }]} numberOfLines={3}>
            {notification.body}
          </Text>
        ) : null}
        <Text style={[Type.caption1, { color: theme.textTertiary }]}>
          {relativeTime(notification.created_at, t)}
        </Text>
      </View>

      {tappable ? <Icon name="chevron-forward" size={16} color={theme.textTertiary} /> : null}
    </Pressable>
  );
}

/**
 * "12 daqiqa oldin" up to a day old, then the date. Anything older than that is
 * being read as history, and a date is what history wants.
 */
function relativeTime(iso: string, t: ReturnType<typeof useT>): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const minutes = Math.floor((Date.now() - then) / 60000);
  if (minutes < 1) return t('push.justNow');
  if (minutes < 60) return t('push.minutesAgo', { n: minutes });
  if (minutes < 60 * 24) return t('push.hoursAgo', { n: Math.floor(minutes / 60) });
  return new Date(then).toLocaleString();
}

const styles = StyleSheet.create({
  section: { marginTop: 12 },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: Layout.gutter,
    paddingVertical: 12,
  },
  glyph: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  rowBody: { flex: 1, gap: 3 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1 },
  unread: { width: 8, height: 8, borderRadius: 4 },
});
