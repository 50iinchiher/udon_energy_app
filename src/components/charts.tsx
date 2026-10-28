import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { interFamily, Text } from '@/components/text';
import { Card, CardTitle } from '@/components/controls';
import { palette } from '@/components/screen';
import { niceScale, withUnit } from '@/lib/format';
import { STALE_AFTER_S, type DeltaTSource, type Sample } from '@/state/energyStore';

const WINDOW_MS = 5 * 60 * 1000;
const GRID = '#29423f';
const AXIS = '#49635f';
const LABEL = '#8eb7ad';
// Plot margins: tick labels and axis titles are drawn here, outside the plot area.
const LEFT = 44;
const RIGHT = 12;
const TOP = 24;
// The P = k·ΔT² fit is shown only with at least this many points spread over this ΔT range.
const MIN_FIT_POINTS = 10;
const MIN_FIT_RANGE_C = 10;
// Upper limit for SVG dots drawn in the ΔT chart.
const MAX_DOTS = 200;
// Inter with tabular figures so tick labels keep a fixed width as the scale changes.
const TICK_FONT = { fontFamily: interFamily(400), fontSize: 10, fontFeatureSettings: "'tnum'" };
const TITLE_FONT = { fontFamily: interFamily(700), fontSize: 11 };

function useWidth() {
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => setWidth(Math.floor(event.nativeEvent.layout.width));
  return { width, onLayout };
}

function Legend() {
  return (
    <View style={styles.legend}>
      <View style={[styles.legendLine, { backgroundColor: palette.teg }]} />
      <Text style={styles.legendText}>TEG</Text>
      <View style={[styles.legendLine, { backgroundColor: palette.hydro }]} />
      <Text style={styles.legendText}>Hydro</Text>
    </View>
  );
}

// Y grid lines with tick labels left of the plot and the unit title above it.
function YAxis({ ticks, label, toY, plotRight, title }: { ticks: number[]; label: (tick: number) => string; toY: (value: number) => number; plotRight: number; title: string }) {
  return (
    <>
      {ticks.map((tick) => (
        <Line key={`g${tick}`} x1={LEFT} x2={plotRight} y1={toY(tick)} y2={toY(tick)} stroke={tick === 0 ? AXIS : GRID} strokeWidth={1} />
      ))}
      {ticks.map((tick) => (
        <SvgText key={`t${tick}`} x={LEFT - 6} y={toY(tick) + 3.5} fill={LABEL} {...TICK_FONT} textAnchor="end">
          {label(tick)}
        </SvgText>
      ))}
      <SvgText x={4} y={12} fill={LABEL} {...TITLE_FONT} textAnchor="start">
        {title}
      </SvgText>
    </>
  );
}

export function PowerChart({ history, now }: { history: Sample[]; now: number }) {
  const { width, onLayout } = useWidth();
  const height = 210;
  const bottom = 24;
  const lastT = history.length ? history[history.length - 1].t : now;
  const end = Math.max(now, lastT);
  const start = end - WINDOW_MS;
  const points = history.filter((sample) => sample.t >= start);
  const maxPower = Math.max(0, ...points.map((sample) => Math.max(sample.teg.power_mW, sample.hydro.power_mW)));
  const scale = niceScale(Math.max(maxPower, 1) * 1.2);
  const plotRight = width - RIGHT;
  const plotBottom = height - bottom;
  const toX = (t: number) => LEFT + ((t - start) / WINDOW_MS) * (plotRight - LEFT);
  const toY = (value: number) => plotBottom - (value / scale.max) * (plotBottom - TOP);

  // Continuous line through every sample; it only breaks where the connection was lost.
  const pathFor = (pick: (sample: Sample) => number) =>
    points
      .map((sample, index) => {
        const gap = index > 0 && (sample.t - points[index - 1].t) / 1000 > STALE_AFTER_S;
        return `${index === 0 || gap ? 'M' : 'L'}${toX(sample.t).toFixed(1)} ${toY(pick(sample)).toFixed(1)}`;
      })
      .join(' ');

  const xLabels = ['−5\u00A0min', '−4', '−3', '−2', '−1', 'now'];

  return (
    <Card>
      <CardTitle title="Power · last 5&nbsp;minutes" right={<Legend />} />
      <View style={styles.chartBox} onLayout={onLayout}>
        {width > 0 && (
          <Svg width={width} height={height}>
            <YAxis ticks={scale.ticks} label={scale.label} toY={toY} plotRight={plotRight} title="mW" />
            <Line x1={LEFT} x2={LEFT} y1={TOP} y2={plotBottom} stroke={AXIS} strokeWidth={1} />
            {xLabels.map((label, index) => {
              const x = LEFT + (index / 5) * (plotRight - LEFT);
              return (
                <SvgText key={label} x={x} y={plotBottom + 16} fill={LABEL} {...TICK_FONT} textAnchor={index === 0 ? 'start' : index === 5 ? 'end' : 'middle'}>
                  {label}
                </SvgText>
              );
            })}
            {points.length > 1 && <Path d={pathFor((sample) => sample.hydro.power_mW)} fill="none" stroke={palette.hydro} strokeWidth={2.5} strokeLinejoin="round" />}
            {points.length > 1 && <Path d={pathFor((sample) => sample.teg.power_mW)} fill="none" stroke={palette.teg} strokeWidth={2.5} strokeLinejoin="round" />}
          </Svg>
        )}
      </View>
      {points.length < 2 && <Text style={styles.caption}>At least two measurements are needed to draw the chart.</Text>}
    </Card>
  );
}

