import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Header } from '@/components/ui/header';
import { Row, Section } from '@/components/ui/list';
import { Layout } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { api } from '@/lib/api';
import { formatSom } from '@/lib/format';
import { PushDiagnostics } from '@/components/push-diagnostics';

interface AppSettings {
  commission_percent: number;
  min_balance: number;
}

export default function AdminSettingsScreen() {
  const t = useT();
  const theme = useTheme();
  const [settings, setSettings] = useState<AppSettings>({
    commission_percent: 10,
    min_balance: 10000,
  });

  const [broadcastAll, setBroadcastAll] = useState(false);
  const [byRadius, setByRadius] = useState(true);
  const [byGender, setByGender] = useState(true);

  useEffect(() => {
    api
      .get<AppSettings>('/admin/finance')
      .then((d) => {
        if (d) {
          setSettings({
            commission_percent: d.commission_percent ?? 10,
            min_balance: d.min_balance ?? 10000,
          });
        }
      })
      .catch(() => {});
  }, []);

  const toggle = (value: boolean, onChange: (v: boolean) => void) => (
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ true: theme.success, false: theme.fill }}
      ios_backgroundColor={theme.fill}
    />
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <Header title="Sozlamalar" large back />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Section
          header="Filtrlash"
          footer="Bu sozlamalar ish e'lonlarini qaysi ishchilarga yuborishni belgilaydi."
          separatorInset={Row.ICON_INSET}>
          <Row
            icon="people"
            iconColor="#007AFF"
            title="Hammaga yuborish"
            subtitle="Faqat kategoriya mos kelsa"
            right={toggle(broadcastAll, setBroadcastAll)}
          />
          <Row
            icon="location"
            iconColor="#34C759"
            title="Radius bo'yicha"
            subtitle="Faqat yaqin turganlar"
            right={toggle(byRadius, setByRadius)}
          />
          <Row
            icon="person"
            iconColor="#AF52DE"
            title="Jinsi mos kelganlarga"
            subtitle="E'londa jins tanlansa"
            right={toggle(byGender, setByGender)}
          />
        </Section>

        <Section header="Balans qoidalari" separatorInset={Row.ICON_INSET} style={styles.section}>
          <Row
            icon="wallet"
            iconColor="#FF9500"
            title="Minimal balans"
            subtitle="Bu summadan kam bo'lsa ish kelmaydi"
            value={`${formatSom(settings.min_balance)} ${t('common.som')}`}
          />
          <Row
            icon="pricetag"
            iconColor="#FF2D55"
            title="Komissiya"
            subtitle="Har bir ishdan"
            value={`${settings.commission_percent}%`}
          />
        </Section>

        <Section header="Vaqt" separatorInset={Row.ICON_INSET} style={styles.section}>
          <Row
            icon="time"
            iconColor="#5E5CE6"
            title="Javob vaqti"
            subtitle="Ishchi qabul qilish vaqti"
            value="2 daq"
          />
          <Row
            icon="resize"
            iconColor="#30B0C7"
            title="Radius"
            subtitle="Qidiruv masofasi"
            value="15 km"
          />
        </Section>

        <PushDiagnostics />

        <View style={styles.actions}>
          <Button label={t('common.save')} onPress={() => {}} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingTop: 12, paddingBottom: 40 },
  section: { marginTop: 28 },
  actions: { paddingHorizontal: Layout.gutter, marginTop: 32 },
});
