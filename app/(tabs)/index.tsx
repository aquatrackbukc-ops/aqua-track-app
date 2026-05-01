import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import AdminDeviceSelector from '@/components/AdminDeviceSelector';
import { db, auth } from '@/lib/firebase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { signOut } from 'firebase/auth';
import { onValue, ref, get, query, limitToLast } from 'firebase/database';
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

function GlobalSystemOverview({ stats, usersCount }: { stats: any; usersCount: number }) {
  return (
    <View style={styles.scrollContent}>
      <View style={[styles.card, { padding: 22, backgroundColor: Colors.primaryGlow, borderColor: Colors.primary }]}>
        <Text style={styles.cardLabel}>System-Wide Consumption</Text>
        <View style={styles.usageValueRow}>
          <Text style={[styles.usageValue, { color: Colors.primary }]}>
            {stats.totalLiters.toLocaleString()}
          </Text>
          <Text style={styles.usageUnit}> Liters Tot.</Text>
        </View>
        <Text style={styles.usageDetailText}>Aggregated fleet performance</Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Ionicons name="hardware-chip-outline" size={20} color={Colors.accent} />
          <Text style={styles.statBoxValue}>{stats.activeDevices}</Text>
          <Text style={styles.statBoxLabel}>Active Meters</Text>
        </View>
        <View style={styles.statBox}>
          <Ionicons name="people-outline" size={20} color={Colors.primary} />
          <Text style={styles.statBoxValue}>{usersCount}</Text>
          <Text style={styles.statBoxLabel}>Total Users</Text>
        </View>
        <View style={styles.statBox}>
          <Ionicons name="water-outline" size={20} color={Colors.accent} />
          <Text style={styles.statBoxValue}>{stats.flowingDevices}</Text>
          <Text style={styles.statBoxLabel}>Flowing Now</Text>
        </View>
        <View style={styles.statBox}>
          <Ionicons name="shield-checkmark-outline" size={20} color={Colors.primary} />
          <Text style={styles.statBoxValue}>Healthy</Text>
          <Text style={styles.statBoxLabel}>Fleet Health</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={{ padding: 22 }}>
          <Text style={styles.cardLabel}>Admin Command Center</Text>
          <Text style={styles.noDeviceSub}>
            Welcome to the AquaTrack Nerve Center. Use the floating switcher at the bottom right to inspect specific users or raw hardware nodes.
          </Text>
        </View>
      </View>
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

function StatGrid({
  litersUsed,
  lastUpdated,
  pricing,
  historicalAvg,
}: {
  litersUsed: number;
  lastUpdated: string;
  pricing: { pricePerLiter: number; currency: string };
  historicalAvg: number | null;
}) {
  const today = new Date();
  const todayDay = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - todayDay;
  
  const currentAvg = litersUsed / todayDay;
  
  // Confidence Blending Logic
  let projectedAvg = currentAvg;
  
  if (historicalAvg !== null) {
    if (todayDay <= 5) {
      // Early Month: 80% History, 20% Current Trend
      projectedAvg = (historicalAvg * 0.8) + (currentAvg * 0.2);
    } else if (todayDay <= 15) {
      // Mid Month: 50% History, 50% Current Trend
      projectedAvg = (historicalAvg * 0.5) + (currentAvg * 0.5);
    } else {
      // Late Month: 100% Current Trend (Realized)
      projectedAvg = currentAvg;
    }
  }

  const projectedTotal = projectedAvg * daysInMonth;
  const currentCost = litersUsed * pricing.pricePerLiter;
  const projectedCost = projectedTotal * pricing.pricePerLiter;

  const stats = [
    {
      icon: 'cash-outline' as const,
      label: 'Current Bill',
      value: `${pricing.currency} ${Math.floor(currentCost).toLocaleString()}`,
      sub: 'this month',
    },
    {
      icon: 'wallet-outline' as const,
      label: 'Projected Bill',
      value: `${pricing.currency} ${Math.floor(projectedCost).toLocaleString()}`,
      sub: historicalAvg && todayDay <= 15 ? 'stabilized est.' : 'end-of-month est.',
    },
    {
      icon: 'today-outline' as const,
      label: 'Daily Average',
      value: `${currentAvg.toFixed(1)} L`,
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
  const { profile, loading: authLoading, activeDeviceId, impersonatedUser, setImpersonatedUser, isAdmin } = useAuth();
  const [sensorData, setSensorData] = useState<any>(null);
  const [pricing, setPricing] = useState({ pricePerLiter: 0, currency: 'PKR' });
  const [historicalAvg, setHistoricalAvg] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [globalStats, setGlobalStats] = useState({ totalLiters: 0, activeDevices: 0, flowingDevices: 0 });
  const [userCount, setUserCount] = useState(0);
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
    if (authLoading) return;

    if (!activeDeviceId && isAdmin) {
      let devicesReady = false;
      let usersReady = false;
      const checkReady = () => { if (devicesReady && usersReady) setLoading(false); };

      const devicesRef = ref(db, 'AquaTrack');
      const unsubDevices = onValue(devicesRef, (snap) => {
        const data = snap.val();
        if (data) {
          let totalL = 0;
          let flowing = 0;
          let activeNodes = 0;
          Object.values(data).forEach((device: any) => {
            totalL += device.TotalLiters || 0;
            if (device.WaterStatus === 'Connected' || device.FlowRate_LPM > 0) activeNodes++;
            if (device.FlowRate_LPM > 0) flowing++;
          });
          setGlobalStats({ totalLiters: totalL, activeDevices: activeNodes, flowingDevices: flowing });
        }
        devicesReady = true;
        checkReady();
      });

      const usersRef = ref(db, 'users');
      const unsubUsers = onValue(usersRef, (snap) => {
        const data = snap.val();
        if (data) setUserCount(Object.keys(data).length);
        usersReady = true;
        checkReady();
      });

      return () => {
        unsubDevices();
        unsubUsers();
      };
    }

    if (!activeDeviceId) {
      setLoading(false);
      return;
    }

    const deviceRef = ref(db, `AquaTrack/${activeDeviceId}`);
    const unsubscribeDevice = onValue(deviceRef, (snapshot) => {
      setSensorData(snapshot.val());
      setLoading(false);
    });
    const pricingRef = ref(db, 'settings/pricing');
    const unsubscribePricing = onValue(pricingRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        setPricing({
          pricePerLiter: val.pricePerLiter ?? 0,
          currency: val.currency ?? 'PKR',
        });
      }
    });

    // Fetch Historical Average (Same month last year OR most recent)
    const fetchHistory = async () => {
      const now = new Date();
      const lastYearKey = `${now.getFullYear() - 1}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
      
      try {
        // 1. Try same month last year
        const lastYearRef = ref(db, `history/${activeDeviceId}/${lastYearKey}`);
        const lastYearSnap = await get(lastYearRef);
        
        if (lastYearSnap.exists()) {
          setHistoricalAvg(lastYearSnap.val().averageDailyLiters);
          return;
        }
        
        // 2. Fallback to most recent record
        const recentQuery = query(ref(db, `history/${activeDeviceId}`), limitToLast(1));
        const recentSnap = await get(recentQuery);
        
        if (recentSnap.exists()) {
          const data = recentSnap.val();
          const latestKey = Object.keys(data)[0];
          setHistoricalAvg(data[latestKey].averageDailyLiters);
        }
      } catch (e) {
        console.error('Error fetching baseline:', e);
      }
    };

    fetchHistory();

    return () => {
      unsubscribeDevice();
      unsubscribePricing();
    };
  }, [activeDeviceId, authLoading, isAdmin]);

  // Loading state: Show indicator until auth is ready AND initial data is fetched
  if (authLoading || loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
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
          <View style={styles.headerSubRow}>
            <Text style={styles.headerSub}>
              {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </Text>
            {impersonatedUser && (
              <TouchableOpacity 
                style={styles.impersonationBadge}
                onPress={() => setImpersonatedUser(null)}
              >
                <Ionicons name="eye-outline" size={14} color={Colors.accent} />
                <Text style={styles.impersonationText}>Viewing: {impersonatedUser.name}</Text>
                <Ionicons name="close-circle" size={14} color={Colors.textMuted} style={{marginLeft: 4}} />
              </TouchableOpacity>
            )}
            {!impersonatedUser && !isAdmin && (
              <Text style={styles.headerSub}>  •  {activeDeviceId}</Text>
            )}
            {!impersonatedUser && isAdmin && !activeDeviceId && (
               <View style={styles.impersonationBadge}>
                 <Ionicons name="shield-outline" size={14} color={Colors.accent} />
                 <Text style={styles.impersonationText}>System-Wide Overview</Text>
               </View>
            )}
            {!impersonatedUser && isAdmin && activeDeviceId && (
              <TouchableOpacity 
                style={styles.impersonationBadge}
                onPress={() => setImpersonatedUser(null)}
              >
                <Ionicons name="eye-outline" size={14} color={Colors.accent} />
                <Text style={styles.impersonationText}>Viewing: {activeDeviceId}</Text>
                <Ionicons name="close-circle" size={14} color={Colors.textMuted} style={{marginLeft: 4}} />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {/* Main Content */}
        {!activeDeviceId && isAdmin ? (
          <GlobalSystemOverview stats={globalStats} usersCount={userCount} />
        ) : !activeDeviceId ? (
          <View style={[styles.center, { marginTop: 100, padding: 40 }]}>
            <Ionicons name="water-outline" size={80} color={Colors.textMuted} />
            <Text style={styles.noDeviceTitle}>Access Pending</Text>
            <Text style={styles.noDeviceSub}>
              We haven't linked a water meter to your account yet. Contact your administrator to get started.
            </Text>
          </View>
        ) : (
          <>
            <FlowStatusCard active={flowActive} flowRate={flowRate} />
            <UsageProgressCard litersUsed={litersUsed} daysMonitored={todayDay} />
            <Text style={styles.sectionTitle}>Quick Stats</Text>
            <StatGrid 
              litersUsed={litersUsed} 
              lastUpdated={lastUpdated} 
              pricing={pricing} 
              historicalAvg={historicalAvg}
            />
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating switcher for admins */}
      <AdminDeviceSelector />
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
    fontSize: 13,
    color: Colors.textMuted,
    letterSpacing: 0.3,
  },
  headerSubRow: {
    paddingHorizontal: 20,
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  impersonationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,255,179,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,255,179,0.2)',
    gap: 6,
  },
  impersonationText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.accent,
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    gap: 12,
    marginTop: 8,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    gap: 8,
  },
  statBoxValue: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  statBoxLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
});
