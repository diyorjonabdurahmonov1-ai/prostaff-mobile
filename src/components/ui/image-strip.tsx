/**
 * A horizontal strip of photo slots.
 *
 * Filled slots come first, then a single dashed "add" slot — an empty grid of
 * five identical dashed boxes reads as five required fields, which photos
 * never are. A new thumbnail springs in from 0 so the tap is confirmed by the
 * picture appearing, not by a spinner.
 *
 * `max` is whatever the caller can actually persist. The order flow sends one
 * `image_url` per order, so it passes 1; company profiles carry an `images[]`
 * array and can pass more.
 */

import { Image } from 'expo-image';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/text';

import { PopIn } from '@/components/motion';
import { Duration, Radius, Squircle, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { resolveImageUrl } from '@/lib/image';

import { Icon } from './icon';
import { PressableScale } from './pressable-scale';

const SLOT = 72;

interface ImageStripProps {
  uris: string[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  max?: number;
  addLabel: string;
}

export function ImageStrip({ uris, onAdd, onRemove, max = 5, addLabel }: ImageStripProps) {
  const theme = useTheme();
  const canAdd = uris.length < max;

  return (
    <View style={styles.strip}>
      {uris.map((uri, i) => (
        <PopIn key={`${uri}-${i}`} duration={Duration.base} style={styles.slot}>
          <Image
            source={{ uri: resolveImageUrl(uri) }}
            style={styles.thumb}
            contentFit="cover"
            transition={160}
          />
          <Pressable
            onPress={() => onRemove(i)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`${addLabel} ${i + 1}`}
            style={[styles.remove, { backgroundColor: theme.text }]}>
            <Icon name="close" size={12} color={theme.surface} weight="bold" />
          </Pressable>
        </PopIn>
      ))}

      {canAdd ? (
        <PressableScale
          onPress={onAdd}
          scaleTo={0.94}
          accessibilityLabel={addLabel}
          style={[styles.add, Squircle, { borderColor: theme.border }]}>
          <Icon name="plus" size={22} color={theme.textTertiary} weight="bold" />
          {uris.length === 0 ? (
            <Text style={[Type.caption2, styles.addLabel, { color: theme.textTertiary }]} numberOfLines={1}>
              {addLabel}
            </Text>
          ) : null}
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  slot: { width: SLOT, height: SLOT },
  thumb: { width: SLOT, height: SLOT, borderRadius: Radius.md },
  remove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  add: {
    width: SLOT,
    height: SLOT,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  addLabel: { paddingHorizontal: 4, textAlign: 'center' },
});
