import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { CardPaymentHost } from '@/components/card-payment-host';
import { useTheme } from '@/hooks/use-theme';
import { useLiveLocation } from '@/hooks/use-live-location';
import { setLiveLocation } from '@/lib/company-live';
import { firmMayReport, setFirmLiveIntent, setWorkerIntent, workerMayReport } from '@/lib/presence';
import { useT } from '@/i18n';
import {
  consumeColdStartTap,
  presentLocalNotification,
  onNotificationTap,
  startPushRegistration,
  type NotificationTap,
} from '@/lib/notifications';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { OrderFlowProvider } from '@/store/order-flow';
import { useInviteAlerts, useNotificationBridge } from '@/store/realtime';

/** How often, and how many times, a failed "go offline" is retried. */
const LAPSE_RETRY_MS = 15_000;
const LAPSE_RETRIES = 3;

export default function AppLayout() {
  const theme = useTheme();
  const router = useRouter();
  const { user, activeMode, refreshMe } = useAuth();

  // Keep the push token registered while signed in — the endpoint is behind
  // auth, so doing this on bare mount just 401s and push never worked. One
  // attempt was not enough either: see startPushRegistration.
  useEffect(() => {
    if (!user?.id) return;
    return startPushRegistration();
  }, [user?.id]);

  // A tapped notification opens the thing it is about.
  //
  // Tapping "Yangi buyurtma!" used to do nothing beyond opening the app on
  // whatever screen it was last on — the worker then had to find the job
  // themselves, against a countdown. An offer opens on the provider screen,
  // where it can be answered; anything else opens the customer's order.
  useEffect(() => {
    if (!user?.id) return;
    const open = (tap: NotificationTap) => {
      if (!tap.orderId) return;
      router.push(
        tap.offer
          ? { pathname: '/work/[id]', params: { id: tap.orderId } }
          : { pathname: '/orders/[id]', params: { id: tap.orderId } }
      );
    };
    // The tap that started the app from cold arrives before any listener could
    // have existed, so it is claimed separately — once.
    consumeColdStartTap().then((tap) => {
      if (tap) open(tap);
    });
    return onNotificationTap(open);
  }, [user?.id, router]);

  // Surface stored server-side notifications (admin messages, order updates) in
  // the device tray, which also covers Expo Go where remote push is disabled.
  useNotificationBridge(!!user?.id);

  // A new job lands in the worker's list; this puts a banner in the tray so it
  // is noticed from another screen — no takeover, just a notification.
  useInviteAlerts(!!user?.worker_profile && !user.worker_profile.banned);

  // The worker's location, for every worker screen — see WorkerLocationGuard.
  const isWorker = activeMode === 'worker' && !!user?.worker_profile;
  const isCompany = activeMode === 'company' && !!user?.company_profile;

  // Auto-online for firms: entering company mode puts the firm online.
  //
  // Workers are deliberately left out. Going online is the worker's own
  // decision — it means their phone starts ringing with jobs — and switching
  // them on behind their back undid the toggle: a worker who went offline was
  // put straight back online the next time they opened the app.
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        if (activeMode === 'company' && user.company_profile && !user.company_profile.online) {
          await api.post('/company/status', { online: true });
          refreshMe();
        }
      } catch {
        // best-effort
      }
    })();
  }, [activeMode]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <OrderFlowProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.background },
        }}>
        <Stack.Screen name="(tabs)" />
        {/* iOS sheets: rounded card that slides over the previous screen. */}
        <Stack.Screen name="review" options={{ presentation: 'modal' }} />
        <Stack.Screen name="rate" options={{ presentation: 'modal' }} />
        {/* Paying. A modal because it is a task the payer either finishes or
            backs out of — and because it must sit above whatever screen asked
            to be paid for, which is still waiting on its answer. */}
        <Stack.Screen name="pay/card" options={{ presentation: 'modal' }} />
        <Stack.Screen name="pay/otp" options={{ presentation: 'modal' }} />
      </Stack>
      {/* Mounted once, for every purchase in the app: `checkout()` reaches it
          to put the card and SMS-code steps on screen, so no screen that buys
          something has to know they exist. */}
      <CardPaymentHost />
      {isWorker ? <WorkerLocationGuard /> : null}
      {isCompany ? <CompanyLiveGuard /> : null}
      {/* Incoming jobs are not a takeover any more — they land as cards in the
          worker's list (see components/incoming-order-card.tsx); the push
          notification is what gets attention. */}
    </OrderFlowProvider>
  );
}

