import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { CardPaymentHost } from '@/components/card-payment-host';
import { useTheme } from '@/hooks/use-theme';
import {
  consumeColdStartTap,
  onNotificationTap,
  startPushRegistration,
  type NotificationTap,
} from '@/lib/notifications';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { getCoordsWithFallback } from '@/lib/location';
import { OrderFlowProvider } from '@/store/order-flow';
import { useInviteAlerts, useNotificationBridge } from '@/store/realtime';

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

  // Auto-online: when the user enters the app with worker or company mode,
  // automatically set them online.
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        if (activeMode === 'worker' && user.worker_profile && !user.worker_profile.online) {
          const coords = await getCoordsWithFallback();
          await api.post('/worker/status', { online: true, lat: coords.lat, lng: coords.lng });
          refreshMe();
        } else if (activeMode === 'company' && user.company_profile && !user.company_profile.online) {
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
      {/* Incoming jobs are not a takeover any more — they land as cards in the
          worker's list (see components/incoming-order-card.tsx); the push
          notification is what gets attention. */}
    </OrderFlowProvider>
  );
}
