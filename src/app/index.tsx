import { useKeepAwake } from 'expo-keep-awake';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// The ESP32 serves the latest sensor readings from this endpoint.
const ESP32_URL = 'http://172.20.xx.x/data';
const POLL_INTERVAL_MS = 2000;
const REQUEST_TIMEOUT_MS = 3000;
const MAX_HISTORY_POINTS = 60;

type SourceData = {
  voltage: number;
  current_mA: number;
  power_mW: number;
};

type ApiData = {
  teg: SourceData;
  turbine: SourceData;
  total_power_mW: number;
  hotTemperature_C?: number;
  coldTemperature_C?: number;
  deltaT_C?: number;
};

type HistoryPoint = {
  teg: number;
  turbine: number;
};

const emptySource: SourceData = { voltage: 0, current_mA: 0, power_mW: 0 };

// Validate a sensor object before using values returned by the ESP32.
function isSourceData(value: unknown): value is SourceData {
  if (!value || typeof value !== 'object') return false;
  const source = value as Record<string, unknown>;
  return ['voltage', 'current_mA', 'power_mW'].every((key) => typeof source[key] === 'number');
}

// Normalize both the current API response and the legacy flat response format.
function parseApiData(value: unknown): ApiData {
  if (!value || typeof value !== 'object') throw new Error('Invalid response');
  const json = value as Record<string, unknown>;
  const hotTemperature_C = typeof json.hotTemperature_C === 'number' ? json.hotTemperature_C : typeof json.hot_temp_C === 'number' ? json.hot_temp_C : undefined;
  const coldTemperature_C = typeof json.coldTemperature_C === 'number' ? json.coldTemperature_C : typeof json.cold_temp_C === 'number' ? json.cold_temp_C : undefined;
  const deltaT_C = typeof json.deltaT_C === 'number' ? json.deltaT_C : hotTemperature_C !== undefined && coldTemperature_C !== undefined ? hotTemperature_C - coldTemperature_C : undefined;

  if (isSourceData(json.teg) && isSourceData(json.turbine) && typeof json.total_power_mW === 'number') {
    return {
      teg: json.teg,
      turbine: json.turbine,
      total_power_mW: json.total_power_mW,
      hotTemperature_C,
      coldTemperature_C,
      deltaT_C,
    };
  }

  if (isSourceData(json)) {
    return { teg: json, turbine: emptySource, total_power_mW: json.power_mW, hotTemperature_C, coldTemperature_C, deltaT_C };
  }

  const voltage = json.voltage;
  const current = json.current_mA ?? json.current;
  const power = json.power_mW ?? json.power;
  if (typeof voltage === 'number' && typeof current === 'number' && typeof power === 'number') {
    const teg = { voltage, current_mA: current, power_mW: power };
    return { teg, turbine: emptySource, total_power_mW: power, hotTemperature_C, coldTemperature_C, deltaT_C };
  }

  throw new Error('Invalid response');
}

function formatValue(value: number, decimals: number) {
  return Number.isFinite(value) ? value.toFixed(decimals) : '0.00';
}

function getPowerContext(power: number) {
  const ledMinutes = power > 0 ? (power / 100) * 60 : 0;
  const phoneHours = power > 0 ? 150 / power : 0;
  if (power <= 0) return 'Generate power to see a real-world comparison.';
  return `At this rate: about ${ledMinutes.toFixed(1)} min of a 100 mW LED per hour, or 1% of a phone battery in about ${phoneHours.toFixed(1)} h.`;
}

function Metric({ label, value, unit, decimals = 2 }: { label: string; value: number; unit: string; decimals?: number }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{formatValue(value, decimals)}</Text>
      <Text style={styles.metricUnit}>{unit}</Text>
    </View>
  );
}

function SourceCard({ title, subtitle, color, source }: { title: string; subtitle: string; color: string; source: SourceData }) {
  return (
    <View style={[styles.sourceCard, { borderTopColor: color }]}>
      <View style={styles.cardHeading}>
        <View>
          <Text style={[styles.sourceTitle, { color }]}>{title}</Text>
          <Text style={styles.sourceSubtitle}>{subtitle}</Text>
        </View>
        <View style={[styles.sourceDot, { backgroundColor: color }]} />
      </View>
      <View style={styles.metricsRow}>
        <Metric label="Voltage" value={source.voltage} unit="V" decimals={3} />
        <Metric label="Current" value={source.current_mA} unit="mA" />
        <Metric label="Power" value={source.power_mW} unit="mW" />
      </View>
    </View>
  );
}

