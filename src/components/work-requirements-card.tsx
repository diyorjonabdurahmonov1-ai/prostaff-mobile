/**
 * "These have to be on before you can take orders."
 *
 * Shown on the worker's home while a permission the app needs is missing, in
 * the colour the app uses for things that stop work, above the switch — which
 * stays off until every row here is done. Each button goes straight to the one
 * place that fixes its row: the system prompt, or the settings screen with this
 * app already selected. A row turns green by itself when the worker comes back.
 */

import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, Squircle, Type } from '@/constants/theme';
import type { WorkRequirements } from '@/hooks/use-work-requirements';
import { useTheme } from '@/hooks/use-theme';
import { overlayRequired } from '@/lib/overlay';
import { useT } from '@/i18n';

export function WorkRequirementsCard({ requirements }: { requirements: WorkRequirements }) {
  const t = useT();
  const theme = useTheme();

  return (
    <View style={[styles.card, Squircle, { backgroundColor: theme.dangerSoft }]}>
      <View style={styles.head}>
        <View style={[styles.glyph, { backgroundColor: theme.surface }]}>
          <Icon name="shield-checkmark" size={22} color={theme.danger} />
        </View>
        <View style={styles.flex}>
          <Text style={[Type.subheadEmphasized, { color: theme.text }]}>{t('req.title')}</Text>
          <Text style={[Type.footnote, { color: theme.textSecondary }]}>{t('req.body')}</Text>
        </View>
      </View>

      <Row
        icon="notifications"
        title={t('req.notifTitle')}
        hint={t('req.notifHint')}
        granted={requirements.notifications}
        onPress={requirements.askNotifications}
      />
      {overlayRequired ? (
        <Row
          icon="resize"
          title={t('req.overlayTitle')}
          hint={t('req.overlayHint')}
          granted={requirements.overlay}
          onPress={requirements.askOverlay}
        />
      ) : null}
    </View>
  );
}

function Row({
  icon,
  title,
  hint,
  granted,
  onPress,
}: {
  icon: IconName;
  title: string;
  hint: string;
  granted: boolean;
  onPress: () => void;
}) {
  const t = useT();
  const theme = useTheme();
  return (
    <View style={[styles.row, Squircle, { backgroundColor: theme.surface }]}>
      <View style={styles.rowText}>
        <Icon
          name={granted ? 'checkmark-circle' : icon}
          size={20}
          color={granted ? theme.success : theme.danger}
        />
        <View style={styles.flex}>
          <Text style={[Type.footnoteEmphasized, { color: theme.text }]}>{title}</Text>
          <Text style={[Type.caption1, { color: theme.textSecondary }]}>{hint}</Text>
        </View>
      </View>
      {granted ? (
        <Text style={[Type.footnoteEmphasized, { color: theme.success }]}>{t('req.granted')}</Text>
      ) : (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.button,
            Squircle,
            { backgroundColor: theme.danger },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[Type.subheadEmphasized, styles.white]}>{t('req.grant')}</Text>
          <Icon name="chevron-forward" size={14} color="#FFFFFF" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  pressed: { opacity: 0.6 },
  white: { color: '#FFFFFF' },
  card: { borderRadius: Radius.lg, padding: 14, gap: 10, marginBottom: 14 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  glyph: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { borderRadius: Radius.md, padding: 12, gap: 10 },
  rowText: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: Radius.md,
  },
});
