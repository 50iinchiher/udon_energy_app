import { StyleSheet, View } from 'react-native';

import { Card, CardTitle } from '@/components/controls';
import { palette, Screen, ScreenHeader } from '@/components/screen';
import { Text } from '@/components/text';
import { useSettings } from '@/context/settings';
import { CAR_G_PER_KM, LED_POWER_W, SOUP_END_C, SOUP_START_C, TREE_KG_PER_YEAR } from '@/lib/co2';
import { withUnit } from '@/lib/format';

// TODO: replace with the real team name (and members) before the competition.
const TEAM_NAME = 'Student innovation team';
const WATER_SPECIFIC_HEAT = 4186;

const MEASUREMENTS = [
  { value: 'Voltage, current and power', how: 'Each channel (TEG and hydro) is measured by its own INA219 sensor (I2C addresses 0x40 and 0x41).' },
  { value: 'Soup temperature', how: 'Measured by a DS18B20 digital sensor placed in the soup.' },
  { value: 'Battery voltage and charging', how: 'The ESP32 reads the battery voltage and the CHRG pin of the TP4056 charger.' },
  { value: 'Data transfer', how: 'The ESP32 serves all values as JSON over Wi-Fi, and the app reads them every 2\u00A0seconds.' },
  { value: 'Energy collected', how: 'The app integrates the power of each pair of consecutive measurements over the real time between them (trapezoidal rule).' },
];

function Pill({ children, color = palette.teg }: { children: string; color?: string }) {
  return (
    <View style={[styles.pill, { borderColor: color }]}>
      <Text style={[styles.pillText, { color }]}>{children}</Text>
    </View>
  );
}

export default function AboutScreen() {
  const { gridEf, ambientC } = useSettings();
  // Current values from Settings, so this list always matches what the calculations use.
  const assumptions = [
    { label: 'Grid CO₂ emission factor (Mongolia, JCM 2014)', value: withUnit(gridEf.toFixed(3), 'kg/kWh') },
    { label: 'Ambient temperature (when there is no heatsink sensor)', value: withUnit(ambientC.toFixed(0), '°C') },
    { label: 'Car CO₂ emissions', value: withUnit(CAR_G_PER_KM, 'g/km') },
    { label: 'CO₂ absorbed by one tree', value: withUnit(TREE_KG_PER_YEAR, 'kg/year') },
    { label: 'Specific heat of water', value: withUnit(WATER_SPECIFIC_HEAT, 'J/(kg·°C)') },
    { label: 'Soup heating range', value: `${withUnit(SOUP_START_C, '°C')} → ${withUnit(SOUP_END_C, '°C')}` },
    { label: 'Reference LED', value: withUnit(LED_POWER_W * 1000, 'mW') },
  ];

  return (
    <Screen>
      <ScreenHeader eyebrow="PROJECT" title="About the project" subtitle="Turning waste heat and flow from soup into measurable electricity." />

      <Card style={styles.hero}>
        <Text style={styles.heroTitle}>ThermoTrack</Text>
        <Text style={styles.heroCaption}>{TEAM_NAME}</Text>
      </Card>

      <Card>
        <CardTitle title="Project overview" />
        <Text style={styles.body}>
          While soup stays hot in a canteen, a large amount of heat is lost to the air. ThermoTrack turns part of it into electricity: two SP1848 TEG modules in series use the temperature difference between the soup and a heatsink, and a DB-268 micro-hydro turbine uses the flow when the soup is poured. Both sources are combined through Schottky diodes and charge a 500&nbsp;mAh battery through an MT3608 boost converter and a TP4056 charger. The app shows, with real measurements, how much electricity can be recovered from this waste energy.
        </Text>
      </Card>

      <Card>
        <CardTitle title="How each value is measured" />
        {MEASUREMENTS.map((item) => (
          <View key={item.value} style={styles.row}>
            <Text style={styles.rowLabel}>{item.value}</Text>
            <Text style={styles.rowText}>{item.how}</Text>
          </View>
        ))}
      </Card>

      <Card>
        <CardTitle title="Assumptions used in calculations" />
        {assumptions.map((item) => (
          <View key={item.label} style={styles.assumptionRow}>
            <Text style={styles.assumptionLabel}>{item.label}</Text>
            <Text style={styles.assumptionValue}>{item.value}</Text>
          </View>
        ))}
        <Text style={styles.note}>The CO₂ factor and ambient temperature can be changed in Settings. The values shown here are the ones currently in use.</Text>
      </Card>

      <Card>
        <CardTitle title="Hardware" />
        <View style={styles.pills}>
          <Pill>ESP32-S3</Pill>
          <Pill color={palette.hydro}>TEG SP1848 ×2</Pill>
          <Pill color={palette.hydro}>Hydro turbine DB-268</Pill>
          <Pill>INA219 ×2</Pill>
          <Pill>DS18B20</Pill>
          <Pill color={palette.hydro}>Battery 500&nbsp;mAh</Pill>
          <Pill>Boost converter MT3608</Pill>
          <Pill>Charger TP4056</Pill>
        </View>
      </Card>

      <Card>
        <CardTitle title="Honesty" />
        <Text style={styles.body}>Every number comes from real measurements. When a saved recording is played back, the header shows “Recording” with its date. In the practice “Demo (simulated)” mode, a notice appears at the top and that data is never saved to the real history. The scale-up figures are clearly marked as estimates only.</Text>
      </Card>

      <Text style={styles.footer}>ThermoTrack · 2026</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: '#1c2e2b', borderColor: '#376a5a', marginTop: 0 },
  heroTitle: { color: palette.text, fontSize: 22, fontWeight: '900' },
  heroCaption: { color: '#82cbb4', fontSize: 13, marginTop: 4 },
  body: { color: '#aebdc3', fontSize: 13, lineHeight: 20, marginTop: 8 },
  row: { borderTopColor: palette.border, borderTopWidth: 1, marginTop: 10, paddingTop: 10 },
  rowLabel: { color: palette.text, fontSize: 13, fontWeight: '700' },
  rowText: { color: '#c6d1d5', fontSize: 13, lineHeight: 19, marginTop: 3 },
  assumptionRow: { borderTopColor: palette.border, borderTopWidth: 1, flexDirection: 'row', gap: 12, justifyContent: 'space-between', marginTop: 10, paddingTop: 10 },
  assumptionLabel: { color: palette.textMuted, flex: 1, fontSize: 13, lineHeight: 18 },
  assumptionValue: { fontVariant: ['tabular-nums'], color: palette.text, flexShrink: 0, fontSize: 13, fontWeight: '700', textAlign: 'right' },
  note: { color: palette.textFaint, fontSize: 11, lineHeight: 16, marginTop: 12 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  pill: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  pillText: { fontSize: 12, fontWeight: '800' },
  footer: { color: '#50616d', fontSize: 11, marginTop: 22, textAlign: 'center' },
});