function TrendChart({ history }: { history: HistoryPoint[] }) {
  // Show the most recent 30 samples while keeping the full 60-second history in state.
  const peak = Math.max(1, ...history.flatMap((point) => [point.teg, point.turbine]));
  const points = history.slice(-30);

  return (
    <View style={styles.trendCard}>
      <View style={styles.trendHeader}>
        <Text style={styles.sectionTitle}>Last 60 seconds</Text>
        <View style={styles.legend}>
          <View style={[styles.legendDot, { backgroundColor: '#4ecca3' }]} /><Text style={styles.legendText}>TEG</Text>
          <View style={[styles.legendDot, { backgroundColor: '#f39c12' }]} /><Text style={styles.legendText}>Turbine</Text>
        </View>
      </View>
      <View style={styles.chart}>
        {points.map((point, index) => (
          <View key={`${index}-${point.teg}-${point.turbine}`} style={styles.chartColumn}>
            <View style={[styles.chartBar, { height: `${Math.max(3, (point.teg / peak) * 100)}%`, backgroundColor: '#4ecca3' }]} />
            <View style={[styles.chartBar, { height: `${Math.max(3, (point.turbine / peak) * 100)}%`, backgroundColor: '#f39c12' }]} />
          </View>
        ))}
      </View>
      <Text style={styles.chartCaption}>Power (mW) · updates every 2 seconds</Text>
    </View>
  );
}

function EnergyGlass({ power, active }: { power: number; active: boolean }) {
  const fill = useRef(new Animated.Value(0)).current;
  const motion = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0.45)).current;
  const level = Math.min(1, Math.max(0, power / 100));

  // Animate the liquid level whenever a new total power value arrives.
  useEffect(() => {
    Animated.timing(fill, {
      toValue: level,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [fill, level]);

  // Keep the decorative motion running while the dashboard is mounted.
  useEffect(() => {
    const motionLoop = Animated.loop(
      Animated.timing(motion, {
        toValue: 1,
        duration: 2600,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
    );
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.45, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    motionLoop.start();
    glowLoop.start();
    return () => {
      motionLoop.stop();
      glowLoop.stop();
    };
  }, [glow, motion]);

  const fillHeight = fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const waveTransform = motion.interpolate({ inputRange: [0, 1], outputRange: ['-7deg', '7deg'] });
  const bubbleRise = motion.interpolate({ inputRange: [0, 1], outputRange: [12, -58] });
  const bubbleFade = motion.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 0.9, 0.65, 0] });
  const streamFall = motion.interpolate({ inputRange: [0, 1], outputRange: [-10, 56] });
  const streamFade = motion.interpolate({ inputRange: [0, 0.18, 0.72, 1], outputRange: [0, 1, 1, 0] });
  const orbitRotate = motion.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.energyVisual}>
      <View style={styles.glassStage}>
        <Animated.View style={[styles.energyOrbit, { transform: [{ rotate: orbitRotate }] }]}>
          <View style={styles.orbitDot} />
        </Animated.View>
        {active && (
          <>
            <Animated.View style={[styles.energyDrop, styles.energyDropOne, { opacity: streamFade, transform: [{ translateY: streamFall }] }]} />
            <Animated.View style={[styles.energyDrop, styles.energyDropTwo, { opacity: streamFade, transform: [{ translateY: streamFall }] }]} />
          </>
        )}
        <View style={styles.glassHandle} />
        <Animated.View style={[styles.glassGlow, { opacity: glow }]} />
        <View style={styles.glass}>
          <Animated.View style={[styles.glassLiquid, { height: fillHeight }]}>
            <Animated.View style={[styles.liquidSurface, { transform: [{ rotate: waveTransform }] }]} />
            <Animated.View style={[styles.liquidShine, { opacity: glow }]} />
            <Animated.View style={[styles.bubble, styles.bubbleOne, { opacity: bubbleFade, transform: [{ translateY: bubbleRise }] }]} />
            <Animated.View style={[styles.bubble, styles.bubbleTwo, { opacity: bubbleFade, transform: [{ translateY: bubbleRise }] }]} />
            <Animated.View style={[styles.bubble, styles.bubbleThree, { opacity: bubbleFade, transform: [{ translateY: bubbleRise }] }]} />
          </Animated.View>
          <View style={styles.glassRim} />
        </View>
      </View>
      <View style={styles.energyCopy}>
        <View style={styles.energyStatusLine}>
          <View style={[styles.energyLiveDot, { backgroundColor: active ? '#4ecca3' : '#65747d' }]} />
          <Text style={styles.energyEyebrow}>{active ? 'ENERGY COLLECTING' : 'WAITING FOR ENERGY'}</Text>
        </View>
        <Text style={styles.energyPercent}>{Math.round(level * 100)}%</Text>
        <Text style={styles.energyCaption}>100 mW demo scale</Text>
        <Text style={styles.energyNote}>TEG + Turbine output visualized as a filling glass</Text>
      </View>
    </View>
  );
}

