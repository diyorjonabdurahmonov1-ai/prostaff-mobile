// Imported one weight deep on purpose: each package's barrel `require()`s all
// 18 of its faces at module scope, which drags ~7 MB of unused TTFs into the
// bundle. These seven are the only faces the type ramp names.
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_600SemiBold } from '@expo-google-fonts/dm-sans/600SemiBold';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { UpdateGate } from '@/components/update-gate';
// Imported for its side effect: the background location task has to be
// defined before anything can start it. See lib/background-location.
import '@/lib/background-location';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { I18nProvider } from '@/i18n';
import { API_URL } from '@/lib/api';
import { configureNotifications } from '@/lib/notifications';
import { AuthProvider, useAuth } from '@/store/auth';
import { useRoleChangeListener } from '@/store/realtime';

SplashScreen.preventAutoHideAsync();
configureNotifications();

function RootNavigator() {
  const { hydrated, isAuthenticated, token, refreshMe } = useAuth();
  const scheme = useColorScheme();
  const themeName = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[themeName];

  // Keep worker/company panels in sync when admin changes roles.
  const sseBase = API_URL.replace(/\/api\/v1$/, '');
  useRoleChangeListener(isAuthenticated, token, refreshMe, sseBase);

  // On cold start, rehydrate the current user from /me so a freshly-created
  // worker/company profile does not remain stuck in the cached `customer` view.
  useEffect(() => {
    if (!hydrated || !isAuthenticated || !token) return;
    refreshMe().catch(() => {
      // keep the app responsive even if the refresh fails
    });
  }, [hydrated, isAuthenticated, token, refreshMe]);

  /**
   * DM Sans carries every title, Inter every line of body copy. Both ship the
   * Latin-Extended block Uzbek needs (oʻ gʻ) and the Cyrillic the RU locale
   * needs. The type ramp names these faces directly, so the first frame has to
   * wait for them — otherwise every screen would paint in the system font and
   * reflow a moment later.
   */
  const [fontsLoaded, fontError] = useFonts({
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  // A font that fails to decode must not wedge the app on the splash screen.
  const fontsSettled = fontsLoaded || !!fontError;
  const ready = hydrated && fontsSettled;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  /**
   * Feed our semantic palette to React Navigation so push transitions and any
   * chrome it draws match the app instead of flashing its default white.
   */
  const navTheme = useMemo(() => {
    const base = themeName === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: palette.primary,
        background: palette.background,
        card: palette.surface,
        text: palette.text,
        border: palette.separator,
      },
    };
  }, [themeName, palette]);

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: palette.background,
        }}
      >
        <ActivityIndicator color={palette.textMuted} size="large" />
      </View>
    );
  }

  return (
    <ThemeProvider value={navTheme}>
      {/* A plain View, deliberately.

          This used to be a bare `SafeAreaView`, which applies all four insets —
          and every screen below it has its own, because a screen is the thing
          that knows which of its edges are real. So each inset was counted
          twice: content sat a status bar's height too low, and a footer button
          ("Ish tugadi", "Qabul qilish") floated a navigation bar's height above
          the bottom of the screen. The safe area has one owner per edge, and it
          is the screen, not the root. */}
      <View style={{ flex: 1, backgroundColor: palette.background }}>
        <StatusBar style={themeName === 'dark' ? 'light' : 'dark'} />
        {/* Inside the ready check, so the splash screen is already down by the
            time this can replace the app with "please update". */}
        <UpdateGate>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: palette.background },
          }}
        >
          <Stack.Protected guard={isAuthenticated}>
            <Stack.Screen name="(app)" />
          </Stack.Protected>
          <Stack.Protected guard={!isAuthenticated}>
            <Stack.Screen name="auth" />
          </Stack.Protected>
          {/* Outside both guards on purpose: the offer is what a person agrees
              to when they register, so it has to open from the sign-up screen
              as well as from the profile. */}
          <Stack.Screen name="legal/offer" />
        </Stack>
        </UpdateGate>
      </View>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
