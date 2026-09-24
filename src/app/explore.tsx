import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ESP32_URL = 'http://172.20.xx.x/data';
type Source = { voltage: number; current_mA: number; power_mW: number };
type Comparison = { teg: Source; turbine: Source; total: number };
const empty: Source = { voltage: 0, current_mA: 0, power_mW: 0 };

function parse(value: any): Comparison {
  if (value.teg && value.turbine) return { teg: value.teg, turbine: value.turbine, total: value.total_power_mW ?? value.teg.power_mW + value.turbine.power_mW };
  const source = { voltage: value.voltage ?? 0, current_mA: value.current_mA ?? value.current ?? 0, power_mW: value.power_mW ?? value.power ?? 0 };
  return { teg: source, turbine: empty, total: source.power_mW };
}

function Bar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const percent = total > 0 ? Math.min(100, Math.max(0, (value / total) * 100)) : 0;
  return <View style={styles.barRow}><View style={styles.barLabel}><Text style={styles.barName}>{label}</Text><Text style={[styles.barValue, { color }]}>{value.toFixed(2)} mW</Text></View><View style={styles.track}><View style={[styles.fill, { backgroundColor: color, width: `${percent}%` }]} /></View><Text style={styles.percent}>{percent.toFixed(0)}%</Text></View>;
}

export default function ComparisonScreen() {
  const { width } = useWindowDimensions();
  const compact = width < 380;
  const [data, setData] = useState<Comparison | null>(null);
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    let active = true;
    const poll = async () => {
      try { const response = await fetch(ESP32_URL); if (!response.ok) throw new Error('HTTP'); const next = parse(await response.json()); if (active) { setData(next); setConnected(true); } }
      catch { if (active) setConnected(false); }
    };
    poll(); const timer = setInterval(poll, 2000); return () => { active = false; clearInterval(timer); };
  }, []);
  const view = data ?? { teg: empty, turbine: empty, total: 0 };
  const winner = view.teg.power_mW >= view.turbine.power_mW ? 'TEG' : 'Turbine';
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={[styles.content, compact && styles.compactContent]}>
    <Text style={styles.eyebrow}>SOURCE ANALYSIS / LIVE</Text><Text style={[styles.title, compact && styles.compactTitle]}>Source Comparison</Text><Text style={styles.subtitle}>Compare which generation method is producing more power in real time.</Text>
    <View style={styles.hero}><Text style={styles.heroLabel}>HIGHEST OUTPUT</Text><Text style={styles.heroValue}>{winner}</Text><Text style={styles.heroHint}>{connected ? 'Based on the current reading' : 'Based on the last reading'}</Text></View>
    <View style={styles.card}><Text style={styles.sectionTitle}>Power contribution</Text><Bar label="TEG" value={view.teg.power_mW} total={view.total} color="#4ecca3" /><Bar label="Turbine" value={view.turbine.power_mW} total={view.total} color="#f39c12" /></View>
    <View style={styles.card}><Text style={styles.sectionTitle}>Key measurements</Text><View style={styles.grid}><View style={styles.cell}><Text style={styles.cellLabel}>TEG voltage</Text><Text style={styles.cellValue}>{view.teg.voltage.toFixed(3)} V</Text></View><View style={styles.cell}><Text style={styles.cellLabel}>Turbine voltage</Text><Text style={styles.cellValue}>{view.turbine.voltage.toFixed(3)} V</Text></View><View style={styles.cell}><Text style={styles.cellLabel}>TEG current</Text><Text style={styles.cellValue}>{view.teg.current_mA.toFixed(2)} mA</Text></View><View style={styles.cell}><Text style={styles.cellLabel}>Turbine current</Text><Text style={styles.cellValue}>{view.turbine.current_mA.toFixed(2)} mA</Text></View></View></View>
    <View style={styles.note}><Text style={styles.noteIcon}>i</Text><Text style={styles.noteText}>TEG converts temperature difference into electricity, while the turbine uses soup flow. Total power: {view.total.toFixed(2)} mW</Text></View>
    {!data && <ActivityIndicator color="#4ecca3" style={styles.loader} />}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#10151b' }, content: { padding: 20, paddingBottom: 40 }, compactContent: { paddingHorizontal: 14 }, eyebrow: { color: '#f39c12', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 }, title: { color: '#f5f7f8', fontSize: 29, fontWeight: '900', marginTop: 7 }, compactTitle: { fontSize: 26 }, subtitle: { color: '#8e9aa6', fontSize: 13, lineHeight: 20, marginTop: 8 }, hero: { backgroundColor: '#1c2e2b', borderColor: '#376a5a', borderRadius: 14, borderWidth: 1, marginTop: 20, padding: 20 }, heroLabel: { color: '#82cbb4', fontSize: 10, fontWeight: '800', letterSpacing: 1 }, heroValue: { color: '#f5f7f8', fontSize: 34, fontWeight: '900', marginTop: 6 }, heroHint: { color: '#8bb8aa', fontSize: 11, marginTop: 3 }, card: { backgroundColor: '#18232c', borderRadius: 14, marginTop: 14, padding: 16 }, sectionTitle: { color: '#f5f7f8', fontSize: 15, fontWeight: '800', marginBottom: 16 }, barRow: { marginBottom: 16 }, barLabel: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 }, barName: { color: '#c6d1d5', fontSize: 12, fontWeight: '700' }, barValue: { fontSize: 12, fontWeight: '800' }, track: { backgroundColor: '#2b3b44', borderRadius: 4, height: 8, overflow: 'hidden' }, fill: { borderRadius: 4, height: '100%' }, percent: { color: '#72828c', fontSize: 10, marginTop: 4, textAlign: 'right' }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 1 }, cell: { backgroundColor: '#202e37', flexBasis: '49%', flexGrow: 1, padding: 12 }, cellLabel: { color: '#82909a', fontSize: 10 }, cellValue: { color: '#f5f7f8', fontSize: 17, fontWeight: '800', marginTop: 5 }, note: { alignItems: 'center', backgroundColor: '#24251e', borderRadius: 10, flexDirection: 'row', marginTop: 14, padding: 13 }, noteIcon: { alignItems: 'center', borderColor: '#f39c12', borderRadius: 8, borderWidth: 1, color: '#f39c12', fontSize: 12, fontWeight: '900', height: 20, lineHeight: 18, marginRight: 10, textAlign: 'center', width: 20 }, noteText: { color: '#b9b59c', flex: 1, fontSize: 11, lineHeight: 17 }, loader: { margin: 20 } });
