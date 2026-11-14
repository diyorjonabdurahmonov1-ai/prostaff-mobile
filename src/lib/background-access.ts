/**
 * The two phone settings that decide whether an online worker keeps getting
 * work with the app out of sight — Android only.
 *
 *   1. Battery optimisation. Left on, Android puts the app to sleep in a
 *      pocket: location stops and notifications arrive late. The system has
 *      its own "let this app run in the background?" dialog, and this opens
 *      it directly.
 *   2. Autostart. Xiaomi, Huawei, Oppo, Vivo and a few others add a switch of
 *      their own, off by default, without which the app is killed the moment
 *      it leaves the screen. There is no way to read it and no standard way to
 *      reach it, so each maker's screen is tried by name, falling back to the
 *      app's own settings page, which always exists.
 */

import * as Battery from 'expo-battery';
import Constants from 'expo-constants';
import * as IntentLauncher from 'expo-intent-launcher';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const AUTOSTART_DONE_KEY = 'prostaff.autostart_done';

function appPackage(): string {
  return Constants.expoConfig?.android?.package ?? 'com.prostaff.app';
}

/** True when Android may put the app to sleep in the background. */
export async function batteryRestricted(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    return await Battery.isBatteryOptimizationEnabledAsync();
  } catch {
    return false;
  }
}

/** Opens whatever gets battery optimisation switched off for this app. */
export async function openBatterySettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const data = `package:${appPackage()}`;
  const attempts: [string, IntentLauncher.IntentLauncherParams | undefined][] = [
    // The system's own yes/no dialog for this one app.
    [IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, { data }],
    // The list of apps, where it has to be found by hand.
    [IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS, undefined],
    [IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS, { data }],
  ];
  for (const [action, params] of attempts) {
    try {
      await IntentLauncher.startActivityAsync(action, params);
      return;
    } catch {
      // Not on this phone; try the next way in.
    }
  }
}

/** [package, activity] of each maker's autostart screen, most likely first. */
const AUTOSTART_SCREENS: Record<string, [string, string][]> = {
  xiaomi: [['com.miui.securitycenter', 'com.miui.permcenter.autostart.AutoStartManagementActivity']],
  huawei: [
    ['com.huawei.systemmanager', 'com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity'],
    ['com.huawei.systemmanager', 'com.huawei.systemmanager.optimize.process.ProtectActivity'],
  ],
  honor: [
    ['com.hihonor.systemmanager', 'com.hihonor.systemmanager.startupmgr.ui.StartupNormalAppListActivity'],
    ['com.huawei.systemmanager', 'com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity'],
  ],
  oppo: [
    ['com.coloros.safecenter', 'com.coloros.safecenter.permission.startup.StartupAppListActivity'],
    ['com.coloros.safecenter', 'com.coloros.safecenter.startupapp.StartupAppListActivity'],
    ['com.oppo.safe', 'com.oppo.safe.permission.startup.StartupAppListActivity'],
  ],
  vivo: [
    ['com.vivo.permissionmanager', 'com.vivo.permissionmanager.activity.BgStartUpManagerActivity'],
    ['com.iqoo.secure', 'com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity'],
  ],
  oneplus: [['com.oneplus.security', 'com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity']],
  transsion: [['com.transsion.phonemaster', 'com.cyin.himgr.autostart.AutoStartActivity']],
};

/** Brand names as phones report them → the family whose screen they share. */
const BRAND_FAMILY: Record<string, string> = {
  xiaomi: 'xiaomi',
  redmi: 'xiaomi',
  poco: 'xiaomi',
  huawei: 'huawei',
  honor: 'honor',
  oppo: 'oppo',
  realme: 'oppo',
  vivo: 'vivo',
  iqoo: 'vivo',
  oneplus: 'oneplus',
  tecno: 'transsion',
  infinix: 'transsion',
  itel: 'transsion',
};

function brandFamily(): string | null {
  if (Platform.OS !== 'android') return null;
  const c = Platform.constants as { Brand?: string; Manufacturer?: string };
  for (const name of [c.Brand, c.Manufacturer]) {
    const family = name ? BRAND_FAMILY[name.toLowerCase()] : undefined;
    if (family) return family;
  }
  return null;
}

/** Whether this phone is one whose maker kills background apps by default. */
export function needsAutostart(): boolean {
  return brandFamily() !== null;
}

/** Opens the maker's autostart screen, or the app's settings page. */
export async function openAutostartSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const family = brandFamily();
  for (const [packageName, className] of family ? AUTOSTART_SCREENS[family] : []) {
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.MAIN', { packageName, className });
      return;
    } catch {
      // That screen is not on this model; try the next.
    }
  }
  try {
    await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS, {
      data: `package:${appPackage()}`,
    });
  } catch {
    // Nothing more to try.
  }
}

/** The worker's word that autostart is on — the phone will not tell us. */
export async function autostartConfirmed(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(AUTOSTART_DONE_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function confirmAutostart(): Promise<void> {
  try {
    await SecureStore.setItemAsync(AUTOSTART_DONE_KEY, '1');
  } catch {
    // Asked again next time; no harm.
  }
}
