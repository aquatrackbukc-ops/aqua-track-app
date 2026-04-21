import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import AdminDeviceSelector from '@/components/AdminDeviceSelector';
import { db, auth } from '@/lib/firebase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { signOut } from 'firebase/auth';
import { onValue, ref } from 'firebase/database';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { width } = Dimensions.get('window');

// ── Sub-components ─────────────────────────────────────────────────────────

function PulsingDot({ active }: { active: boolean }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulse, { toValue: 1.9, duration: 900, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 900, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pulse, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active]);

  const dotColor = active ? Colors.accent : Colors.danger;

  return (
    <View style={styles.dotWrapper}>
      <Animated.View
        style={[
          styles.dotRing,
          { borderColor: dotColor, transform: [{ scale: pulse }], opacity },
        ]}
      />
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
    </View>
  );
}

function FlowStatusCard({ active, flowRate }: { active: boolean; flowRate: number }) {
  return (
    <View style={[styles.card, styles.flowCard]}>
      <LinearGradient
        colors={
          active
            ? ['rgba(0,255,179,0.08)', 'rgba(0,255,179,0.02)']
            : ['rgba(255,77,106,0.08)', 'rgba(255,77,106,0.02)']
        }
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={styles.flowLeft}>
        <Text style={styles.cardLabel}>Water Flow Status</Text>
        <Text
          style={[
            styles.flowStatusText,
            { color: active ? Colors.accent : Colors.danger },
          ]}>
          {active ? 'FLOWING' : 'NO FLOW'}
        </Text>
        {active && (
          <Text style={styles.flowRate}>
            <Text style={styles.flowRateValue}>{flowRate.toFixed(2)}</Text>
            <Text style={styles.flowRateUnit}> L/min</Text>
          </Text>
        )}
      </View>
      <PulsingDot active={active} />
    </View>
  );
}

