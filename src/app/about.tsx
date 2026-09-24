import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Display a compact technology label with a configurable accent color.
function Pill({ children, color = '#4ecca3' }: { children: string; color?: string }) {
  return <View style={[styles.pill, { borderColor: color }]}><Text style={[styles.pillText, { color }]}>{children}</Text></View>;
}

export default function AboutScreen() {
  // Explain the energy-generation concept and the hardware used by the project.
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>PROJECT / TEAM</Text>
        <Text style={styles.title}>About the project</Text>
        <Text style={styles.subtitle}>Turning everyday soup heat and flow into visible, measurable energy.</Text>
        <View style={styles.hero}><Text style={styles.heroMark}>T</Text><View><Text style={styles.heroTitle}>ThermoTrack Energy System</Text><Text style={styles.heroCaption}>Student innovation project</Text></View></View>
        <View style={styles.card}><Text style={styles.sectionTitle}>The idea</Text><Text style={styles.body}>This project demonstrates two ways to harvest energy from hot udon soup: the TEG uses a temperature difference, while the turbine generator uses the movement of flowing soup.</Text></View>
        <View style={styles.card}><Text style={styles.sectionTitle}>How it works</Text><View style={styles.step}><Text style={styles.stepNumber}>01</Text><Text style={styles.stepText}>Hot soup creates a thermal gradient across two TEG modules.</Text></View><View style={styles.step}><Text style={styles.stepNumber}>02</Text><Text style={styles.stepText}>Flow spins a small turbine and DC motor generator.</Text></View><View style={styles.step}><Text style={styles.stepNumber}>03</Text><Text style={styles.stepText}>Two INA219 sensors send voltage, current, and power through ESP32 WiFi.</Text></View></View>
        <View style={styles.card}><Text style={styles.sectionTitle}>Technology</Text><View style={styles.pills}><Pill>ESP32-S3</Pill><Pill color="#f39c12">TEG ×2</Pill><Pill>INA219 ×2</Pill><Pill color="#f39c12">Expo Go</Pill><Pill>Real-time WiFi</Pill></View></View>
        <View style={styles.team}><Text style={styles.sectionTitle}>Team</Text><Text style={styles.teamName}>Student Innovation Team</Text><Text style={styles.body}>Built to make renewable energy tangible, understandable, and memorable.</Text></View>
        <Text style={styles.footer}>ThermoTrack Energy System · 2026</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#10151b' }, content: { padding: 20, paddingBottom: 40 }, eyebrow: { color: '#4ecca3', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 }, title: { color: '#f5f7f8', fontSize: 30, fontWeight: '900', marginTop: 7 }, subtitle: { color: '#8e9aa6', fontSize: 13, lineHeight: 20, marginTop: 8 }, hero: { alignItems: 'center', backgroundColor: '#18232c', borderColor: '#2d4d50', borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 14, marginTop: 20, padding: 18 }, heroMark: { alignItems: 'center', backgroundColor: '#4ecca3', borderRadius: 16, color: '#10201d', fontSize: 30, fontWeight: '900', height: 58, lineHeight: 58, textAlign: 'center', width: 58 }, heroTitle: { color: '#f5f7f8', fontSize: 17, fontWeight: '900' }, heroCaption: { color: '#82cbb4', fontSize: 11, marginTop: 4 }, card: { backgroundColor: '#18232c', borderRadius: 14, marginTop: 14, padding: 16 }, sectionTitle: { color: '#f5f7f8', fontSize: 15, fontWeight: '800', marginBottom: 10 }, body: { color: '#aebdc3', fontSize: 13, lineHeight: 20 }, step: { alignItems: 'flex-start', borderTopColor: '#2b3b47', borderTopWidth: 1, flexDirection: 'row', gap: 12, paddingVertical: 12 }, stepNumber: { color: '#f39c12', fontSize: 11, fontWeight: '900', marginTop: 2 }, stepText: { color: '#c6d1d5', flex: 1, fontSize: 12, lineHeight: 18 }, pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, pill: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 }, pillText: { fontSize: 10, fontWeight: '800' }, team: { backgroundColor: '#1c2e2b', borderColor: '#376a5a', borderRadius: 14, borderWidth: 1, marginTop: 14, padding: 16 }, teamName: { color: '#f5f7f8', fontSize: 18, fontWeight: '900', marginBottom: 6 }, footer: { color: '#50616d', fontSize: 10, marginTop: 22, textAlign: 'center' },
});
