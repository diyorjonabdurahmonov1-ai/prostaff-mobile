/**
 * Getting hold of the office, in two steps.
 *
 * Step one is the choice of channel — Telegram or a phone call. Step two only
 * exists for Telegram, and only because "open Telegram" is not one action on a
 * phone that has more than one Telegram on it: Android asks which client to
 * use, iOS silently picks whichever claimed the `tg:` scheme first. So the
 * sheet offers both routes — the deep link, which is where the Android chooser
 * comes from, and the plain `t.me` address, which the browser hands on to the
 * client the person actually wants. The choice stays with the user either way.
 */

import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Row, Section } from '@/components/ui/list';
import { Sheet } from '@/components/ui/sheet';
import { useT } from '@/i18n';
import {
  SUPPORT_PHONE,
  SUPPORT_TELEGRAM_HANDLE,
  callSupport,
  openTelegramApp,
  openTelegramLink,
} from '@/lib/support';

interface SupportSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function SupportSheet({ visible, onClose }: SupportSheetProps) {
  const t = useT();
  const [telegramStep, setTelegramStep] = useState(false);

  /** Both steps close through here, so the sheet always reopens at step one. */
  const close = () => {
    setTelegramStep(false);
    onClose();
  };

  const open = async (run: () => Promise<boolean>) => {
    const ok = await run();
    if (!ok) Alert.alert(t('support.title'), t('support.openFailed'));
    close();
  };

  const call = () => {
    callSupport().catch(() => Alert.alert(t('support.title'), t('support.openFailed')));
    close();
  };

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title={telegramStep ? t('support.telegramTitle') : t('support.title')}
      message={telegramStep ? t('support.telegramHint') : t('support.subtitle')}>
      <View style={styles.body}>
        {telegramStep ? (
          <Section inset={0} separatorInset={Row.ICON_INSET}>
            <Row
              icon="paper-plane"
              iconColor="#229ED9"
              title={t('support.telegramApp')}
              subtitle={t('support.telegramAppHint')}
              onPress={() => open(openTelegramApp)}
              chevron
            />
            <Row
              icon="globe-outline"
              iconColor="#8E8E93"
              title={t('support.telegramLink')}
              subtitle={t('support.telegramLinkHint')}
              onPress={() => open(openTelegramLink)}
              chevron
            />
          </Section>
        ) : (
          <Section inset={0} separatorInset={Row.ICON_INSET}>
            <Row
              icon="paper-plane"
              iconColor="#229ED9"
              title={t('support.telegram')}
              subtitle={SUPPORT_TELEGRAM_HANDLE}
              onPress={() => setTelegramStep(true)}
              chevron
            />
            <Row
              icon="call"
              iconColor="#34C759"
              title={t('support.phone')}
              subtitle={SUPPORT_PHONE}
              onPress={call}
              chevron
            />
          </Section>
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingBottom: 4 },
});
