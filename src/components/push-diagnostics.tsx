/**
 * "Why is nothing arriving with the app closed?", answered on the device.
 *
 * Push is the one part of the system that cannot be debugged by reading logs,
 * and every one of its failures looks identical from the phone — an empty
 * notification tray. There are five of them, and they need five different
 * fixes:
 *
 *  1. Expo Go, which has had no remote push since SDK 53. Local notifications
 *     still work, so the app looks fine right up until it is closed.
 *  2. The notification permission was never granted, or was revoked later.
 *  3. The device has a token but the server never received it.
 *  4. Expo refused the token outright — DeviceNotRegistered, after a reinstall.
 *  5. Expo accepted the message and the push service dropped it. This is the
 *     one that only ever bites a release build, and the only one visible
 *     nowhere but in Expo's delivery receipt: an FCM V1 service account that
 *     was never uploaded to the Expo project, or one belonging to a different
 *     Firebase project than google-services.json ships.
 *
 * The server waits for that receipt and names whichever it was. This puts the
 * button where the people affected actually are: a worker or a firm missing
 * jobs, not an admin on a settings screen they cannot reach.
 */

import { useEffect, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';

import { Section, Row } from '@/components/ui/list';
import {
  currentPushToken,
  ensureNotificationPermission,
  lastPushError,
  notificationPermissionGranted,
  registerPushToken,
  remotePushSupported,
  sendServerPushTest,
} from '@/lib/notifications';
import { useT } from '@/i18n';
import { useTheme } from '@/hooks/use-theme';

export function PushDiagnostics() {
  const t = useT();
  const theme = useTheme();

  const supported = remotePushSupported();
  const [granted, setGranted] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    notificationPermissionGranted().then((ok) => {
      if (active) setGranted(ok);
    });
    return () => {
      active = false;
    };
  }, []);

  const grant = async () => {
    const ok = await ensureNotificationPermission();
    setGranted(ok);
    if (ok) registerPushToken();
  };

  const check = async () => {
    setBusy(true);
    try {
      // Registering first means the commonest cause of all — a token that never
      // reached the server — is repaired by the same tap that diagnoses it.
      await registerPushToken();
      const result = await sendServerPushTest();

      const lines: string[] = [];
      if (result.sent) lines.push(t('push.testDelivered'));
      else if (result.receipt_pending) lines.push(t('push.testPending'));
      else lines.push(t('push.testFailed'));

      if (result.code) lines.push(`\n${result.code}`);
      else if (result.reason) lines.push(`\n${result.reason}`);
      if (result.error) lines.push(result.error);
      if (result.hint) lines.push('', result.hint);
      if (!result.token) lines.push('', `${t('push.tokenMissing')} ${lastPushError() ?? ''}`.trim());

      // The transport is the answer to the question people actually have.
      // Reaching the phone through Expo is not the same as being reachable:
      // that path shows nothing once Android has ended the app's process.
      if (result.transport === 'expo') lines.push('', t('push.viaExpo'));
      else if (result.transport === 'fcm') lines.push('', t('push.viaFcm'));

      Alert.alert(result.sent ? t('push.working') : t('push.problem'), lines.join('\n'));
    } finally {
      setBusy(false);
    }
  };

  if (!supported) {
    return (
      <Section header={t('push.deliveryTitle')} footer={t('push.expoGoHint')} style={styles.section}>
        <Row icon="alert-circle-outline" iconColor={theme.warning} title={t('push.expoGo')} />
      </Section>
    );
  }

  if (granted === false) {
    return (
      <Section
        header={t('push.deliveryTitle')}
        footer={t('push.permissionHint')}
        separatorInset={Row.ICON_INSET}
        style={styles.section}>
        <Row
          icon="notifications-outline"
          iconColor={theme.danger}
          title={t('push.permissionNeeded')}
          subtitle={t('push.grant')}
          chevron
          onPress={grant}
        />
      </Section>
    );
  }

  return (
    <Section
      header={t('push.deliveryTitle')}
      footer={t('push.checkHint')}
      separatorInset={Row.ICON_INSET}
      style={styles.section}>
      <Row
        icon="notifications-ringing"
        iconColor={theme.primary}
        title={t('push.check')}
        subtitle={busy ? t('push.checking') : currentPushToken() ? undefined : t('push.tokenMissing')}
        chevron
        disabled={busy}
        onPress={check}
      />
    </Section>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 20 },
});