export default function Index() {
  const { width } = useWindowDimensions();
  const compact = width < 380;
  useKeepAwake();
  const [data, setData] = useState<ApiData | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [energyMWh, setEnergyMWh] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [demoMode, setDemoMode] = useState(false);
  const [sessionBest, setSessionBest] = useState(0);
  const [newBest, setNewBest] = useState(false);

  // Poll the ESP32 and update the dashboard history at a fixed interval.
  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        let nextData: ApiData;
        if (demoMode) {
          const wave = (Math.sin(Date.now() / 2200) + 1) / 2;
          const tegPower = 22 + wave * 18;
          const turbinePower = 5 + (1 - wave) * 9;
          nextData = { teg: { voltage: 0.82 + wave * 0.16, current_mA: tegPower / 0.9, power_mW: tegPower }, turbine: { voltage: 0.36 + (1 - wave) * 0.2, current_mA: turbinePower / 0.5, power_mW: turbinePower }, total_power_mW: tegPower + turbinePower, hotTemperature_C: 64 + wave * 8, coldTemperature_C: 22, deltaT_C: 42 + wave * 8 };
        } else {
          const response = await fetch(ESP32_URL, { signal: controller.signal });
          if (!response.ok) throw new Error('HTTP error');
          nextData = parseApiData(await response.json());
        }
        if (!isMounted) return;
        setData(nextData);
        setHistory((current) => [...current, { teg: nextData.teg.power_mW, turbine: nextData.turbine.power_mW }].slice(-MAX_HISTORY_POINTS));
        setEnergyMWh((current) => current + Math.max(0, nextData.total_power_mW) * (POLL_INTERVAL_MS / 3600000));
        setLastUpdated(new Date());
        setError(null);
        setIsConnected(true);
        setSessionBest((current) => {
          if (nextData.total_power_mW > current) setNewBest(true);
          return Math.max(current, nextData.total_power_mW);
        });
        if (nextData.total_power_mW > 0) setTimeout(() => setNewBest(false), 1800);
      } catch (requestError) {
        if (!isMounted) return;
        setIsConnected(false);
        setError(requestError instanceof Error && requestError.name === 'AbortError' ? 'Request timed out. Retrying...' : 'Connection lost. Retrying...');
      } finally {
        clearTimeout(timeout);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [demoMode, refreshKey]);

  const displayData = data ?? { teg: emptySource, turbine: emptySource, total_power_mW: 0 };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={[styles.container, compact && styles.containerCompact]}>
        <View style={[styles.header, compact && styles.headerCompact]}>
          <View>
            <View style={styles.brandLine}>
              <View style={styles.brandMark}><Text style={styles.brandMarkText}>U</Text></View>
              <Text style={styles.eyebrow}>TEG + TURBINE ENERGY MONITOR</Text>
            </View>
            <Text style={styles.title}>ThermoTrack Energy System</Text>
            <Text style={styles.subtitle}>TEG: thermal difference  ·  Turbine: fluid flow</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable accessibilityLabel="Refresh ESP32 data" onPress={() => setRefreshKey((current) => current + 1)} style={styles.refreshButton}>
              <Text style={styles.refreshIcon}>↻</Text>
            </Pressable>
            <View style={styles.statusWrap}>
              <View style={[styles.statusDot, { backgroundColor: isConnected ? '#4ecca3' : '#e74c3c' }]} />
              <Text style={[styles.statusText, { color: isConnected ? '#4ecca3' : '#e74c3c' }]}>{isConnected ? 'CONNECTED' : 'OFFLINE'}</Text>
            </View>
            <Pressable accessibilityLabel="Toggle demo mode" onPress={() => setDemoMode((current) => !current)} style={[styles.demoButton, demoMode && styles.demoButtonActive]}>
              <Text style={[styles.demoButtonText, demoMode && styles.demoButtonTextActive]}>{demoMode ? 'DEMO ON' : 'DEMO MODE'}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.totalCard}>
          <View style={styles.cardAccent} />
          <View style={styles.telemetryBadge}><View style={styles.telemetryDot} /><Text style={styles.telemetryText}>LIVE TELEMETRY</Text></View>
          <Text style={styles.totalLabel}>TOTAL POWER</Text>
          <Text style={[styles.totalValue, compact && styles.totalValueCompact]}>{formatValue(displayData.total_power_mW, 2)}<Text style={styles.totalUnit}> mW</Text></Text>
          <Text style={styles.totalHint}>{data ? 'Live measurement from ESP32' : 'Waiting for measurements...'}</Text>
          {newBest && <View style={styles.recordBanner}><Text style={styles.recordIcon}>✦</Text><Text style={styles.recordText}>NEW SESSION RECORD</Text></View>}
          <EnergyGlass active={isConnected && displayData.total_power_mW > 0} power={displayData.total_power_mW} />
          <Text style={styles.comparison}>{getPowerContext(displayData.total_power_mW)}</Text>
          <View style={styles.totalMeta}>
            <View>
              <Text style={styles.metaLabel}>ACCUMULATED</Text>
              <Text style={styles.metaValue}>{formatValue(energyMWh, 3)} mWh</Text>
            </View>
            <View style={styles.metaRight}>
              <Text style={styles.metaLabel}>LAST UPDATED</Text>
              <Text style={styles.metaValue}>{lastUpdated ? lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'}</Text>
            </View>
          </View>
          <View style={styles.bestRow}><Text style={styles.metaLabel}>SESSION BEST</Text><Text style={styles.bestValue}>{formatValue(sessionBest, 2)} mW</Text></View>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}
        {!data && !error && <ActivityIndicator style={styles.loader} size="small" color="#4ecca3" />}

        <View style={[styles.sourceList, !isConnected && styles.staleData]}>
          <SourceCard title="TEG" subtitle="Thermoelectric Generator" color="#4ecca3" source={displayData.teg} />
          <SourceCard title="TURBINE" subtitle="Flow Generator" color="#f39c12" source={displayData.turbine} />
        </View>

        {history.length > 1 && <TrendChart history={history} />}
        <View style={styles.deltaCard}>
          <View><Text style={styles.deltaLabel}>THERMAL DRIVER</Text><Text style={styles.deltaTitle}>{displayData.deltaT_C !== undefined ? `ΔT ${formatValue(displayData.deltaT_C, 1)}°C → TEG output` : 'DS18B20 data not available'}</Text></View>
          <Text style={styles.deltaHint}>{displayData.deltaT_C !== undefined ? 'Higher temperature difference can increase the TEG voltage.' : 'Add hot/cold temperature fields to /data to show this insight.'}</Text>
        </View>
        <Text style={styles.footer}>ESP32 WiFi · /data · every 2 seconds · Code: {ESP32_URL.replace('http://', '')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#10151b' },
  container: { padding: 20, paddingBottom: 32 },
  containerCompact: { paddingHorizontal: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 },
  headerCompact: { flexDirection: 'column', gap: 14 },
  brandLine: { alignItems: 'center', flexDirection: 'row', gap: 8, marginBottom: 6 },
  brandMark: { alignItems: 'center', backgroundColor: '#4ecca3', borderRadius: 7, height: 22, justifyContent: 'center', width: 22 },
  brandMarkText: { color: '#10201d', fontSize: 14, fontWeight: '900' },
  eyebrow: { color: '#708090', fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginBottom: 6 },
  title: { color: '#f5f7f8', fontSize: 25, fontWeight: '800' },
  subtitle: { color: '#8e9aa6', fontSize: 12, marginTop: 6 },
  headerActions: { alignItems: 'flex-end', gap: 12 },
  refreshButton: { alignItems: 'center', backgroundColor: '#1d3039', borderColor: '#35505b', borderRadius: 8, borderWidth: 1, height: 36, justifyContent: 'center', width: 36 },
  refreshIcon: { color: '#4ecca3', fontSize: 24, lineHeight: 28 },
  statusWrap: { alignItems: 'flex-end', gap: 6 },
  statusDot: { width: 11, height: 11, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '800' },
  demoButton: { backgroundColor: '#272b31', borderColor: '#4a5660', borderRadius: 9, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 7 },
  demoButtonActive: { backgroundColor: '#3d3020', borderColor: '#f39c12' },
  demoButtonText: { color: '#9ba8af', fontSize: 9, fontWeight: '900' },
  demoButtonTextActive: { color: '#f39c12' },
  totalCard: { backgroundColor: '#18232c', borderColor: '#2b3b47', borderRadius: 18, borderWidth: 1, elevation: 8, marginBottom: 14, overflow: 'hidden', padding: 22, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 18 },
  cardAccent: { backgroundColor: '#4ecca3', height: 3, left: 22, position: 'absolute', right: '65%', top: 0 },
  telemetryBadge: { alignItems: 'center', alignSelf: 'flex-end', backgroundColor: '#102d2a', borderColor: '#286255', borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 6, paddingHorizontal: 9, paddingVertical: 5 },
  telemetryDot: { backgroundColor: '#4ecca3', borderRadius: 4, height: 6, width: 6 },
  telemetryText: { color: '#82cbb4', fontSize: 9, fontWeight: '800', letterSpacing: 0.7 },
  totalLabel: { color: '#9aaab5', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  totalValue: { color: '#f5f7f8', fontSize: 48, fontWeight: '900', marginTop: 4 },
  totalValueCompact: { fontSize: 40 },
  totalUnit: { color: '#4ecca3', fontSize: 22, fontWeight: '700' },
  totalHint: { color: '#687984', fontSize: 12, marginTop: 3 },
  recordBanner: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#3a2b18', borderColor: '#f39c12', borderRadius: 10, flexDirection: 'row', gap: 5, marginTop: 10, paddingHorizontal: 8, paddingVertical: 5 },
  recordIcon: { color: '#f39c12', fontSize: 12 },
  recordText: { color: '#f8c66d', fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  comparison: { color: '#9eb0b8', fontSize: 11, lineHeight: 17, marginTop: 13 },
  energyVisual: { alignItems: 'center', flexDirection: 'row', gap: 18, marginTop: 18, minHeight: 138 },
  glassStage: { alignItems: 'center', height: 124, justifyContent: 'flex-end', width: 112 },
  energyOrbit: { borderColor: 'rgba(78, 204, 163, 0.32)', borderRadius: 58, borderWidth: 1, height: 112, position: 'absolute', transform: [{ rotate: '0deg' }], width: 112 },
  orbitDot: { backgroundColor: '#f39c12', borderRadius: 4, height: 7, position: 'absolute', right: 12, top: 18, width: 7 },
  glass: { backgroundColor: 'rgba(103, 211, 181, 0.08)', borderColor: '#79cdb8', borderRadius: 12, borderTopWidth: 2, borderWidth: 2, bottom: 0, height: 104, overflow: 'hidden', position: 'absolute', width: 76 },
  glassGlow: { backgroundColor: '#4ecca3', borderRadius: 48, bottom: 7, height: 92, opacity: 0.45, position: 'absolute', shadowColor: '#4ecca3', shadowOpacity: 0.9, shadowRadius: 20, width: 92 },
  energyDrop: { backgroundColor: '#a5ffdf', borderRadius: 4, height: 8, position: 'absolute', shadowColor: '#4ecca3', shadowOpacity: 1, shadowRadius: 7, width: 8, zIndex: 3 },
  energyDropOne: { left: 47, top: 2 },
  energyDropTwo: { left: 64, top: 2 },
  glassRim: { borderColor: 'rgba(220, 255, 246, 0.65)', borderRadius: 8, borderWidth: 1, height: 8, left: 5, position: 'absolute', right: 5, top: 6 },
  glassHandle: { borderColor: '#79cdb8', borderLeftWidth: 2, borderRadius: 18, borderRightWidth: 2, height: 52, position: 'absolute', right: 5, top: 37, width: 26 },
  glassLiquid: { backgroundColor: '#2c9a7b', bottom: 0, left: 0, opacity: 0.88, position: 'absolute', right: 0 },
  liquidSurface: { backgroundColor: '#6ee0c2', borderRadius: 50, height: 9, left: -7, opacity: 0.72, position: 'absolute', right: -7, top: -4 },
  liquidShine: { backgroundColor: 'rgba(220, 255, 246, 0.42)', height: 3, left: 8, position: 'absolute', right: 8, top: 8 },
  bubble: { backgroundColor: 'rgba(220, 255, 246, 0.7)', borderRadius: 5, position: 'absolute' },
  bubbleOne: { height: 6, right: 18, top: 18, width: 6 },
  bubbleTwo: { height: 4, left: 19, top: 34, width: 4 },
  bubbleThree: { height: 3, left: 39, top: 49, width: 3 },
  energyCopy: { flex: 1 },
  energyStatusLine: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  energyLiveDot: { borderRadius: 4, height: 7, shadowColor: '#4ecca3', shadowOpacity: 0.9, shadowRadius: 5, width: 7 },
  energyEyebrow: { color: '#82cbb4', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  energyPercent: { color: '#f5f7f8', fontSize: 32, fontWeight: '900', marginTop: 3 },
  energyCaption: { color: '#4ecca3', fontSize: 11, fontWeight: '700', marginTop: 1 },
  energyNote: { color: '#71828c', fontSize: 10, lineHeight: 15, marginTop: 9 },
  totalMeta: { borderTopColor: '#2b3b47', borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, paddingTop: 14 },
  metaRight: { alignItems: 'flex-end' },
  metaLabel: { color: '#72828c', fontSize: 9, fontWeight: '800', letterSpacing: 0.7 },
  metaValue: { color: '#dce5e8', fontSize: 14, fontWeight: '700', marginTop: 4 },
  bestRow: { alignItems: 'center', borderTopColor: '#2b3b47', borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, paddingTop: 13 },
  bestValue: { color: '#f39c12', fontSize: 16, fontWeight: '900' },
  error: { backgroundColor: '#3a2025', borderRadius: 8, color: '#ff9a9a', fontSize: 12, marginBottom: 12, padding: 10 },
  loader: { marginVertical: 10 },
  sourceList: { gap: 12 },
  staleData: { opacity: 0.52 },
  sourceCard: { backgroundColor: '#18232c', borderRadius: 14, borderTopWidth: 3, padding: 16 },
  cardHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sourceTitle: { fontSize: 20, fontWeight: '900' },
  sourceSubtitle: { color: '#74838d', fontSize: 11, marginTop: 2 },
  sourceDot: { borderRadius: 5, height: 10, width: 10 },
  metricsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 },
  metric: { flex: 1 },
  metricLabel: { color: '#82909a', fontSize: 11, marginBottom: 5 },
  metricValue: { color: '#f5f7f8', fontSize: 21, fontWeight: '800' },
  metricUnit: { color: '#81909a', fontSize: 11, marginTop: 2 },
  trendCard: { backgroundColor: '#18232c', borderRadius: 14, marginTop: 12, padding: 16 },
  deltaCard: { backgroundColor: '#172a2d', borderColor: '#2b665d', borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 12, marginTop: 12, padding: 15 },
  deltaLabel: { color: '#6ed6bc', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  deltaTitle: { color: '#e6f5f0', fontSize: 14, fontWeight: '800', marginTop: 5 },
  deltaHint: { color: '#8eb7ad', flex: 1, fontSize: 10, lineHeight: 15 },
  trendHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: '#f5f7f8', fontSize: 14, fontWeight: '800' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { borderRadius: 3, height: 7, width: 7 },
  legendText: { color: '#a2afb7', fontSize: 10, marginRight: 5 },
  chart: { alignItems: 'flex-end', borderBottomColor: '#34434d', borderBottomWidth: 1, flexDirection: 'row', height: 110, marginTop: 16, paddingHorizontal: 2 },
  chartColumn: { alignItems: 'center', flex: 1, flexDirection: 'row', height: '100%', justifyContent: 'flex-end', gap: 1 },
  chartBar: { borderRadius: 2, flex: 1, maxHeight: '100%', minHeight: 3 },
  chartCaption: { color: '#687984', fontSize: 10, marginTop: 8 },
  footer: { color: '#50616d', fontSize: 10, marginTop: 18, textAlign: 'center' },
});