/**
 * Photos, full screen, swiped one to the next.
 *
 * Every gallery in the app used to be a dead end: a strip of thumbnails you
 * could look at and nothing more. A worker's portfolio, a firm's gallery, the
 * photos attached to a job — in all three the picture *is* the content, and a
 * 130-point thumbnail of a broken pipe tells nobody anything.
 *
 * So there is one viewer and every gallery opens it. Black background because
 * that is what a photo wants behind it; the counter and the close button are the
 * only chrome, and both sit clear of the notch.
 *
 * Paging is the platform's own — a horizontal `ScrollView` with `pagingEnabled`
 * — rather than a gesture library: the whole interaction is "swipe sideways",
 * and a dependency to do that would be a dependency to maintain.
 */

import { Image } from 'expo-image';
import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { Icon } from '@/components/ui/icon';
import { Type } from '@/constants/theme';
import { resolveImageUrls } from '@/lib/image';

interface PhotoViewerProps {
  uris?: string[] | null;
  /** Which photo to open on — the one that was tapped. */
  index?: number;
  visible: boolean;
  onClose: () => void;
}

export function PhotoViewer({ uris, index = 0, visible, onClose }: PhotoViewerProps) {
  const { width, height } = useWindowDimensions();
  const resolved = resolveImageUrls(uris);

  // Which page is on screen, for the counter. Seeded from `index` and re-seeded
  // whenever the viewer is opened on a different photo — derived from a prop
  // during render, which is React's own answer for exactly this.
  const [page, setPage] = useState(index);
  const [openedAt, setOpenedAt] = useState(index);
  if (index !== openedAt) {
    setOpenedAt(index);
    setPage(index);
  }

  if (resolved.length === 0) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          // Landing on the tapped photo rather than always the first: the strip
          // is a row of different things, and opening the wrong one makes the
          // viewer feel like it ignored the tap.
          contentOffset={{ x: openedAt * width, y: 0 }}
          onMomentumScrollEnd={(e) =>
            setPage(Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width)))
          }>
          {resolved.map((uri, i) => (
            <View key={`${uri}-${i}`} style={{ width, height }}>
              <Image
                source={{ uri }}
                style={StyleSheet.absoluteFill}
                // `contain`: a photo of a job is evidence, and cropping evidence
                // to fill a rectangle is how the important corner disappears.
                contentFit="contain"
                transition={150}
              />
            </View>
          ))}
        </ScrollView>

        <SafeAreaView style={styles.chrome} pointerEvents="box-none" edges={['top']}>
          {resolved.length > 1 ? (
            <View style={styles.counter}>
              <Text style={[Type.footnoteEmphasized, styles.counterText]}>
                {page + 1} / {resolved.length}
              </Text>
            </View>
          ) : (
            <View />
          )}
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="×"
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
            <Icon name="close" size={20} color="#FFFFFF" />
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

/**
 * The state a screen needs to open the viewer.
 *
 * Two pieces of state and a handler, in every screen with a gallery — so they
 * live here once instead of being retyped six times.
 */
export function usePhotoViewer() {
  const [state, setState] = useState<{ open: boolean; index: number }>({ open: false, index: 0 });
  return {
    visible: state.open,
    index: state.index,
    open: (index = 0) => setState({ open: true, index }),
    close: () => setState((prev) => ({ ...prev, open: false })),
  };
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000' },
  chrome: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  counter: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  counterText: { color: '#FFFFFF' },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  pressed: { opacity: 0.6 },
});
