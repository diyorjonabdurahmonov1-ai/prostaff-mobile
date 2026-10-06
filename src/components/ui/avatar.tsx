import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import {
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/text';

import { useTheme } from '@/hooks/use-theme';
import { resolveImageUrl } from '@/lib/image';

interface AvatarProps {
  name?: string | null;
  imageUrl?: string | null;
  size?: number;
  online?: boolean;
}

/** iOS Contacts-style gradient pairs, picked deterministically from the name. */
const RAMPS: readonly (readonly [string, string])[] = [
  ['#6B62DC', '#4A41A9'],
  ['#5E7CFA', '#3B5BDB'],
  ['#20B8A6', '#0E8C7E'],
  ['#FF9F45', '#F76707'],
  ['#FF6B8A', '#E03131'],
  ['#A98BF5', '#7048E8'],
  ['#4DABF7', '#1971C2'],
  ['#51CF66', '#2B8A3E'],
];

function initials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join('') || '?';
}

function rampFor(name?: string | null) {
  if (!name) return RAMPS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return RAMPS[hash % RAMPS.length];
}

export function Avatar({ name, imageUrl, size = 44, online }: AvatarProps) {
  const theme = useTheme();
  const dotSize = Math.max(10, Math.round(size * 0.26));
  const ramp = rampFor(name);
  // The stored URL carries whichever host uploaded it; only the id is durable.
  const uri = resolveImageUrl(imageUrl);

  return (
    <View style={{ width: size, height: size }}>
      {uri ? (
        <Image
          source={{ uri }}
          contentFit="cover"
          transition={180}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      ) : (
        <LinearGradient
          colors={[ramp[0], ramp[1]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.circle,
            { width: size, height: size, borderRadius: size / 2 },
          ]}>
          <Text
            style={[
              styles.text,
              { fontSize: Math.round(size * 0.4), lineHeight: Math.round(size * 0.48) },
            ]}>
            {initials(name)}
          </Text>
        </LinearGradient>
      )}

      {online !== undefined ? (
        <View
          style={[
            styles.dot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor: online ? theme.success : theme.textTertiary,
              borderColor: theme.surface,
              borderWidth: Math.max(2, dotSize * 0.18),
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  text: { color: '#FFFFFF', fontWeight: '600', letterSpacing: 0.2 },
  dot: { position: 'absolute', right: -1, bottom: -1 },
});
