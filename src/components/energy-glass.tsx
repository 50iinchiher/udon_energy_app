import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { palette } from '@/components/screen';
import { Text } from '@/components/text';
import { formatPercent, withUnit } from '@/lib/format';

// The glass is a 500 mAh battery: it fills with the energy collected this session (at 3.7 V, no losses).
// This is a comparison only; the measured battery state is in the Battery card.
const BATTERY_MAH = 500;
const BATTERY_NOMINAL_V = 3.7;

export function EnergyGlass({ energyJ, active }: { energyJ: number; active: boolean }) {
  const [fill] = useState(() => new Animated.Value(0));
  const [motion] = useState(() => new Animated.Value(0));
  const [glow] = useState(() => new Animated.Value(0.45));
  const mAh = Math.max(0, energyJ) / (BATTERY_NOMINAL_V * 3.6);
  const percent = (mAh / BATTERY_MAH) * 100;
  const level = Math.min(1, percent / 100);

  // Animate the liquid level whenever the collected energy changes.
  useEffect(() => {
    Animated.timing(fill, { toValue: level, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [fill, level]);

  // Decorative motion while the dashboard is mounted.
  useEffect(() => {
    const motionLoop = Animated.loop(Animated.timing(motion, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }));
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
          <View style={[styles.energyLiveDot, { backgroundColor: active ? palette.teg : '#65747d' }]} />
          <Text style={styles.energyEyebrow}>{active ? 'COLLECTING ENERGY' : 'WAITING FOR ENERGY'}</Text>
        </View>
        <Text style={styles.energyPercent} adjustsFontSizeToFit numberOfLines={1}>
          {formatPercent(percent)}
        </Text>
        <Text style={styles.energyCaption}>{`of a ${withUnit(BATTERY_MAH, 'mAh')} battery`}</Text>
        <Text style={styles.energyNote}>{`Energy collected ≈ ${withUnit(mAh.toFixed(2), 'mAh')} of charge (assuming ${withUnit(BATTERY_NOMINAL_V, 'V')} and no losses)`}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  energyVisual: { alignItems: 'center', flexDirection: 'row', gap: 18, marginTop: 18, minHeight: 138 },
  glassStage: { alignItems: 'center', height: 124, justifyContent: 'flex-end', width: 112 },
  energyOrbit: { borderColor: 'rgba(78, 204, 163, 0.32)', borderRadius: 58, borderWidth: 1, height: 112, position: 'absolute', width: 112 },
  orbitDot: { backgroundColor: palette.hydro, borderRadius: 4, height: 7, position: 'absolute', right: 12, top: 18, width: 7 },
  glass: { backgroundColor: 'rgba(103, 211, 181, 0.08)', borderColor: '#79cdb8', borderRadius: 12, borderTopWidth: 2, borderWidth: 2, bottom: 0, height: 104, overflow: 'hidden', position: 'absolute', width: 76 },
  glassGlow: { backgroundColor: palette.teg, borderRadius: 48, bottom: 7, height: 92, opacity: 0.45, position: 'absolute', shadowColor: palette.teg, shadowOpacity: 0.9, shadowRadius: 20, width: 92 },
  energyDrop: { backgroundColor: '#a5ffdf', borderRadius: 4, height: 8, position: 'absolute', shadowColor: palette.teg, shadowOpacity: 1, shadowRadius: 7, width: 8, zIndex: 3 },
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
  energyCopy: { flex: 1, minWidth: 0 },
  energyStatusLine: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  energyLiveDot: { borderRadius: 4, height: 7, shadowColor: palette.teg, shadowOpacity: 0.9, shadowRadius: 5, width: 7 },
  energyEyebrow: { color: '#82cbb4', flexShrink: 1, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  energyPercent: { fontVariant: ['tabular-nums'], color: palette.text, fontSize: 32, fontWeight: '900', marginTop: 3 },
  energyCaption: { color: palette.teg, fontSize: 11, fontWeight: '700', marginTop: 1 },
  energyNote: { fontVariant: ['tabular-nums'], color: '#71828c', fontSize: 10, lineHeight: 15, marginTop: 9 },
});
