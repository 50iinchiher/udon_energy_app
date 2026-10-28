import { useKeepAwake } from 'expo-keep-awake';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { DeltaPowerChart, PowerChart } from '@/components/charts';
import { Card, CardTitle, Stepper } from '@/components/controls';
import { EnergyGlass } from '@/components/energy-glass';
import { palette, Screen, ScreenHeader } from '@/components/screen';
import { useSettings } from '@/context/settings';
import { CAR_G_PER_KM, carDistanceMeters, co2Mg, heatingEnergyJ, J_PER_KWH, LED_POWER_W, recoveredPercent, SOUP_END_C, SOUP_START_C, SOURCE_URL, TREE_KG_PER_YEAR, treeSeconds } from '@/lib/co2';
import { formatClock, formatCo2, formatCurrent, formatDistance, formatDuration, formatEnergy, formatPercent, formatPower, formatSmall, formatTemperature, formatVoltage, withUnit } from '@/lib/format';
import { emptySource, type SourceReading } from '@/lib/telemetry';
import { STATUS_COLOR, STATUS_LABEL, useEnergyStore } from '@/state/energyStore';

// Phone battery assumed for the comparison sentence: 15 Wh, so 1 % = 0.15 Wh = 540 J.
const PHONE_BATTERY_WH = 15;
const PHONE_ONE_PERCENT_J = (PHONE_BATTERY_WH * 3600) / 100;

// Below this a channel is treated as idle (INA219 noise floor).
const ACTIVE_THRESHOLD_MW = 0.1;

function powerStateText(tegMw: number, hydroMw: number) {
  const teg = tegMw > ACTIVE_THRESHOLD_MW;
  const hydro = hydroMw > ACTIVE_THRESHOLD_MW;
  if (teg && hydro) return 'Both channels are generating';
  if (teg) return 'Heat channel (TEG) is generating';
  if (hydro) return 'Flow channel (hydro) is generating';
  return 'No power';
}

// Approximate LiPo state of charge from resting voltage (only shown when voltage is measured).
const LIPO_CURVE: [number, number][] = [[3.0, 0], [3.45, 5], [3.68, 20], [3.74, 35], [3.8, 50], [3.87, 65], [3.95, 80], [4.05, 90], [4.2, 100]];
function lipoPercent(voltage: number) {
  if (voltage <= LIPO_CURVE[0][0]) return 0;
  for (let index = 1; index < LIPO_CURVE.length; index += 1) {
    const [v1, p1] = LIPO_CURVE[index];
    const [v0, p0] = LIPO_CURVE[index - 1];
    if (voltage <= v1) return p0 + ((voltage - v0) / (v1 - v0)) * (p1 - p0);
  }
  return 100;
}

