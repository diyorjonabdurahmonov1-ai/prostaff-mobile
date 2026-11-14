/**
 * The pill over other apps, for a provider who is online and has left the app.
 *
 * Shown while the app is out of sight — sent to the background, or closed from
 * the recents list — and gone the moment the app is in front again, where the
 * orders are on screen anyway. A worker's location service already holds the
 * app's process; a firm that does not share its position has nothing, so for
 * it a small foreground service does (`keepAlive`).
 *
 * Does nothing where the build has no native module (Expo Go, iPhone, the
 * browser, older builds).
 */

import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useT } from '@/i18n';
import { hideBubble, showBubble, startKeepAlive, stopKeepAlive } from '@/lib/overlay';

export function useAwayBubble({ active, keepAlive }: { active: boolean; keepAlive: boolean }) {
  const t = useT();

  useEffect(() => {
    if (!active) {
      hideBubble();
      stopKeepAlive();
      return;
    }
    if (keepAlive) startKeepAlive(t('bubble.keepTitle'), t('bubble.keepBody'));
    const apply = (state: string) => {
      if (state === 'active') hideBubble();
      else showBubble(t('bubble.online'));
    };
    apply(AppState.currentState);
    const sub = AppState.addEventListener('change', apply);
    return () => {
      sub.remove();
      // Leaving the screen with the app in front (switching to the customer
      // side) takes the pill and the service with it. When the app is torn down
      // from the recents list the state is not 'active', and both are left
      // standing on purpose: that is the pill over other apps.
      if (AppState.currentState === 'active') {
        hideBubble();
        stopKeepAlive();
      }
    };
  }, [active, keepAlive, t]);
}
