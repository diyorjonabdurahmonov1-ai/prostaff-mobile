import { Tabs } from 'expo-router';

import { BottomBar, type BottomBarItem } from '@/components/ui/bottom-bar';
import { type IconName } from '@/components/ui/icon';
import { useT } from '@/i18n';

/**
 * The customer tabs.
 *
 * The bar is drawn by `BottomBar` rather than configured through
 * `screenOptions`, so it is the same bar a worker and a firm see — before this
 * the two were separate implementations that had drifted, and React
 * Navigation's, squeezed into a fixed 62pt on Android, was rendering three bare
 * glyphs with the labels clipped off underneath.
 */
const ICONS: Record<string, IconName> = {
  index: 'home',
  orders: 'reader',
  profile: 'person-circle',
};

export default function TabsLayout() {
  const t = useT();

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state, descriptors, navigation }) => {
        const items: BottomBarItem[] = state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          return {
            key: route.key,
            icon: ICONS[route.name] ?? 'home',
            label: options.title ?? route.name,
            active: state.index === index,
            onPress: () => {
              // React Navigation's own contract: a tab press is cancellable,
              // and re-pressing the active tab pops its stack rather than
              // navigating. Emitting the event is what keeps both true.
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (state.index !== index && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            },
          };
        });
        return <BottomBar items={items} />;
      }}>
      <Tabs.Screen name="index" options={{ title: t('tab.home') }} />
      <Tabs.Screen name="orders" options={{ title: t('tab.orders') }} />
      <Tabs.Screen name="profile" options={{ title: t('tab.profile') }} />
    </Tabs>
  );
}
