/**
 * Hackathon 7.0 — HomeScreen (Dashboard)
 *
 * Premium dashboard showing:
 * 1. System initialization status with model loading
 * 2. Quick-action cards: Authenticate / Enroll
 * 3. Pipeline health indicators (7 models)
 * 4. Sync status & pending records
 * 5. Recent activity log
 *
 * Integrates with:
 *   - BiometricsService for system init / model info
 *   - Redux store for live sync & auth status
 *   - Navigation callbacks to EnrollmentScreen & Auth flow
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Animated,
  RefreshControl,
  Alert,
} from 'react-native';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import BiometricsService from '../services/BiometricsService';
import type { ModelInfo } from '../types/biometrics.types';
import { logger } from '../utils/logger';

interface HomeScreenProps {
  onNavigateEnroll: () => void;
  onNavigateAuth: () => void;
  onNavigateSync: () => void;
  onNavigateAdmin: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigateEnroll,
  onNavigateAuth,
  onNavigateSync,
  onNavigateAdmin,
}) => {
  // System state
  const [isInitializing, setIsInitializing] = useState(false);
  const [isReady, setIsReady] = useState(BiometricsService.isInitialized());
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Redux
  const sync = useSelector((state: RootState) => state.sync);
  const biometrics = useSelector((state: RootState) => state.biometrics);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(30)).current;
  const headerPulse = useRef(new Animated.Value(0.85)).current;

  // Entry animations
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(slideUpAnim, {
        toValue: 0,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideUpAnim]);

  // Status dot pulse
  useEffect(() => {
    if (isReady) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(headerPulse, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(headerPulse, {
            toValue: 0.5,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isReady, headerPulse]);

  const handleInitialize = useCallback(async () => {
    try {
      setIsInitializing(true);
      logger.info('HomeScreen', 'Initializing biometrics pipeline...');
      await BiometricsService.initialize();
      setIsReady(true);

      // Fetch model info after initialization
      try {
        const info = await BiometricsService.getModelInfo();
        setModelInfo(info);
      } catch {
        // Model info may not be available on all platforms
        logger.warn('HomeScreen', 'getModelInfo not available');
      }

      logger.info('HomeScreen', 'Pipeline initialized successfully');
    } catch (error: any) {
      logger.error('HomeScreen', 'Initialization failed', {
        error: error.message,
      });
      Alert.alert('Error', `Initialization failed: ${error.message}`);
    } finally {
      setIsInitializing(false);
    }
  }, []);

  // Auto-Initialize on launch
  useEffect(() => {
    if (!isReady && !isInitializing) {
      handleInitialize();
    }
  }, [isReady, isInitializing, handleInitialize]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (isReady) {
        const info = await BiometricsService.getModelInfo();
        setModelInfo(info);
      }
    } catch {
      // Ignore
    }
    setRefreshing(false);
  }, [isReady]);

  // ─── Pipeline Model Names ───
  const PIPELINE_STEPS = [
    { name: 'BlazeFace', desc: 'Face Detection', icon: '🎯' },
    { name: 'Zero-DCE', desc: 'Low-Light Enhance', icon: '🌙' },
    { name: 'Face Mesh', desc: '468 Landmarks', icon: '🔵' },
    { name: 'MobileFaceNet', desc: '512-dim Embed', icon: '🧬' },
    { name: 'Silent-FAS', desc: 'Passive Liveness', icon: '🛡️' },
    { name: 'rPPG-Net', desc: 'Cardiac Signal', icon: '💓' },
    { name: 'IrisNet', desc: 'Iris Quality', icon: '👁️' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* ─── Header ─── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.logo}>NHAI</Text>
          <Text style={styles.logoSub}>Biometrics</Text>
        </View>
        <View style={styles.headerRight}>
          <Animated.View
            style={[
              styles.statusDot,
              {
                backgroundColor: isReady ? '#00E676' : '#FF5252',
                opacity: isReady ? headerPulse : 1,
              },
            ]}
          />
          <Text style={[styles.statusText, { color: isReady ? '#00E676' : '#FF5252' }]}>
            {isReady ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00E676"
          />
        }
      >
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideUpAnim }],
          }}
        >
          {/* ─── System Init Card (if not ready) ─── */}
          {!isReady && (
            <View style={styles.initCard}>
              <View style={styles.initCardIcon}>
                <Text style={{ fontSize: 36 }}>⚙️</Text>
              </View>
              <Text style={styles.initCardTitle}>System Not Initialized</Text>
              <Text style={styles.initCardDesc}>
                The biometric pipeline must be initialized before use. This
                loads all 7 TFLite AI models and sets up the encrypted database.
              </Text>
              <TouchableOpacity
                style={[styles.button, styles.initButton]}
                onPress={handleInitialize}
                disabled={isInitializing}
              >
                {isInitializing ? (
                  <View style={styles.initLoadingRow}>
                    <ActivityIndicator color="#FFF" size="small" />
                    <Text style={[styles.buttonText, { marginLeft: 10 }]}>
                      Loading Models...
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.buttonText}>⚡ Initialize System</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* ─── Quick Actions ─── */}
          {isReady && (
            <>
              {/* Authenticate Card */}
              <TouchableOpacity
                style={styles.actionCard}
                onPress={onNavigateAuth}
                activeOpacity={0.85}
              >
                <View style={styles.actionCardContent}>
                  <View
                    style={[
                      styles.actionIconCircle,
                      { backgroundColor: '#2962FF20' },
                    ]}
                  >
                    <Text style={styles.actionIcon}>🔐</Text>
                  </View>
                  <View style={styles.actionTextContainer}>
                    <Text style={styles.actionTitle}>
                      Verify Identity
                    </Text>
                    <Text style={styles.actionDesc}>
                      7-step pipeline: detect → enhance → mesh → embed →
                      liveness → challenge → iris
                    </Text>
                  </View>
                  <Text style={styles.actionArrow}>›</Text>
                </View>
                <View style={styles.actionBadgeRow}>
                  <View style={[styles.actionBadge, { backgroundColor: '#2962FF20' }]}>
                    <Text style={[styles.actionBadgeText, { color: '#5C8AFF' }]}>
                      &lt;1s pipeline
                    </Text>
                  </View>
                  <View style={[styles.actionBadge, { backgroundColor: '#00E67615' }]}>
                    <Text style={[styles.actionBadgeText, { color: '#00E676' }]}>
                      Anti-spoof
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* Enroll Card */}
              <TouchableOpacity
                style={styles.actionCard}
                onPress={onNavigateEnroll}
                activeOpacity={0.85}
              >
                <View style={styles.actionCardContent}>
                  <View
                    style={[
                      styles.actionIconCircle,
                      { backgroundColor: '#00C85320' },
                    ]}
                  >
                    <Text style={styles.actionIcon}>👤</Text>
                  </View>
                  <View style={styles.actionTextContainer}>
                    <Text style={styles.actionTitle}>
                      Enroll New User
                    </Text>
                    <Text style={styles.actionDesc}>
                      Capture 3 face frames, average embeddings, encrypt &
                      store on-device
                    </Text>
                  </View>
                  <Text style={styles.actionArrow}>›</Text>
                </View>
                <View style={styles.actionBadgeRow}>
                  <View style={[styles.actionBadge, { backgroundColor: '#00C85315' }]}>
                    <Text style={[styles.actionBadgeText, { color: '#00C853' }]}>
                      3-frame avg
                    </Text>
                  </View>
                  <View style={[styles.actionBadge, { backgroundColor: '#FF6D0015' }]}>
                    <Text style={[styles.actionBadgeText, { color: '#FF9E40' }]}>
                      AES-256
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* Manage Database Card */}
              <TouchableOpacity
                style={styles.actionCard}
                onPress={onNavigateAdmin}
                activeOpacity={0.85}
              >
                <View style={styles.actionCardContent}>
                  <View
                    style={[
                      styles.actionIconCircle,
                      { backgroundColor: '#FF6D0020' },
                    ]}
                  >
                    <Text style={styles.actionIcon}>🗄️</Text>
                  </View>
                  <View style={styles.actionTextContainer}>
                    <Text style={styles.actionTitle}>
                      Manage Database
                    </Text>
                    <Text style={styles.actionDesc}>
                      View, edit, and remove enrolled user identities
                    </Text>
                  </View>
                  <Text style={styles.actionArrow}>›</Text>
                </View>
                <View style={styles.actionBadgeRow}>
                  <View style={[styles.actionBadge, { backgroundColor: '#FF6D0015' }]}>
                    <Text style={[styles.actionBadgeText, { color: '#FF9E40' }]}>
                      CRUD Admin
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* ─── Pipeline Status ─── */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>AI Pipeline</Text>
                <Text style={styles.sectionBadge}>7 MODELS</Text>
              </View>

              <View style={styles.pipelineCard}>
                {PIPELINE_STEPS.map((step, index) => {
                  const isLoaded =
                    modelInfo?.modelsLoaded?.includes(step.name) ?? true;
                  return (
                    <View key={step.name}>
                      <View style={styles.pipelineRow}>
                        <View style={styles.pipelineStepNumber}>
                          <Text style={styles.pipelineStepNum}>
                            {index + 1}
                          </Text>
                        </View>
                        <Text style={styles.pipelineIcon}>{step.icon}</Text>
                        <View style={styles.pipelineTextCol}>
                          <Text style={styles.pipelineName}>{step.name}</Text>
                          <Text style={styles.pipelineDesc}>{step.desc}</Text>
                        </View>
                        <View
                          style={[
                            styles.pipelineStatusDot,
                            {
                              backgroundColor: isLoaded
                                ? '#00E676'
                                : '#FF5252',
                            },
                          ]}
                        />
                      </View>
                      {index < PIPELINE_STEPS.length - 1 && (
                        <View style={styles.pipelineDivider} />
                      )}
                    </View>
                  );
                })}

                {modelInfo && (
                  <View style={styles.pipelineFooter}>
                    <Text style={styles.pipelineFooterText}>
                      Total: {modelInfo.totalSizeMB.toFixed(1)} MB • Avg
                      inference: {modelInfo.inferenceTimeAvgMs.toFixed(0)}ms
                    </Text>
                  </View>
                )}
              </View>

              {/* ─── Sync Status ─── */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Sync Status</Text>
                <TouchableOpacity onPress={onNavigateSync}>
                  <Text style={styles.sectionLink}>View All →</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.syncCard}>
                <View style={styles.syncRow}>
                  <View style={styles.syncStatBox}>
                    <Text style={styles.syncStatValue}>
                      {sync.pendingCount}
                    </Text>
                    <Text style={styles.syncStatLabel}>Pending</Text>
                  </View>
                  <View style={styles.syncStatDivider} />
                  <View style={styles.syncStatBox}>
                    <Text
                      style={[
                        styles.syncStatValue,
                        { color: sync.isOnline ? '#00E676' : '#FF5252' },
                      ]}
                    >
                      {sync.isOnline ? '●' : '○'}
                    </Text>
                    <Text style={styles.syncStatLabel}>
                      {sync.isOnline ? 'Connected' : 'Offline'}
                    </Text>
                  </View>
                  <View style={styles.syncStatDivider} />
                  <View style={styles.syncStatBox}>
                    <Text style={styles.syncStatValue}>
                      {sync.lastSyncTimestamp
                        ? new Date(sync.lastSyncTimestamp).toLocaleTimeString(
                            [],
                            {
                              hour: '2-digit',
                              minute: '2-digit',
                            },
                          )
                        : '—'}
                    </Text>
                    <Text style={styles.syncStatLabel}>Last Sync</Text>
                  </View>
                </View>
              </View>

              {/* ─── Last Auth Result ─── */}
              {biometrics.authResult && (
                <>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Last Authentication</Text>
                  </View>
                  <View
                    style={[
                      styles.lastAuthCard,
                      {
                        borderLeftColor: biometrics.authResult.success
                          ? '#00E676'
                          : '#FF5252',
                      },
                    ]}
                  >
                    <Text style={styles.lastAuthIcon}>
                      {biometrics.authResult.success ? '✅' : '❌'}
                    </Text>
                    <View style={styles.lastAuthTextCol}>
                      <Text style={styles.lastAuthTitle}>
                        {biometrics.authResult.success
                          ? biometrics.authResult.username || 'Verified'
                          : 'Auth Failed'}
                      </Text>
                      <Text style={styles.lastAuthDetails}>
                        Confidence:{' '}
                        {(biometrics.authResult.confidence * 100).toFixed(1)}% •
                        Liveness:{' '}
                        {(biometrics.authResult.livenessScore * 100).toFixed(1)}
                        %
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </>
          )}

          {/* ─── Footer ─── */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              NHAI Biometrics v0.1.0 — Hackathon 7.0
            </Text>
            <Text style={styles.footerSub}>
              Offline-first • AES-256 encrypted • TFLite accelerated
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },

  // ─── Header ───
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    backgroundColor: '#111',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  logo: {
    fontSize: 22,
    fontWeight: '900',
    color: '#00E676',
    letterSpacing: 1,
  },
  logoSub: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // ─── Scroll ───
  scrollContent: {
    padding: 18,
    paddingBottom: 40,
  },

  // ─── Init Card ───
  initCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    marginBottom: 20,
  },
  initCardIcon: {
    marginBottom: 16,
  },
  initCardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 10,
  },
  initCardDesc: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 24,
  },

  // ─── Buttons ───
  button: {
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  initButton: {
    backgroundColor: '#2962FF',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  initLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // ─── Action Cards ───
  actionCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  actionCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  actionIcon: {
    fontSize: 22,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  actionDesc: {
    fontSize: 12,
    color: '#777',
    lineHeight: 16,
  },
  actionArrow: {
    fontSize: 24,
    color: '#555',
    fontWeight: '300',
    marginLeft: 8,
  },
  actionBadgeRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  actionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  actionBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // ─── Section Headers ───
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 22,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#CCC',
  },
  sectionBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#555',
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    letterSpacing: 1,
  },
  sectionLink: {
    fontSize: 13,
    color: '#2962FF',
    fontWeight: '600',
  },

  // ─── Pipeline Card ───
  pipelineCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    padding: 6,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  pipelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  pipelineStepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#222',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  pipelineStepNum: {
    fontSize: 10,
    fontWeight: '700',
    color: '#666',
  },
  pipelineIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  pipelineTextCol: {
    flex: 1,
  },
  pipelineName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EEE',
  },
  pipelineDesc: {
    fontSize: 11,
    color: '#666',
    marginTop: 1,
  },
  pipelineStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pipelineDivider: {
    height: 1,
    backgroundColor: '#1F1F1F',
    marginLeft: 44,
  },
  pipelineFooter: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  pipelineFooterText: {
    fontSize: 11,
    color: '#555',
    textAlign: 'center',
  },

  // ─── Sync Card ───
  syncCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncStatBox: {
    flex: 1,
    alignItems: 'center',
  },
  syncStatValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 4,
  },
  syncStatLabel: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  syncStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#2A2A2A',
  },

  // ─── Last Auth ───
  lastAuthCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderLeftWidth: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  lastAuthIcon: {
    fontSize: 28,
    marginRight: 14,
  },
  lastAuthTextCol: {
    flex: 1,
  },
  lastAuthTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 3,
  },
  lastAuthDetails: {
    fontSize: 12,
    color: '#777',
  },

  // ─── Footer ───
  footer: {
    alignItems: 'center',
    marginTop: 32,
    paddingBottom: 10,
  },
  footerText: {
    fontSize: 12,
    color: '#444',
    fontWeight: '600',
  },
  footerSub: {
    fontSize: 10,
    color: '#333',
    marginTop: 4,
  },
});
