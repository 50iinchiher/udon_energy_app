import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Render one read-only system or hardware configuration value.
function InfoRow({ label, value, tone = '#dce5e8' }: { label: string; value: string; tone?: string }) {
  return <View style={styles.infoRow}><Text style={styles.label}>{label}</Text><Text style={[styles.value, { color: tone }]}>{value}</Text></View>;
}

export default function SettingsScreen() {
  // Keep the competition readiness checklist visible for quick setup verification.
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>SYSTEM / READINESS</Text>
        <Text style={styles.title}>System Information</Text>
        <Text style={styles.subtitle}>Verify these conditions before the competition.</Text>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Connection settings</Text>
          <InfoRow label="ESP32 endpoint" value="172.20.10.6/data" />
          <InfoRow label="Polling interval" value="2 seconds" />
          <InfoRow label="Request timeout" value="3 seconds" />
          <InfoRow label="Network" value="Same 2.4 GHz WiFi" tone="#f39c12" />
          <InfoRow label="Screen lock" value="Disabled during app session" tone="#4ecca3" />
          <InfoRow label="Demo mode" value="Available on Dashboard" />
        </View>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Hardware map</Text>
          <InfoRow label="TEG INA219" value="I2C 0x40" tone="#4ecca3" />
          <InfoRow label="Turbine INA219" value="I2C 0x41" tone="#f39c12" />
          <InfoRow label="ESP32 I2C" value="SDA GPIO8 · SCL GPIO9" />
          <InfoRow label="API" value="GET /data" />
        </View>
        <View style={styles.checklist}>
          <Text style={styles.sectionTitle}>Competition checklist</Text>
          {['Computer, phone, and ESP32 share one WiFi network', 'Expo Go is installed', 'ESP32 IP checked in Serial Monitor', 'Both INA219 sensors use the correct addresses', 'npx expo start --lan is running'].map((item) => <View key={item} style={styles.checkRow}><Text style={styles.check}>✓</Text><Text style={styles.checkText}>{item}</Text></View>)}
        </View>
        <Text style={styles.footer}>ThermoTrack Energy System · Expo Go edition</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#10151b' }, content: { padding: 20, paddingBottom: 40 }, eyebrow: { color: '#f39c12', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 }, title: { color: '#f5f7f8', fontSize: 30, fontWeight: '900', marginTop: 7 }, subtitle: { color: '#8e9aa6', fontSize: 13, lineHeight: 20, marginTop: 8 }, card: { backgroundColor: '#18232c', borderRadius: 14, marginTop: 16, padding: 16 }, sectionTitle: { color: '#f5f7f8', fontSize: 15, fontWeight: '800', marginBottom: 5 }, infoRow: { borderBottomColor: '#293943', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 13 }, label: { color: '#84939e', flex: 1, fontSize: 12, paddingRight: 10 }, value: { flexShrink: 1, fontSize: 12, fontWeight: '700', maxWidth: '58%', textAlign: 'right' }, checklist: { backgroundColor: '#18232c', borderColor: '#355248', borderRadius: 14, borderWidth: 1, marginTop: 16, padding: 16 }, checkRow: { alignItems: 'center', flexDirection: 'row', paddingVertical: 9 }, check: { color: '#4ecca3', fontSize: 18, fontWeight: '900', marginRight: 10 }, checkText: { color: '#c6d1d5', flex: 1, fontSize: 12, lineHeight: 17 }, footer: { color: '#50616d', fontSize: 10, marginTop: 22, textAlign: 'center' },
});