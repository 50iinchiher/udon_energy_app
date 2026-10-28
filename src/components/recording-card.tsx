import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, CardTitle } from '@/components/controls';
import { palette } from '@/components/screen';
import { Text } from '@/components/text';
import { formatDuration, formatEnergy, withUnit } from '@/lib/format';
import { formatRecordingStamp, type RecordingInfo } from '@/lib/recordings';
import { useEnergyStore } from '@/state/energyStore';

const durationOf = (info: RecordingInfo) => (info.endedAt - info.startedAt) / 1000;

// Record real ESP32 sessions and replay them (e.g. if the connection fails at the competition).
export function RecordingCard() {
  const { mode, now, sessionStartTime, recordings, activeRecording, replaying, startRecording, stopRecording, removeRecording, startReplay, stopReplay } = useEnergyStore();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const start = () => setMessage(startRecording() ? null : 'Could not create the recording file.');
  const remove = (id: string) => {
    // Deleting needs a second tap.
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      return;
    }
    setConfirmDelete(null);
    removeRecording(id);
  };

  return (
    <Card>
      <CardTitle title="Measurement recordings" />
      <Text style={styles.small}>Saves every measurement from the ESP32 on this phone. If the connection drops, play a recording instead.</Text>

      {replaying ? (
        <>
          <Text style={styles.body}>{`Playing: ${formatRecordingStamp(replaying.startedAt)} · ${formatDuration(Math.min(durationOf(replaying), (now - sessionStartTime) / 1000))} / ${formatDuration(durationOf(replaying))}`}</Text>
          <Pressable accessibilityRole="button" onPress={stopReplay} style={styles.primaryButton}>
            <Text style={styles.primaryText}>Back to live data</Text>
          </Pressable>
        </>
      ) : mode === 'real' ? (
        activeRecording ? (
          <>
            <Text style={styles.recordingText}>{`● Recording · ${formatDuration((now - activeRecording.startedAt) / 1000)} · ${withUnit(activeRecording.lineCount, activeRecording.lineCount === 1 ? 'sample' : 'samples')}`}</Text>
            <Pressable accessibilityRole="button" onPress={stopRecording} style={styles.stopButton}>
              <Text style={styles.stopText}>Stop recording</Text>
            </Pressable>
          </>
        ) : (
          <Pressable accessibilityRole="button" onPress={start} style={styles.primaryButton}>
            <Text style={styles.primaryText}>Start recording</Text>
          </Pressable>
        )
      ) : (
        <Text style={styles.body}>Turn off demo mode to record.</Text>
      )}
      {message && <Text style={styles.small}>{message}</Text>}

      <Text style={styles.listTitle}>Saved recordings</Text>
      {recordings.length === 0 && <Text style={styles.small}>No recordings yet.</Text>}
      {recordings.map((info) => {
        const isPlaying = replaying?.id === info.id;
        return (
          <View key={info.id} style={styles.row}>
            <Text style={styles.rowTitle}>{formatRecordingStamp(info.startedAt)}</Text>
            <Text style={styles.small}>{`${formatDuration(durationOf(info))} · ${formatEnergy(info.totalEnergyJ)} · ${withUnit(info.sampleCount, 'samples')}`}</Text>
            <View style={styles.buttonRow}>
              <Pressable accessibilityRole="button" accessibilityState={{ disabled: isPlaying }} disabled={isPlaying} onPress={() => startReplay(info.id)} style={[styles.secondaryButton, isPlaying && styles.buttonDisabled]}>
                <Text style={[styles.secondaryText, isPlaying && styles.textDisabled]}>{isPlaying ? 'Playing' : 'Play'}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityState={{ disabled: isPlaying }} disabled={isPlaying} onPress={() => remove(info.id)} style={[styles.secondaryButton, isPlaying && styles.buttonDisabled]}>
                <Text style={[styles.dangerText, isPlaying && styles.textDisabled]}>{confirmDelete === info.id ? 'Tap again to delete' : 'Delete'}</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  small: { fontVariant: ['tabular-nums'], color: palette.textFaint, fontSize: 11, lineHeight: 16, marginTop: 6 },
  body: { fontVariant: ['tabular-nums'], color: palette.textMuted, fontSize: 13, lineHeight: 19, marginTop: 8 },
  recordingText: { fontVariant: ['tabular-nums'], color: '#ff8a8a', fontSize: 13, fontWeight: '700', marginTop: 10 },
  primaryButton: { alignItems: 'center', backgroundColor: palette.teg, borderRadius: 10, marginTop: 12, paddingHorizontal: 12, paddingVertical: 11 },
  primaryText: { color: '#10201d', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  stopButton: { alignItems: 'center', backgroundColor: '#8e1f1f', borderRadius: 10, marginTop: 10, paddingHorizontal: 12, paddingVertical: 11 },
  stopText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  listTitle: { color: palette.text, fontSize: 13, fontWeight: '800', marginTop: 18 },
  row: { borderTopColor: palette.border, borderTopWidth: 1, marginTop: 10, paddingTop: 10 },
  rowTitle: { fontVariant: ['tabular-nums'], color: '#dce5e8', fontSize: 14, fontWeight: '700' },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  secondaryButton: { alignItems: 'center', borderColor: '#35505b', borderRadius: 10, borderWidth: 1, flexGrow: 1, paddingHorizontal: 12, paddingVertical: 9 },
  secondaryText: { color: '#c6d1d5', fontSize: 13, fontWeight: '700' },
  dangerText: { color: '#ff8a8a', fontSize: 13, fontWeight: '700' },
  buttonDisabled: { backgroundColor: '#26323b', borderColor: '#26323b' },
  textDisabled: { color: '#6f7f88' },
});