function UsageProgressCard({ litersUsed, daysMonitored }: { litersUsed: number; daysMonitored: number }) {
  return (
    <View style={[styles.card, styles.usageCard]}>
      <View style={styles.usageHeader}>
        <View>
          <Text style={styles.cardLabel}>Litres Used This Month</Text>
          <View style={styles.usageValueRow}>
            <Text style={styles.usageValue}>
              {litersUsed.toLocaleString('en-PK', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}
            </Text>
            <Text style={styles.usageUnit}> L</Text>
          </View>
        </View>
        <View style={styles.usageIconBox}>
          <Ionicons name="water" size={24} color={Colors.primary} />
        </View>
      </View>
      <Text style={styles.usageDetailText}>
        Recorded across {daysMonitored} days of active monitoring.
      </Text>
    </View>
  );
}

function StatGrid({ litersUsed, lastUpdated }: { litersUsed: number; lastUpdated: string }) {
  // Simple logic for stats based on current monthly total
  const today = new Date();
  const todayDay = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - todayDay;
  const dailyAverage = litersUsed / todayDay;
  const projectedTotal = dailyAverage * daysInMonth;

  const stats = [
    {
      icon: 'today-outline' as const,
      label: 'Daily Average',
      value: `${dailyAverage.toFixed(1)} L`,
      sub: 'per day',
    },
    {
      icon: 'calendar-outline' as const,
      label: 'Days Left',
      value: `${daysLeft}`,
      sub: `in ${today.toLocaleString('default', { month: 'long' })}`,
    },
    {
      icon: 'trending-up-outline' as const,
      label: 'Projected',
      value: `${(projectedTotal / 1000).toFixed(2)}k L`,
      sub: 'end-of-month',
    },
    {
      icon: 'time-outline' as const,
      label: 'Last Update',
      value: lastUpdated,
      sub: 'today',
    },
  ];

  return (
    <View style={styles.statGrid}>
      {stats.map((s, i) => (
        <View key={i} style={styles.statCard}>
          <Ionicons name={s.icon} size={20} color={Colors.primary} />
          <Text style={styles.statValue}>{s.value}</Text>
          <Text style={styles.statLabel}>{s.label}</Text>
          <Text style={styles.statSub}>{s.sub}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const { profile, loading: authLoading, activeDeviceId } = useAuth();
  const [sensorData, setSensorData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const headerAnim = useRef(new Animated.Value(0)).current;

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error', error);
    }
  };

  useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (authLoading || !activeDeviceId) {
      if (!authLoading && !activeDeviceId) setLoading(false);
      return;
    }

    const deviceRef = ref(db, `AquaTrack/${activeDeviceId}`);
    const unsubscribe = onValue(deviceRef, (snapshot) => {
      setSensorData(snapshot.val());
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeDeviceId, authLoading]);

  // Loading state
  if (authLoading || (loading && activeDeviceId)) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // No device state
  if (!activeDeviceId) {
    return (
      <View style={[styles.root, styles.center, { padding: 40 }]}>
        <AdminDeviceSelector />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="alert-circle-outline" size={80} color={Colors.textMuted} />
          <Text style={styles.noDeviceTitle}>No Device Assigned</Text>
          <Text style={styles.noDeviceSub}>
            Please contact your administrator to link a smart water meter to your account.
          </Text>
        </View>
      </View>
    );
  }

  const flowActive = sensorData?.WaterStatus === 'Connected' || sensorData?.FlowRate_LPM > 0;
  const flowRate = sensorData?.FlowRate_LPM || 0;
  const litersUsed = sensorData?.TotalLiters || 0;
  const lastUpdatedRaw = sensorData?.Timestamp ? new Date(sensorData.Timestamp) : null;
  const lastUpdated = lastUpdatedRaw 
    ? lastUpdatedRaw.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '--:--:--';
  const todayDay = new Date().getDate();

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Header */}
        <Animated.View
          style={[
            styles.header,
            { opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] },
          ]}>
          <AdminDeviceSelector />
          <LinearGradient
            colors={['rgba(0,200,255,0.15)', 'transparent']}
            style={styles.headerGradient}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />
          <View style={styles.headerTopRow}>
            <View>
              <Text style={styles.headerGreeting}>Welcome back, {profile?.name || 'User'} 👋</Text>
              <Text style={styles.headerTitle}>AquaTrack</Text>
            </View>
            <TouchableOpacity onPress={handleLogout} style={styles.headerIconBox}>
              <Ionicons name="log-out-outline" size={28} color={Colors.danger} />
            </TouchableOpacity>
          </View>
          <Text style={styles.headerSub}>
            {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}  •  {activeDeviceId}
          </Text>
        </Animated.View>

        {/* Flow card */}
        <FlowStatusCard active={flowActive} flowRate={flowRate} />

        {/* Monthly usage card */}
        <UsageProgressCard litersUsed={litersUsed} daysMonitored={todayDay} />

        {/* Stat grid */}
        <Text style={styles.sectionTitle}>Quick Stats</Text>
        <StatGrid litersUsed={litersUsed} lastUpdated={lastUpdated} />

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },

  noDeviceTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 20,
    textAlign: 'center',
  },
  noDeviceSub: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
  },

  // Header
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    overflow: 'hidden',
  },
  headerGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  headerTopRow: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 10,
  },
  headerGreeting: {
    fontSize: 14,
    color: Colors.textSecondary,
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  headerSub: {
    paddingHorizontal: 20,
    marginTop: 6,
    fontSize: 13,
    color: Colors.textMuted,
    letterSpacing: 0.3,
  },
  headerIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.primaryGlow,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Card base
  card: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 20,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },

  // Flow card
  flowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 22,
  },
  flowLeft: { flex: 1 },
  cardLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  flowStatusText: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  flowRate: { marginTop: 6 },
  flowRateValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  flowRateUnit: {
    fontSize: 14,
    color: Colors.textSecondary,
  },

  // Pulsing dot
  dotWrapper: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotRing: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },

  // Usage card
  usageCard: { padding: 22 },
  usageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  usageValueRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4 },
  usageValue: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: -1,
  },
  usageUnit: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  usageIconBox: {
    padding: 12,
    backgroundColor: Colors.bgCardAlt,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  usageDetailText: {
    fontSize: 13,
    color: Colors.textSecondary,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
    marginTop: 4,
  },

  // Stat grid
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginHorizontal: 20,
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 14,
    gap: 0,
  },
  statCard: {
    width: (width - 28 * 2 - 12) / 2,
    margin: 6,
    backgroundColor: Colors.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    alignItems: 'flex-start',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: 10,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 4,
  },
  statSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