function groupThousands(value: number) {
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function TotalCard() {
  const store = useEnergyStore();
  const sample = store.lastSample;
  const totalMw = sample?.totalPowerMw ?? 0;
  const sessionSeconds = (store.now - store.sessionStartTime) / 1000;

  return (
    <Card style={styles.totalCard}>
      <View style={styles.cardAccent} />
      <CardTitle title="Total power" />
      <View style={store.isStale && styles.stale}>
        <Text style={styles.totalValue} adjustsFontSizeToFit numberOfLines={1}>
          {totalMw.toFixed(2)}
          <Text style={styles.totalUnit}>{'\u00A0mW'}</Text>
        </Text>
        <Text style={styles.totalState}>{sample ? powerStateText(sample.teg.power_mW, sample.hydro.power_mW) : 'Waiting for measurements…'}</Text>
        <EnergyGlass energyJ={store.totalEnergyJ} active={!store.isStale && store.status !== 'offline' && totalMw > ACTIVE_THRESHOLD_MW} />
      </View>
      <Text style={styles.body}>
        {totalMw > ACTIVE_THRESHOLD_MW
          ? `At this rate, one hour collects enough energy to run a 100\u00A0mW LED for ${formatDuration(((totalMw / 1000) * 3600) / LED_POWER_W)}, and 1\u00A0% of a phone battery charges in about ${formatDuration(PHONE_ONE_PERCENT_J / (totalMw / 1000))} (assuming a ${withUnit(PHONE_BATTERY_WH, 'Wh')} phone battery).`
          : 'A comparison will appear once power is generated.'}
      </Text>
      <View style={styles.metaGrid}>
        <Meta label="Energy collected" value={formatEnergy(store.totalEnergyJ)} />
        <Meta label="Peak power" value={formatPower(store.peakPowerMw)} />
        <Meta label="Session time" value={formatDuration(sessionSeconds)} />
        <Meta label="Last measurement" value={sample ? formatClock(sample.t) : '—'} />
      </View>
      <Text style={styles.highlight}>{`The energy collected can run a 100\u00A0mW LED for ${formatDuration(store.totalEnergyJ / LED_POWER_W)}.`}</Text>
      <Pressable accessibilityRole="button" onPress={store.resetSession} style={styles.resetButton}>
        <Text style={styles.resetText}>Start a new session</Text>
      </Pressable>
    </Card>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaCell}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

// Shown only when the ESP32 sends battery data; each line appears only for the values that arrive.
function BatteryCard() {
  const { lastSample, isStale } = useEnergyStore();
  const voltage = lastSample?.batteryV;
  const charging = lastSample?.charging;
  const delivered = lastSample?.deliveredJ;
  if (voltage === undefined && charging === undefined && delivered === undefined) return null;

  return (
    <Card>
      <CardTitle title="Battery (500&nbsp;mAh)" />
      <View style={isStale && styles.stale}>
        {voltage !== undefined && (
          <>
            <Text style={styles.bigValue}>{formatVoltage(voltage)}</Text>
            <Text style={styles.small}>{`≈ ${(Math.round(lipoPercent(voltage) / 5) * 5).toFixed(0)}\u00A0% (approximate, from voltage${charging ? '; voltage reads high while charging' : ''})`}</Text>
          </>
        )}
        {charging !== undefined && <Text style={styles.body}>{charging ? 'Charging' : 'Not charging'}</Text>}
        {delivered !== undefined && <Text style={styles.body}>{`Energy stored: ${formatEnergy(delivered)}`}</Text>}
      </View>
      <Text style={styles.small}>Both TEG and hydro charge the battery through Schottky diodes → 5&nbsp;V boost converter → charger.</Text>
    </Card>
  );
}

function SoupCard() {
  const { lastSample, status, isStale } = useEnergyStore();
  const soupC = lastSample?.soupC;
  const badge = status === 'replay' ? STATUS_LABEL.replay : status === 'offline' ? STATUS_LABEL.offline : soupC !== undefined ? 'Sensor OK' : 'Sensor not connected';
  const badgeColor = status === 'replay' ? STATUS_COLOR.replay : status !== 'offline' && soupC !== undefined ? palette.teg : palette.danger;
  const deltaT = lastSample?.deltaTC;

  return (
    <Card>
      <CardTitle title="Soup temperature" right={status === 'demo' ? undefined : <Text style={[styles.pill, { borderColor: badgeColor, color: badgeColor }]}>{badge}</Text>} />
      <View style={isStale && styles.stale}>
        <Text style={soupC === undefined ? styles.missingValue : styles.bigValue}>{soupC === undefined ? 'Sensor not connected' : formatTemperature(soupC)}</Text>
        {deltaT !== undefined && lastSample && (
          <Text style={styles.body}>
            {lastSample.deltaTSource === 'heatsink'
              ? `ΔT (soup − heatsink): ${formatTemperature(deltaT)}`
              : `ΔT = soup − ambient (ambient assumed to be ${lastSample.ambientC.toFixed(0)}\u00A0°C): ${formatTemperature(deltaT)}`}
          </Text>
        )}
      </View>
      {lastSample?.deltaTSource === 'ambient' && <Text style={styles.small}>There is no heatsink sensor, so the ambient temperature is used. You can change it in Settings.</Text>}
    </Card>
  );
}

function SourceColumn({ label, color, source }: { label: string; color: string; source: SourceReading }) {
  return (
    <View style={styles.sourceColumn}>
      <Text style={[styles.sourceName, { color }]}>{label}</Text>
      <Text style={styles.sourcePower} adjustsFontSizeToFit numberOfLines={1}>
        {source.power_mW.toFixed(2)}
        <Text style={styles.sourceUnit}>{'\u00A0mW'}</Text>
      </Text>
      <View style={styles.sourceDetails}>
        <Text style={styles.sourceDetail}>{formatVoltage(source.voltage)}</Text>
        <Text style={styles.sourceDetail}>{formatCurrent(source.current_mA)}</Text>
      </View>
    </View>
  );
}

function ElectricalCard() {
  const { lastSample, isStale } = useEnergyStore();
  return (
    <Card>
      <CardTitle title="Electrical output" />
      <View style={[styles.sourceGrid, isStale && styles.stale]}>
        <SourceColumn label="TEG (heat)" color={palette.teg} source={lastSample?.teg ?? emptySource} />
        <SourceColumn label="Hydro (flow)" color={palette.hydro} source={lastSample?.hydro ?? emptySource} />
      </View>
    </Card>
  );
}

function Co2Card() {
  const { totalEnergyJ } = useEnergyStore();
  const { gridEf, soupLiters } = useSettings();
  const mg = co2Mg(totalEnergyJ, gridEf);
  const heatJ = heatingEnergyJ(soupLiters);

  return (
    <Card style={styles.co2Card}>
      <CardTitle title="CO₂ saved · this session" right={<Text style={styles.small}>{`${gridEf.toFixed(3)}\u00A0kg/kWh`}</Text>} />
      <View style={styles.co2Hero}>
        <Text style={styles.co2Value}>{formatCo2(mg)}</Text>
        <Text style={styles.co2Label}>CO₂ SAVED THIS SESSION</Text>
      </View>
      <Text style={styles.body}>{`${formatEnergy(totalEnergyJ)} of electricity ÷ 3.6 × 10⁶ × ${gridEf.toFixed(3)}\u00A0kg/kWh = ${formatCo2(mg)} CO₂`}</Text>
      <View style={styles.equivalents}>
        <Text style={styles.equivalent}>{`100\u00A0mW LED: ${formatDuration(totalEnergyJ / LED_POWER_W)}`}</Text>
        <Text style={styles.equivalent}>{`Same as a car driving: ${formatDistance(carDistanceMeters(mg))}`}</Text>
        <Text style={styles.equivalent}>{`Time for one tree to absorb it: ${formatDuration(treeSeconds(mg))}`}</Text>
      </View>
      <Text style={styles.small}>{`Assumes a car emits ${CAR_G_PER_KM}\u00A0g CO₂/km and a tree absorbs ${TREE_KG_PER_YEAR}\u00A0kg CO₂/year.`}</Text>

      <View style={styles.divider} />
      <Text style={styles.subTitle}>CO₂ from heating the soup</Text>
      <Text style={styles.body}>
        {`Heating ${soupLiters.toFixed(1)}\u00A0L of soup from ${SOUP_START_C}\u00A0°C to ${SOUP_END_C}\u00A0°C takes ${groupThousands(heatJ)}\u00A0J and releases about `}
        <Text style={styles.strong}>{formatCo2(co2Mg(heatJ, gridEf))}</Text>
        {' of CO₂. In this session we recovered '}
        <Text style={styles.strong}>{formatPercent(recoveredPercent(totalEnergyJ, soupLiters))}</Text>
        {' of that energy as electricity.'}
      </Text>
      <Text style={styles.small}>Change the soup volume and CO₂ factor in Settings.</Text>
      <Pressable accessibilityRole="link" onPress={() => Linking.openURL(SOURCE_URL).catch(() => {})} hitSlop={6}>
        <Text style={styles.link}>Source: JCM project (2014), Mongolia ↗</Text>
      </Pressable>
    </Card>
  );
}

function ScaleUpCard() {
  const { tegAvgMw, hydroEnergyJ, integratedSeconds } = useEnergyStore();
  const { soupLiters, canteens, dailyLiters, hotHours, gridEf, update } = useSettings();
  const tegAvgW = tegAvgMw / 1000;
  const hydroJPerLiter = soupLiters > 0 ? hydroEnergyJ / soupLiters : 0;
  const dailyJ = canteens * (tegAvgW * hotHours * 3600 + hydroJPerLiter * dailyLiters);
  const dailyKwh = dailyJ / J_PER_KWH;
  const dailyCo2G = co2Mg(dailyJ, gridEf) / 1000;

  return (
    <Card>
      <CardTitle title="Scale-up estimate" />
      <Text style={styles.assumption}>ESTIMATE ONLY — calculated from real measurements</Text>
      <View style={styles.inputs}>
        <Stepper label="Number of canteens" value={canteens} unit="" step={1} min={1} max={1000} onChange={(value) => update('canteens', value)} />
        <Stepper label="Litres of soup per day" value={dailyLiters} unit="L" step={5} min={5} max={1000} onChange={(value) => update('dailyLiters', value)} />
        <Stepper label="Hours the soup stays hot per day" value={hotHours} unit="h" step={1} min={1} max={24} onChange={(value) => update('hotHours', value)} />
      </View>
      <Text style={styles.body}>{`Average TEG power (this session): ${formatPower(tegAvgMw)}`}</Text>
      <Text style={styles.body}>{`Hydro energy per litre: ${formatEnergy(hydroEnergyJ)} ÷ ${soupLiters.toFixed(1)}\u00A0L = ${hydroJPerLiter.toFixed(2)}\u00A0J/L`}</Text>
      <Text style={styles.formula}>Per day = canteens × (average TEG power × hot hours × 3600 + hydro J/L × litres)</Text>
      <View style={styles.results}>
        <Text style={styles.result}>{`Per day: ${formatSmall(dailyKwh)}\u00A0kWh · ${formatSmall(dailyCo2G)}\u00A0g CO₂`}</Text>
        <Text style={styles.result}>{`Per year: ${formatSmall(dailyKwh * 365)}\u00A0kWh · ${formatSmall((dailyCo2G * 365) / 1000)}\u00A0kg CO₂`}</Text>
      </View>
      {integratedSeconds < 120 && <Text style={styles.small}>The session is shorter than 2&nbsp;minutes, so the average power has not settled yet.</Text>}
    </Card>
  );
}

export default function Dashboard() {
  useKeepAwake();
  const { history, now } = useEnergyStore();

  return (
    <Screen>
      <ScreenHeader eyebrow="WASTE ENERGY MONITOR" title="ThermoTrack" subtitle="Electricity from soup heat and flow" showSettings />
      <TotalCard />
      <BatteryCard />
      <SoupCard />
      <ElectricalCard />
      <Co2Card />
      <ScaleUpCard />
      <PowerChart history={history} now={now} />
      <DeltaPowerChart history={history} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  stale: { opacity: 0.4 },
  small: { fontVariant: ['tabular-nums'], color: palette.textFaint, fontSize: 11, lineHeight: 16, marginTop: 6 },
  body: { fontVariant: ['tabular-nums'], color: palette.textMuted, fontSize: 13, lineHeight: 19, marginTop: 6 },
  strong: { color: palette.text, fontWeight: '900' },
  highlight: { fontVariant: ['tabular-nums'], color: '#f8c66d', fontSize: 13, fontWeight: '700', lineHeight: 19, marginTop: 14 },
  totalCard: { borderColor: '#2d5a50', overflow: 'hidden' },
  cardAccent: { backgroundColor: palette.teg, height: 3, left: 16, position: 'absolute', right: '65%', top: 0 },
  totalValue: { fontVariant: ['tabular-nums'], color: palette.text, fontSize: 48, fontWeight: '900', marginTop: 8 },
  totalUnit: { color: palette.teg, fontSize: 22, fontWeight: '700' },
  totalState: { color: '#82cbb4', fontSize: 13, fontWeight: '700', marginTop: 2 },
  metaGrid: { borderTopColor: palette.border, borderTopWidth: 1, flexDirection: 'row', flexWrap: 'wrap', marginTop: 14, paddingTop: 6 },
  metaCell: { paddingVertical: 8, width: '50%' },
  metaLabel: { color: palette.textFaint, fontSize: 11, fontWeight: '700' },
  metaValue: { fontVariant: ['tabular-nums'], color: '#dce5e8', fontSize: 15, fontWeight: '800', marginTop: 3 },
  resetButton: { alignSelf: 'flex-start', borderColor: '#35505b', borderRadius: 8, borderWidth: 1, marginTop: 14, paddingHorizontal: 12, paddingVertical: 9 },
  resetText: { color: '#c6d1d5', fontSize: 13, fontWeight: '700' },
  bigValue: { fontVariant: ['tabular-nums'], color: palette.text, fontSize: 32, fontWeight: '900', marginTop: 8 },
  missingValue: { color: '#e59a9a', fontSize: 18, fontWeight: '800', marginTop: 8 },
  pill: { borderRadius: 999, borderWidth: 1, fontSize: 10, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4 },
  sourceGrid: { flexDirection: 'row', gap: 10, marginTop: 12 },
  sourceColumn: { backgroundColor: palette.cardInner, borderRadius: 12, flex: 1, minWidth: 0, padding: 12 },
  sourceName: { fontSize: 13, fontWeight: '900' },
  sourcePower: { fontVariant: ['tabular-nums'], color: palette.text, fontSize: 24, fontWeight: '900', marginTop: 8 },
  sourceUnit: { color: '#8fa4ae', fontSize: 12, fontWeight: '700' },
  sourceDetails: { borderTopColor: '#293943', borderTopWidth: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'space-between', marginTop: 10, paddingTop: 8 },
  sourceDetail: { fontVariant: ['tabular-nums'], color: '#a9bac2', fontSize: 12 },
  co2Card: { borderColor: '#355248' },
  co2Hero: { backgroundColor: '#102d2a', borderRadius: 12, marginTop: 12, padding: 14 },
  co2Value: { fontVariant: ['tabular-nums'], color: '#a5ffdf', fontSize: 32, fontWeight: '900' },
  co2Label: { color: '#82cbb4', fontSize: 10, fontWeight: '900', letterSpacing: 0.6, marginTop: 3 },
  equivalents: { backgroundColor: palette.cardInner, borderRadius: 10, gap: 4, marginTop: 10, padding: 10 },
  equivalent: { fontVariant: ['tabular-nums'], color: '#f8c66d', fontSize: 13, fontWeight: '700' },
  divider: { borderTopColor: palette.border, borderTopWidth: 1, marginTop: 16 },
  subTitle: { color: '#e6f5f0', fontSize: 14, fontWeight: '800', marginTop: 14 },
  link: { color: '#6fb8e8', fontSize: 12, fontWeight: '700', marginTop: 10, textDecorationLine: 'underline' },
  assumption: { color: palette.hydro, fontSize: 11, fontWeight: '900', letterSpacing: 0.4, marginTop: 8 },
  inputs: { backgroundColor: palette.cardInner, borderRadius: 10, marginTop: 10, paddingHorizontal: 10 },
  formula: { color: palette.textFaint, fontSize: 11, fontStyle: 'italic', lineHeight: 16, marginTop: 8 },
  results: { backgroundColor: '#102d2a', borderRadius: 10, gap: 4, marginTop: 10, padding: 12 },
  result: { fontVariant: ['tabular-nums'], color: '#a5ffdf', fontSize: 14, fontWeight: '800' },
});
