import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { interFamily, Text } from '@/components/text';
import { Card, CardTitle, Stepper } from '@/components/controls';
import { DemoCard } from '@/components/demo-card';
import { palette, Screen, ScreenHeader } from '@/components/screen';
import { DEFAULT_SETTINGS, toEspUrl, useSettings } from '@/context/settings';

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function AddressField() {
  const { espAddress, update } = useSettings();
  const [draft, setDraft] = useState(espAddress);
  const changed = draft.trim() !== espAddress;
  // An empty address cannot be saved.
  const canSave = changed && draft.trim().length > 0;
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>ESP32 address</Text>
      <Text style={styles.fieldHint}>The phone and the ESP32 must be on the same Wi-Fi network. The IP address is shown in the ESP32 Serial Monitor.</Text>
      <View style={styles.addressRow}>
        <TextInput
          accessibilityLabel="ESP32 address"
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={() => canSave && update('espAddress', draft.trim())}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder={DEFAULT_SETTINGS.espAddress}
          placeholderTextColor={palette.textFaint}
          style={styles.input}
        />
        {changed ? (
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: !canSave }} disabled={!canSave} onPress={() => update('espAddress', draft.trim())} style={[styles.saveButton, !canSave && styles.saveDisabled]}>
            <Text style={[styles.saveText, !canSave && styles.saveTextDisabled]}>Save</Text>
          </Pressable>
        ) : (
          <Text style={styles.savedText}>Saved ✓</Text>
        )}
      </View>
      <Text style={styles.fieldHint}>{`Currently reading from: ${toEspUrl(espAddress)}`}</Text>
    </View>
  );
}

export default function SettingsScreen() {
  const { pollIntervalS, ambientC, gridEf, soupLiters, update } = useSettings();

  return (
    <Screen>
      <ScreenHeader eyebrow="SYSTEM" title="Settings" subtitle="Connection and calculation values. Changes apply immediately." />

      <Card>
        <CardTitle title="Connection" />
        <AddressField />
        <Stepper label="Polling interval" hint="How often to read data from the ESP32." value={pollIntervalS} unit="s" step={1} min={1} max={5} onChange={(value) => update('pollIntervalS', value)} />
        <Text style={styles.fieldHint}>If no new data arrives for more than 6&nbsp;seconds, the connection is treated as lost and energy counting pauses.</Text>
      </Card>

      <DemoCard />

      <Card>
        <CardTitle title="Calculation values" />
        <Stepper label="Ambient temperature" hint="Used to calculate ΔT = soup − ambient when there is no heatsink sensor." value={ambientC} unit="°C" step={1} min={-30} max={45} onChange={(value) => update('ambientC', value)} />
        <Stepper label="CO₂ emission factor" hint="CO₂ emitted to generate 1&nbsp;kWh of electricity (Mongolia, JCM 2014: 0.817)." value={gridEf} unit="kg/kWh" step={0.01} min={0} max={2} decimals={3} onChange={(value) => update('gridEf', value)} />
        <Stepper label="Soup volume" hint="Amount of soup in the test. Used for the heating energy and the hydro J/L figure." value={soupLiters} unit="L" step={0.1} min={0.1} max={50} decimals={1} onChange={(value) => update('soupLiters', value)} />
      </Card>

      <Card>
        <CardTitle title="Hardware map" />
        <InfoRow label="TEG sensor (INA219)" value="Address 0x40" />
        <InfoRow label="Hydro sensor (INA219)" value="Address 0x41" />
        <InfoRow label="ESP32 data path" value="/data" />
        <InfoRow label="Soup temperature" value="DS18B20 sensor" />
        <InfoRow label="Battery" value="500&nbsp;mAh, 3.7&nbsp;V" />
      </Card>

      <Card>
        <CardTitle title="Pre-competition checklist" />
        {['Phone and ESP32 are on the same Wi-Fi network', 'The ESP32 IP address above is correct', 'Both INA219 sensors use the correct addresses', 'The Dashboard shows the “LIVE” badge', 'A full test run has been recorded and saved', 'Demo mode is off'].map((item) => (
          <View key={item} style={styles.checkRow}>
            <Text style={styles.check}>✓</Text>
            <Text style={styles.checkText}>{item}</Text>
          </View>
        ))}
      </Card>
      <Text style={styles.footer}>ThermoTrack · 2026</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: { borderBottomColor: '#293943', borderBottomWidth: 1, paddingVertical: 10 },
  fieldLabel: { color: '#c6d1d5', fontSize: 13, fontWeight: '600' },
  fieldHint: { color: palette.textFaint, fontSize: 11, lineHeight: 15, marginTop: 4 },
  addressRow: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 8 },
  input: { backgroundColor: palette.cardInner, borderColor: '#35505b', borderRadius: 8, borderWidth: 1, color: palette.text, flex: 1, fontFamily: interFamily(400), fontSize: 14, minWidth: 0, paddingHorizontal: 10, paddingVertical: 9 },
  saveButton: { backgroundColor: palette.teg, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  saveDisabled: { backgroundColor: '#26323b' },
  saveText: { color: '#10201d', fontSize: 13, fontWeight: '800' },
  savedText: { color: palette.teg, fontSize: 13, fontWeight: '700', paddingHorizontal: 4 },
  saveTextDisabled: { color: '#6f7f88' },
  infoRow: { borderBottomColor: '#293943', borderBottomWidth: 1, flexDirection: 'row', gap: 10, justifyContent: 'space-between', paddingVertical: 11 },
  infoLabel: { color: palette.textMuted, flex: 1, fontSize: 13 },
  infoValue: { color: '#dce5e8', flexShrink: 1, fontSize: 13, fontWeight: '700', textAlign: 'right' },
  checkRow: { alignItems: 'flex-start', flexDirection: 'row', paddingVertical: 7 },
  check: { color: palette.teg, fontSize: 16, fontWeight: '900', marginRight: 10 },
  checkText: { color: '#c6d1d5', flex: 1, fontSize: 13, lineHeight: 18 },
  footer: { color: '#50616d', fontSize: 11, marginTop: 22, textAlign: 'center' },
});
