/**
 * A read-only horizontal strip of photos, for the profiles a customer reads
 * before booking. The editable twin is `ImageStrip`.
 *
 * Renders nothing at all when there are no photos — an empty captioned band is
 * a worse answer than silence on a profile that simply has no gallery yet.
 */

import { Image } from 'expo-image';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/text';

import { PhotoViewer, usePhotoViewer } from '@/components/ui/photo-viewer';
import { Layout, Radius, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { resolveImageUrls } from '@/lib/image';

interface PhotoGalleryProps {
  uris?: string[] | null;
  /** Uppercase caption above the strip. */
  header?: string;
  height?: number;
  width?: number;
}

export function PhotoGallery({ uris, header, height = 130, width = 180 }: PhotoGalleryProps) {
  const theme = useTheme();
  const viewer = usePhotoViewer();
  // Re-point at the host this app is actually talking to; see lib/image.
  const resolved = resolveImageUrls(uris);
  if (resolved.length === 0) return null;

  return (
    <View style={styles.section}>
      {header ? (
        <Text style={[Type.footnote, styles.caption, { color: theme.textSecondary }]}>
          {header.toUpperCase()}
        </Text>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {resolved.map((uri, i) => (
          // Tappable: a thumbnail of somebody's work is a promise that there is
          // a photo behind it, and a strip you can only look at breaks it.
          <Pressable
            key={`${uri}-${i}`}
            onPress={() => viewer.open(i)}
            accessibilityRole="imagebutton"
            style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
            <Image
              source={{ uri }}
              style={[styles.image, { width, height, backgroundColor: theme.surfaceMuted }]}
              contentFit="cover"
              transition={180}
            />
          </Pressable>
        ))}
      </ScrollView>

      <PhotoViewer
        uris={resolved}
        index={viewer.index}
        visible={viewer.visible}
        onClose={viewer.close}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 28 },
  caption: { paddingHorizontal: Layout.gutter + 4, marginBottom: 8 },
  row: { paddingHorizontal: Layout.gutter, gap: 10 },
  image: { borderRadius: Radius.lg },
  pressed: { opacity: 0.8 },
});
