import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Animated } from 'react-native';
import type { AuthResult } from '../types/biometrics.types';

interface AuthResultCardProps {
  result: AuthResult;
  onClose: () => void;
}

export const AuthResultCard: React.FC<AuthResultCardProps> = ({ result, onClose }) => {
  const isSuccess = result.success;

  return (
    <View style={styles.container}>
      <View style={[styles.iconCircle, { backgroundColor: isSuccess ? '#00E67620' : '#FF525220' }]}>
        <Text style={styles.iconText}>{isSuccess ? '✅' : '❌'}</Text>
      </View>

      <Text style={styles.title}>
        {isSuccess ? 'Authentication Successful' : 'Authentication Failed'}
      </Text>

      {isSuccess ? (
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Identity</Text>
            <Text style={styles.value}>{result.username || 'Unknown'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Employee Data</Text>
            <Text style={styles.value}>{result.additionalData || '—'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Match Confidence</Text>
            <Text style={[styles.value, { color: '#00E676' }]}>
              {(result.confidence * 100).toFixed(1)}%
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Liveness Score</Text>
            <Text style={[styles.value, { color: result.livenessScore >= 0.8 ? '#00E676' : '#FFEA00' }]}>
              {(result.livenessScore * 100).toFixed(1)}%
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Iris Quality</Text>
            <Text style={styles.value}>{(result.irisQuality * 100).toFixed(1)}%</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Pipeline Time</Text>
            <Text style={styles.value}>{result.inferenceTimeMs}ms</Text>
          </View>
        </View>
      ) : (
        <Text style={styles.errorText}>
          Face not recognized or spoof detected. Please ensure good lighting and follow the liveness instructions.
        </Text>
      )}

      <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={onClose}>
        <Text style={styles.buttonText}>Return to Dashboard</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    padding: 24,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  iconText: {
    fontSize: 48,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 20,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    padding: 18,
    width: '100%',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  label: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
  },
  value: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '600',
    maxWidth: '55%',
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: '#2A2A2A',
  },
  errorText: {
    fontSize: 15,
    color: '#FF5252',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 16,
    lineHeight: 22,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
    width: '100%',
  },
  primaryButton: {
    backgroundColor: '#2962FF',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