/**
 * Keeps a worker's location true for as long as they are signed in as one.
 *
 * Lives here rather than on the worker's home screen so it keeps running on
 * every worker screen (orders, wallet, profile), not only the one with the
 * switch on it.
 *
 *   - While online, each move is reported with the same status call that put
 *     the worker online, so dispatch measures "near" from where they are now.
 *   - If location is switched off, or permission taken away, while online, the
 *     worker is taken offline at once rather than left "online" at the last
 *     place the app saw them — and told, in the tray as well as on screen,
 *     since the switch is usually flipped from quick settings with this app in
 *     the background. Once per lapse: it re-arms when location is back.
 */
function WorkerLocationGuard() {
  const t = useT();
  const { user, refreshMe } = useAuth();
  const online = !!user?.worker_profile?.online;

  const { status } = useLiveLocation({
    tracking: online,
    onMove: (fix) => {
      // Not if the worker has just asked to go offline — see lib/presence.
      if (!workerMayReport()) return;
      api.post('/worker/status', { online: true, lat: fix.lat, lng: fix.lng }).catch(() => {});
    },
  });
  const blocked = status !== 'ok' && status !== 'checking';

  const lapseRef = useRef(false);
  useEffect(() => {
    if (!blocked) {
      lapseRef.current = false;
      return;
    }
    if (!online || lapseRef.current) return;
    lapseRef.current = true;
    setWorkerIntent(false);
    // Location is usually lost somewhere with poor signal, so this is tried a
    // few times: a worker left "online" with no location is the one state
    // this guard exists to prevent.
    const timers: ReturnType<typeof setTimeout>[] = [];
    const goOffline = (attempt: number) => {
      api
        .post('/worker/status', { online: false })
        .then(() => refreshMe())
        .catch(() => {
          if (attempt < LAPSE_RETRIES) timers.push(setTimeout(() => goOffline(attempt + 1), LAPSE_RETRY_MS));
        });
    };
    goOffline(0);
    presentLocalNotification({
      title: t('loc.lostTitle'),
      body: t('loc.lostBody'),
      data: { type: 'location.lost' },
    });
    return () => timers.forEach(clearTimeout);
  }, [blocked, online, refreshMe, t]);

  return null;
}

/**
 * A mobile firm's live position, for every firm screen.
 *
 * Reports where the phone is while the firm is online with live location on.
 * If location goes away, live location is switched off rather than left
 * pointing at the last place the phone was seen — the firm stays online, and
 * keeps getting orders around its office, and is told exactly that.
 */
function CompanyLiveGuard() {
  const t = useT();
  const { user, refreshMe } = useAuth();
  const firm = user?.company_profile;
  const sharing = !!firm?.online && !!firm?.live_location;

  const { status } = useLiveLocation({
    tracking: sharing,
    onMove: (fix) => {
      // Not if the firm has just switched live location off — see lib/presence.
      if (!firmMayReport()) return;
      setLiveLocation(true, fix).catch(() => {});
    },
  });
  const blocked = status !== 'ok' && status !== 'checking';

  const lapseRef = useRef(false);
  useEffect(() => {
    if (!blocked) {
      lapseRef.current = false;
      return;
    }
    if (!sharing || lapseRef.current) return;
    lapseRef.current = true;
    setFirmLiveIntent(false);
    setLiveLocation(false)
      .then(() => refreshMe())
      .catch(() => {});
    presentLocalNotification({
      title: t('live.lostTitle'),
      body: t('live.lostBody'),
      data: { type: 'location.lost' },
    });
  }, [blocked, sharing, refreshMe, t]);

  return null;
}