export function deltaTDefinition(source: DeltaTSource, ambientC: number) {
  if (source === 'heatsink') return 'ΔT = soup − heatsink (measured with two sensors)';
  return `ΔT = soup − ambient (ambient assumed to be ${ambientC.toFixed(0)}\u00A0°C)`;
}

export function DeltaPowerChart({ history }: { history: Sample[] }) {
  const { width, onLayout } = useWidth();
  const height = 230;
  const bottom = 42;
  const points = history.filter((sample) => sample.deltaTC !== undefined && sample.deltaTC >= 0).slice(-600);
  const xScale = niceScale(Math.max(1, ...points.map((sample) => sample.deltaTC ?? 0)) * 1.1);
  const yScale = niceScale(Math.max(1, ...points.map((sample) => sample.teg.power_mW)) * 1.2);
  const plotRight = width - RIGHT;
  const plotBottom = height - bottom;
  const toX = (deltaT: number) => LEFT + (deltaT / xScale.max) * (plotRight - LEFT);
  const toY = (power: number) => plotBottom - (power / yScale.max) * (plotBottom - TOP);

  // Least-squares fit of P = k·ΔT²: k = Σ(P·ΔT²) / Σ(ΔT⁴)
  const sumX4 = points.reduce((sum, sample) => sum + (sample.deltaTC ?? 0) ** 4, 0);
  const k = sumX4 > 0 ? points.reduce((sum, sample) => sum + sample.teg.power_mW * (sample.deltaTC ?? 0) ** 2, 0) / sumX4 : 0;
  // Only trust (and draw) the fit over the ΔT range actually measured, and only with enough spread.
  const deltas = points.map((sample) => sample.deltaTC ?? 0);
  const minDelta = deltas.length ? Math.min(...deltas) : 0;
  const maxDelta = deltas.length ? Math.max(...deltas) : 0;
  const showFit = k > 0 && points.length >= MIN_FIT_POINTS && maxDelta - minDelta >= MIN_FIT_RANGE_C;
  const curveEnd = showFit ? Math.min(maxDelta, Math.sqrt(yScale.max / k)) : minDelta;
  const curve = Array.from({ length: 41 }, (_, index) => minDelta + ((curveEnd - minDelta) * index) / 40)
    .map((deltaT, index) => `${index === 0 ? 'M' : 'L'}${toX(deltaT).toFixed(1)} ${toY(k * deltaT * deltaT).toFixed(1)}`)
    .join(' ');
  const latest = history.length ? history[history.length - 1] : null;
  // The fit uses every point; only the drawn dots are thinned so older phones stay smooth.
  const dotStep = Math.ceil(points.length / MAX_DOTS);
  const dots = points.filter((_, index) => (points.length - 1 - index) % dotStep === 0);

  return (
    <Card>
      <CardTitle title="ΔT vs TEG power" right={<Text style={styles.formula}>P = k·ΔT²</Text>} />
      <View style={styles.chartBox} onLayout={onLayout}>
        {width > 0 && (
          <Svg width={width} height={height}>
            <YAxis ticks={yScale.ticks} label={yScale.label} toY={toY} plotRight={plotRight} title="mW" />
            <Line x1={LEFT} x2={LEFT} y1={TOP} y2={plotBottom} stroke={AXIS} strokeWidth={1} />
            {xScale.ticks.map((tick, index) => (
              <SvgText key={tick} x={toX(tick)} y={plotBottom + 15} fill={LABEL} {...TICK_FONT} textAnchor={index === 0 ? 'start' : index === xScale.ticks.length - 1 ? 'end' : 'middle'}>
                {xScale.label(tick)}
              </SvgText>
            ))}
            <SvgText x={(LEFT + plotRight) / 2} y={height - 6} fill={LABEL} {...TITLE_FONT} textAnchor="middle">
              ΔT, °C
            </SvgText>
            {dots.map((sample) => (
              <Circle key={sample.t} cx={toX(sample.deltaTC ?? 0)} cy={toY(sample.teg.power_mW)} r={3} fill={palette.teg} fillOpacity={0.75} />
            ))}
            {showFit && <Path d={curve} fill="none" stroke={palette.text} strokeDasharray="6 5" strokeWidth={2} />}
          </Svg>
        )}
      </View>
      {points.length ? (
        <>
          {showFit ? (
            <>
              <Text style={styles.fit}>{`k = ${withUnit(Number(k.toPrecision(3)), 'mW/°C²')}  ·  dashed line = fitted curve`}</Text>
              <Text style={styles.caption}>If the points follow the curve, TEG power is proportional to the square of the temperature difference.</Text>
            </>
          ) : (
            <Text style={styles.caption}>More points will appear as the soup cools, and then the curve will be shown.</Text>
          )}
          {latest && <Text style={styles.caption}>{deltaTDefinition(latest.deltaTSource, latest.ambientC)}</Text>}
        </>
      ) : (
        <Text style={styles.caption}>No ΔT data: the soup temperature sensor is not connected.</Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  chartBox: { marginTop: 12, width: '100%' },
  legend: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  legendLine: { borderRadius: 2, height: 3, width: 14 },
  legendText: { color: '#c6d1d5', fontSize: 11, marginRight: 6 },
  formula: { color: palette.hydro, fontSize: 13, fontWeight: '900' },
  fit: { fontVariant: ['tabular-nums'], color: palette.text, fontSize: 12, fontWeight: '800', marginTop: 8 },
  caption: { fontVariant: ['tabular-nums'], color: palette.textMuted, fontSize: 11, lineHeight: 16, marginTop: 6 },
});
