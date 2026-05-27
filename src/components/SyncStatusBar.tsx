import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';

interface SyncStatusBarProps {
  onPress?: () => void;
}

export const SyncStatusBar: React.FC<SyncStatusBarProps> = ({ onPress }) => {
  const sync = useSelector((state: RootState) => state.sync);

  const formatTime = (ts: string | number | null) => {
    if (!ts) return 'Never';
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.8} disabled={!onPress}>
      <View style={styles.statusRow}>
        <View style={[styles.dot, { backgroundColor: sync.isOnline ? '#00E676' : '#FF5252' }]} />
        <Text style={styles.statusText}>{sync.isOnline ? 'Online' : 'Offline'}</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.infoRow}>
        <Text style={styles.infoText}>Pending: <Text style={styles.highlight}>{sync.pendingCount}</Text></Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.infoRow}>
        <Text style={styles.infoText}>Last: {formatTime(sync.lastSyncTimestamp)}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  infoRow: {
    justifyContent: 'center',
  },
  infoText: {
    color: '#888',
    fontSize: 12,
  },
  highlight: {
    color: '#FFF',
    fontWeight: '700',
  },
  divider: {
    width: 1,
    height: 14,
    backgroundColor: '#333',
    marginHorizontal: 10,
  },
});
