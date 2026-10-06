/**
 * Choosing a point on a map, full screen.
 *
 * The map used to be draggable inline, in the middle of the order form. Both
 * gestures are a vertical drag, so the map and the page fought over every one:
 * a finger that landed on the card panned the map, and the only way to scroll
 * past it was to grab the narrow strip beside it. There is no way to split one
 * drag between two things — so picking moved out to its own screen, where a
 * drag can only mean the map.
 *
 * The form keeps a preview of the chosen point, which opens this.
 *
 * Confirm-or-discard, not live: the point is only handed back when the user
 * says so, so a stray drag on the way to the close button does not silently
 * move the job across town.
 */

import { useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/text';

import { Button } from '@/components/ui/button';
import { Header } from '@/components/ui/header';
import { YandexMap } from '@/components/yandex-map';
import { Hairline, Layout, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { getCoordsWithFallback } from '@/lib/location';
import type { LatLng } from '@/lib/maps';

interface LocationPickerProps {
  visible: boolean;
  /** Where the map opens — usually whatever the form has now. */
  point: LatLng;
  onClose: () => void;
  onConfirm: (point: LatLng) => void;
}

export function LocationPicker({ visible, point, onClose, onConfirm }: LocationPickerProps) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {/* Mounted per opening, so the draft below simply starts at the form's
          current point every time — no effect resetting state after the fact,
          and a cancelled drag does not come back on the next open. */}
      {visible ? <PickerBody initial={point} onClose={onClose} onConfirm={onConfirm} /> : null}
    </Modal>
  );
}

function PickerBody({
  initial,
  onClose,
  onConfirm,
}: {
  initial: LatLng;
  onClose: () => void;
  onConfirm: (point: LatLng) => void;
}) {
  const t = useT();
  const theme = useTheme();

  const [draft, setDraft] = useState<LatLng>(initial);
  const [locating, setLocating] = useState(false);
  // The map needs a pixel height; it gets whatever is left between the header
  // and the footer bar.
  const [mapHeight, setMapHeight] = useState(0);

  const locate = async () => {
    setLocating(true);
    try {
      const coords = await getCoordsWithFallback(true);
      setDraft({ lat: coords.lat, lng: coords.lng });
    } finally {
      setLocating(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <Header title={t('map.pickTitle')} back onBack={onClose} />

      <View style={styles.mapWrap} onLayout={(e) => setMapHeight(e.nativeEvent.layout.height)}>
        {mapHeight > 0 ? (
          <YandexMap point={draft} height={mapHeight} onPick={setDraft} hideOpenButton />
        ) : null}
      </View>

      <View style={[styles.footer, { borderTopColor: theme.separator }]}>
        <Text style={[Type.footnote, { color: theme.textSecondary }]} numberOfLines={1}>
          {`${draft.lat.toFixed(5)}, ${draft.lng.toFixed(5)}`}
        </Text>

        <View style={styles.actions}>
          <Button
            label={t('order.detectLocation')}
            icon="crosshair"
            variant="gray"
            fullWidth={false}
            loading={locating}
            onPress={locate}
          />
          <Button
            label={t('common.confirm')}
            style={styles.confirm}
            onPress={() => {
              onConfirm(draft);
              onClose();
            }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  // Takes every point between the header and the footer: the map is the screen
  // here, not an illustration on it, and a short map is a map you have to drag
  // ten times to cross a district.
  mapWrap: { flex: 1, paddingHorizontal: Layout.gutter, paddingBottom: 12 },
  footer: {
    borderTopWidth: Hairline,
    paddingHorizontal: Layout.gutter,
    paddingTop: 12,
    gap: 10,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  confirm: { flex: 1 },
});
