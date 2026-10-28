import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/components/text';
import { palette } from '@/components/screen';
import { withUnit } from '@/lib/format';

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function CardTitle({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.titleRow}>
      <Text style={styles.title}>{title}</Text>
      {right}
    </View>
  );
}

type StepperProps = {
  label: string;
  hint?: string;
  value: number;
  unit: string;
  step: number;
  min: number;
  max: number;
  decimals?: number;
  onChange: (value: number) => void;
};

export function Stepper({ label, hint, value, unit, step, min, max, decimals = 0, onChange }: StepperProps) {
  const set = (next: number) => onChange(Math.min(max, Math.max(min, Number(next.toFixed(decimals)))));
  const atMin = value <= min;
  const atMax = value >= max;
  return (
    <View style={styles.stepperRow}>
      <View style={styles.stepperText}>
        <Text style={styles.stepperLabel}>{label}</Text>
        {hint && <Text style={styles.stepperHint}>{hint}</Text>}
      </View>
      <View style={styles.stepperControls}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Decrease ${label}`} disabled={atMin} onPress={() => set(value - step)} style={[styles.stepperButton, atMin && styles.disabled]} hitSlop={4}>
          <Text style={styles.stepperButtonText}>−</Text>
        </Pressable>
        <Text style={styles.stepperValue}>{unit ? withUnit(value.toFixed(decimals), unit) : value.toFixed(decimals)}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Increase ${label}`} disabled={atMax} onPress={() => set(value + step)} style={[styles.stepperButton, atMax && styles.disabled]} hitSlop={4}>
          <Text style={styles.stepperButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: palette.card, borderColor: palette.border, borderRadius: 16, borderWidth: 1, marginTop: 14, padding: 16 },
  titleRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  title: { color: palette.text, flexShrink: 1, fontSize: 15, fontWeight: '800' },
  stepperRow: { alignItems: 'center', borderBottomColor: '#293943', borderBottomWidth: 1, flexDirection: 'row', gap: 10, justifyContent: 'space-between', paddingVertical: 10 },
  stepperText: { flex: 1, minWidth: 0 },
  stepperLabel: { color: '#c6d1d5', fontSize: 13, fontWeight: '600' },
  stepperHint: { color: palette.textFaint, fontSize: 11, lineHeight: 15, marginTop: 2 },
  stepperControls: { alignItems: 'center', flexDirection: 'row', flexShrink: 0, gap: 6 },
  stepperButton: { alignItems: 'center', backgroundColor: '#263640', borderRadius: 8, height: 32, justifyContent: 'center', width: 32 },
  disabled: { opacity: 0.35 },
  stepperButtonText: { color: '#dce5e8', fontSize: 18, fontWeight: '700' },
  stepperValue: { fontVariant: ['tabular-nums'], color: palette.text, fontSize: 12, fontWeight: '800', minWidth: 74, textAlign: 'center' },
});
