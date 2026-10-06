/**
 * The bottom bar a worker or a firm sees.
 *
 * Providers do not live in the customer tab group — their home is their panel —
 * so they carry their own nav. It used to be copy-pasted into each panel, which
 * is why the profile screen showed the *customer* tabs no matter who was signed
 * in: the profile was a customer tab and nothing else existed to render there.
 *
 * `navigate`, not `push`: these four destinations are siblings a provider moves
 * between all day, and pushing would grow the stack every time.
 */

import { useRouter, type Href } from 'expo-router';

import { BOTTOM_BAR_HEIGHT, BottomBar } from '@/components/ui/bottom-bar';
import { type IconName } from '@/components/ui/icon';
import { useT } from '@/i18n';

// A firm has no wallet tab, and a worker has no subscription one: the two are
// billed in different currencies. A worker spends a balance on commission; a
// firm buys months. Showing a firm a "Hamyon" tab was showing it a number that
// nothing on its account is ever paid out of.
export type ProviderTab = 'home' | 'orders' | 'wallet' | 'subscription' | 'profile';

interface ProviderNavProps {
  mode: 'worker' | 'company';
  active: ProviderTab;
}

/** Height a scroll view must clear so the bar never covers the last row. */
export const PROVIDER_NAV_HEIGHT = BOTTOM_BAR_HEIGHT;

export function ProviderNav({ mode, active }: ProviderNavProps) {
  const t = useT();
  const router = useRouter();

  // Both providers get an orders tab. A firm answers new orders on its panel
  // home, which is why it went without one for a while — but answering is not
  // the same as looking something up, and there was nowhere at all to see what
  // the firm had already done.
  const items: { key: ProviderTab; icon: IconName; label: string; href: Href }[] =
    mode === 'worker'
      ? [
          { key: 'home', icon: 'home', label: t('tab.home'), href: '/worker' },
          { key: 'orders', icon: 'list-outline', label: t('tab.orders'), href: '/worker/orders' },
          { key: 'wallet', icon: 'wallet', label: t('profile.wallet'), href: '/wallet' },
          { key: 'profile', icon: 'person', label: t('tab.profile'), href: '/worker/profile' },
        ]
      : [
          { key: 'home', icon: 'home', label: t('tab.home'), href: '/company' },
          { key: 'orders', icon: 'list-outline', label: t('tab.orders'), href: '/company/orders' },
          {
            key: 'subscription',
            icon: 'card',
            label: t('subscription.title'),
            href: '/company/subscription',
          },
          { key: 'profile', icon: 'person', label: t('tab.profile'), href: '/company/profile' },
        ];

  return (
    <BottomBar
      floating
      items={items.map((item) => ({
        key: item.key,
        icon: item.icon,
        label: item.label,
        active: item.key === active,
        onPress: () => {
          if (item.key !== active) router.navigate(item.href);
        },
      }))}
    />
  );
}
