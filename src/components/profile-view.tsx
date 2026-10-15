/**
 * Everything on a profile screen except the chrome around it.
 *
 * Three screens render this: the customer's profile tab, and the worker's and
 * the firm's own profile pages. They differ only in the bar at the bottom and
 * in what they pass as `children` — which is where a provider's own record
 * (prices, bio, opening hours) is shown, so the panel home can stay a working
 * dashboard instead of a wall of details.
 *
 * The screen owns the ScrollView, not this component: each one needs its own
 * bottom padding for its own nav bar, and the customer tab adds pull-to-refresh.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';

import { SupportSheet } from '@/components/support-sheet';
import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { Row, Section } from '@/components/ui/list';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Gradients, Layout, Radius, Shadow, Squircle, Type } from '@/constants/theme';
import { useTheme, useThemeMode } from '@/hooks/use-theme';
import { useI18n, useT } from '@/i18n';
import { api } from '@/lib/api';
import { formatSom } from '@/lib/format';
import { switchRoot } from '@/lib/nav';
import {
  SUPPORT_PHONE,
  SUPPORT_TELEGRAM_HANDLE,
  callSupport,
  openTelegramApp,
} from '@/lib/support';
import { pickAndUploadImage } from '@/lib/upload';
import { useAuth } from '@/store/auth';

const ICON_INSET = Row.ICON_INSET;

interface ProfileViewProps {
  /**
   * Mode-specific detail, rendered under the wallet card. The worker and firm
   * profiles pass their own record here; the customer tab passes nothing.
   */
  children?: ReactNode;
}

