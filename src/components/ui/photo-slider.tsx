/**
 * The photos on a job, at the size they deserve.
 *
 * The order screen used to show them as a strip of 260-point thumbnails, which
 * is the wrong shape for the only picture that matters on that screen: the one
 * explaining what the work actually is. Here they are full card width, one at a
 * time, swiped sideways — and a tap opens them full screen.
 *
 * Dots rather than a counter: at three or four photos a row of dots is read at a
 * glance, and this sits inside a scrolling page where a number would be one more
 * thing to parse.
 */

import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { PhotoViewer, usePhotoViewer } from '@/components/ui/photo-viewer';
import { Layout, Radius, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { resolveImageUrls } from '@/lib/image';

interface PhotoSliderProps {
  uris?: string[] | null;
  /** Uppercase caption above the slider. */
  header?: string;
  height?: number;
}

export function PhotoSlider({ uris, header, height = 240 }: PhotoSliderProps) {
  const theme = useTheme();
  const viewer = usePhotoViewer();
  // The page width is the card width, which is the screen minus the gutters —
  // measured rather than computed, because the two must agree exactly or paging
  // drifts one photo further off with every swipe.
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);

  const resolved = resolveImageUrls(uris);
  if (resolved.length === 0) return null;

  return (
    <View style={styles.section}>
      {header ? (
        <Text style={[Type.footnote, styles.caption, { color: theme.textSecondary }]}>
          {header.toUpperCase()}
        </Text>
      ) : null}

      <View style={styles.frame} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) =>
              setPage(Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width)))
            }>
            {resolved.map((uri, i) => (
              <Pressable
                key={`${uri}-${i}`}
                onPress={() => viewer.open(i)}
                accessibilityRole="imagebutton"
                style={{ width, height }}>
                <Image
                  source={{ uri }}
                  style={[styles.image, { height, backgroundColor: theme.surfaceMuted }]}
                  contentFit="cover"
                  transition={180}
                />
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <View style={{ height }} />
        )}

        {resolved.length > 1 ? (
          <View style={styles.dots} pointerEvents="none">
            {resolved.map((uri, i) => (
              <View
                key={`dot-${uri}-${i}`}
                style={[
                  styles.dot,
                  {
                    backgroundColor: i === page ? '#FFFFFF' : 'rgba(255,255,255,0.45)',
                    width: i === page ? 18 : 6,
                  },
                ]}
              />
            ))}
          </View>
        ) : null}
      </View>

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
  frame: {
    marginHorizontal: Layout.gutter,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  image: { width: '100%', borderRadius: Radius.lg },
  dots: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
  },
  dot: { height: 6, borderRadius: 3 },
});