export function ProfileView({ children }: ProfileViewProps) {
  const t = useT();
  const theme = useTheme();
  const dark = useThemeMode() === 'dark';
  const router = useRouter();
  const { lang, setLang, languages } = useI18n();
  const { user, activeMode, refreshMe, signOut, setActiveMode } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);

  /**
   * The picker's `file://` URI only resolves on this device, so the photo is
   * uploaded first and the account stores the returned URL — otherwise the
   * avatar shows here and is a broken image to everyone else.
   */
  const pickAvatar = async () => {
    setUploading(true);
    try {
      const url = await pickAndUploadImage({ square: true, quality: 0.7 });
      if (!url) return;
      await api.post('/me/avatar', { avatar_url: url });
      await refreshMe();
    } catch {
      Alert.alert(t('common.error'), t('photo.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  /**
   * Worker and company accounts are opened by the office, not from the app.
   * Someone who wants to work is given the number to call; the admin fills the
   * details in and the panel simply appears on this screen afterwards.
   */
  const requestProvider = (title: string) => {
    Alert.alert(title, t('provider.adminOnly', { phone: SUPPORT_PHONE, telegram: SUPPORT_TELEGRAM_HANDLE }), [
      { text: t('common.close'), style: 'cancel' },
      { text: t('support.telegram'), onPress: () => void openTelegramApp() },
      { text: t('common.call'), onPress: () => void callSupport().catch(() => {}) },
    ]);
  };

  /**
   * Switching modes makes the new side the root — see `switchRoot`. One mode is
   * active at a time, so whichever side is showing is the bottom of the stack
   * and Back from it leaves the app, in both directions.
   */
  const goWorker = async () => {
    const fresh = (await refreshMe()) ?? user;
    if (!fresh?.worker_profile) return requestProvider(t('profile.mode.worker'));
    setActiveMode('worker');
    switchRoot('/worker');
  };

  const goCompany = async () => {
    const fresh = (await refreshMe()) ?? user;
    if (!fresh?.company_profile) return requestProvider(t('profile.mode.company'));
    setActiveMode('company');
    switchRoot('/company');
  };

  /**
   * Leaving the worker/company account is the same deliberate act as entering
   * it — the mode survives restarts, so nothing else may flip it by accident.
   */
  const goCustomer = () => {
    setActiveMode('customer');
    switchRoot('/');
  };

  const cycleLanguage = () => {
    const idx = languages.indexOf(lang);
    setLang(languages[(idx + 1) % languages.length]);
  };

  const balance = user?.wallet?.balance ?? 0;
  const userName = user?.name || user?.phone || '';

  /**
   * A firm's account is a date, not a balance.
   *
   * While this screen showed every provider the same wallet card, a firm was
   * being told how much money it had in an account that nothing is ever taken
   * out of — a firm pays no commission per job, it buys months. The number was
   * real and completely irrelevant, which is the worst kind of number to put at
   * the top of somebody's profile. Signed in as a firm, the card below becomes
   * the one figure that does decide whether work arrives: how long is left.
   */
  const company = activeMode === 'company' ? (user?.company_profile ?? null) : null;

  /** Signed in as a worker right now, not merely entitled to be. */
  const isWorker = activeMode === 'worker' && !!user?.worker_profile;

  /** Signed in as a worker or a firm right now, not merely entitled to be. */
  const isProvider = isWorker || (activeMode === 'company' && !!user?.company_profile);

  return (
    <>
      {/* Identity — the Apple-ID row from Settings */}
      <Section>
        <PressableScale onPress={pickAvatar} scaleTo={0.99} dim={0.85} style={styles.identity}>
          <View>
            <Avatar name={userName} imageUrl={user?.avatar_url} size={62} />
            {uploading ? (
              <View style={[styles.uploadVeil, { backgroundColor: theme.scrim }]}>
                <ActivityIndicator color="#FFFFFF" size="small" />
              </View>
            ) : (
              <View style={[styles.cameraBadge, { backgroundColor: theme.surface }]}>
                <Icon name="camera" size={12} color={theme.textSecondary} />
              </View>
            )}
          </View>
          <View style={styles.identityText}>
            <Text style={[Type.title3, { color: theme.text }]} numberOfLines={1}>
              {userName}
            </Text>
            <Text style={[Type.footnote, { color: theme.textSecondary }]} numberOfLines={1}>
              {user?.phone} · {t('profile.changePhoto')}
            </Text>
          </View>
          <Icon name="chevron-forward" size={17} color={theme.textTertiary} />
        </PressableScale>
      </Section>

      {/* The account card: months for a firm, a balance for a worker, and
          nothing for a customer — a customer pays per job and has no balance
          to look after, so the card was only ever a dead end on their tab. */}
      {company ? (
        <PressableScale
          onPress={() => router.push('/company/subscription')}
          scaleTo={0.975}
          style={[styles.walletWrap, dark ? null : Shadow.card]}>
          <LinearGradient
            colors={[Gradients.brand[0], Gradients.brand[1]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.wallet, Squircle]}>
            <View style={styles.walletTop}>
              <Text style={[Type.footnote, styles.walletLabel]}>{t('subscription.title')}</Text>
              <Icon name="card" size={20} color="rgba(255,255,255,0.9)" />
            </View>
            {company.subscription_active ? (
              <Text style={[Type.largeTitle, styles.walletValue]}>
                {company.subscription_days_left}
                <Text style={[Type.title3, styles.walletUnit]}>
                  {' '}
                  {t('subscription.daysLeft')}
                </Text>
              </Text>
            ) : (
              <Text style={[Type.title1, styles.walletValue]}>
                {company.subscription_until ? t('subscription.expired') : t('subscription.none')}
              </Text>
            )}
            <Text style={[Type.footnote, styles.walletLabel]}>
              {company.subscription_until
                ? `${t('subscription.until')}: ${new Date(company.subscription_until).toLocaleDateString()}`
                : `${t('subscription.freeLeft')}: ${Math.max(
                    company.free_orders_limit - company.free_orders_used,
                    0,
                  )} / ${company.free_orders_limit}`}
            </Text>
            <View style={styles.walletAction}>
              <Text style={[Type.footnoteEmphasized, styles.walletActionText]}>
                {t('subscription.renew')}
              </Text>
              <Icon name="chevron-forward" size={13} color="rgba(255,255,255,0.9)" />
            </View>
          </LinearGradient>
        </PressableScale>
      ) : isWorker ? (
        <PressableScale
          onPress={() => router.push('/wallet')}
          scaleTo={0.975}
          style={[styles.walletWrap, dark ? null : Shadow.card]}>
          <LinearGradient
            colors={[Gradients.wallet[0], Gradients.wallet[1]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.wallet, Squircle]}>
            <View style={styles.walletTop}>
              <Text style={[Type.footnote, styles.walletLabel]}>{t('profile.wallet')}</Text>
              <Icon name="wallet" size={20} color="rgba(255,255,255,0.9)" />
            </View>
            <Text style={[Type.largeTitle, styles.walletValue]}>
              {formatSom(balance)}
              <Text style={[Type.title3, styles.walletUnit]}> {t('common.som')}</Text>
            </Text>
            <View style={styles.walletAction}>
              <Text style={[Type.footnoteEmphasized, styles.walletActionText]}>
                {t('wallet.topUp')}
              </Text>
              <Icon name="chevron-forward" size={13} color="rgba(255,255,255,0.9)" />
            </View>
          </LinearGradient>
        </PressableScale>
      ) : null}

      {/* Whoever is signed in, their own record goes here. */}
      {children}

      {/* Modes — the panels appear once an admin has opened the account.
          The active one is marked, because the app stays in it. */}
      <Section
        header={t('profile.activeMode')}
        separatorInset={ICON_INSET}
        style={styles.section}
        footer={
          isProvider
            ? t('profile.customerHint')
            : user?.worker_profile && user?.company_profile
              ? undefined
              : t('provider.adminOnlyHint')
        }>
        <Row
          icon="person"
          iconColor="#8E8E93"
          title={t('profile.mode.customer')}
          value={activeMode === 'customer' ? t('profile.modeActive') : undefined}
          onPress={activeMode === 'customer' ? undefined : goCustomer}
          right={
            activeMode === 'customer' ? (
              <Icon name="checkmark-circle" size={19} color={theme.success} />
            ) : null
          }
          chevron={activeMode !== 'customer'}
        />
        <Row
          icon="hammer"
          iconColor="#5E7CFA"
          title={t('profile.mode.worker')}
          value={
            !user?.worker_profile
              ? t('provider.request')
              : activeMode === 'worker'
                ? t('profile.modeActive')
                : undefined
          }
          onPress={goWorker}
          right={
            user?.worker_profile ? (
              <Icon
                name="checkmark-circle"
                size={19}
                color={activeMode === 'worker' ? theme.success : theme.textTertiary}
              />
            ) : null
          }
          chevron
        />
        <Row
          icon="business"
          iconColor="#20B8A6"
          title={t('profile.mode.company')}
          value={
            !user?.company_profile
              ? t('provider.request')
              : activeMode === 'company'
                ? t('profile.modeActive')
                : undefined
          }
          onPress={goCompany}
          right={
            user?.company_profile ? (
              <Icon
                name="checkmark-circle"
                size={19}
                color={activeMode === 'company' ? theme.success : theme.textTertiary}
              />
            ) : null
          }
          chevron
        />
      </Section>

      {/* Preferences */}
      <Section header="Sozlamalar" separatorInset={ICON_INSET} style={styles.section}>
        <Row
          icon="globe-outline"
          iconColor="#8E8E93"
          title={t('profile.language')}
          value={t(`lang.${lang}` as 'lang.uz')}
          onPress={cycleLanguage}
        />
        <Row
          icon="notifications"
          iconColor="#FF3B30"
          title={t('profile.notifications')}
          onPress={() => router.push('/notifications')}
          chevron
        />
        {user?.roles?.includes('admin') ? (
          <Row
            icon="shield-checkmark"
            iconColor="#AF52DE"
            title="Admin panel"
            onPress={() => router.push('/admin')}
          />
        ) : null}
      </Section>

      {/* Support — two channels, and the document behind the app.
          Telegram is a row of its own rather than a line in an alert, because
          it is how most people actually write in; which Telegram client opens
          is the user's choice, and the sheet is where that choice is made. */}
      <Section header={t('support.title')} separatorInset={ICON_INSET} style={styles.section}>
        <Row
          icon="paper-plane"
          iconColor="#229ED9"
          title={t('support.telegram')}
          value={SUPPORT_TELEGRAM_HANDLE}
          onPress={() => setSupportOpen(true)}
          chevron
        />
        <Row
          icon="call"
          iconColor="#34C759"
          title={t('support.phone')}
          value={SUPPORT_PHONE}
          onPress={() => {
            // A device with no dialler (a tablet) rejects `tel:` — say so
            // rather than let the promise fail silently.
            callSupport().catch(() => Alert.alert(t('support.title'), t('support.openFailed')));
          }}
        />
        <Row
          icon="clipboard"
          iconColor="#8E8E93"
          title={t('legal.offer')}
          onPress={() => router.push('/legal/offer')}
          chevron
        />
      </Section>

      <SupportSheet visible={supportOpen} onClose={() => setSupportOpen(false)} />

      {/* Sign out */}
      <Section style={styles.section}>
        <Row title={t('profile.signOut')} tone="danger" centered onPress={signOut} />
      </Section>

      <Text style={[Type.caption1, styles.version, { color: theme.textTertiary }]}>
        {t('common.appName')} · 1.0.0
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 28 },

  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: Layout.gutter,
    paddingVertical: 14,
  },
  identityText: { flex: 1, gap: 3 },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadVeil: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
  },

  walletWrap: { marginTop: 24, marginHorizontal: Layout.gutter },
  wallet: { borderRadius: Radius.xl, padding: 20, gap: 6 },
  walletTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  walletLabel: { color: 'rgba(255,255,255,0.85)' },
  walletValue: { color: '#FFFFFF' },
  walletUnit: { color: 'rgba(255,255,255,0.85)' },
  walletAction: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  walletActionText: { color: 'rgba(255,255,255,0.92)' },

  version: { textAlign: 'center', marginTop: 28 },
});
