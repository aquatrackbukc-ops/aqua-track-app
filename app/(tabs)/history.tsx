import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import AdminDeviceSelector from '@/components/AdminDeviceSelector';
import { db } from '@/lib/firebase';
import { onValue, ref } from 'firebase/database';

// ── Types ──────────────────────────────────────────────────────────────────
interface MonthlyRecord {
  key: string;          // e.g. "2024-03"
  monthName: string;    // e.g. "March 2024"
  totalLiters: number;
  totalCost: number;
  highestUsageDay: string;
  averageDailyLiters: number;
}

interface PricingSettings {
  pricePerLiter: number;
  currency: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function formatCost(amount: number, currency: string) {
  return `${currency} ${amount.toFixed(2)}`;
}

function formatLiters(liters: number) {
  if (liters >= 1000) return `${(liters / 1000).toFixed(2)}k L`;
  return `${liters.toFixed(0)} L`;
}

// ── History Card ───────────────────────────────────────────────────────────
function HistoryCard({
  item,
  index,
  currency,
}: {
  item: MonthlyRecord;
  index: number;
  currency: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Entrance animation staggered by index
  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        delay: index * 80,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        delay: index * 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Expand / collapse animation
  const toggleExpand = () => {
    const toValue = expanded ? 0 : 1;
    Animated.timing(anim, {
      toValue,
      duration: 280,
      useNativeDriver: false,
    }).start();
    setExpanded(!expanded);
  };

  const expandedHeight = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 160],
  });

  return (
    <Animated.View
      style={[
        styles.historyCard,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}>
      <TouchableOpacity
        onPress={toggleExpand}
        activeOpacity={0.8}
        style={styles.historyCardInner}>

        {/* Top row */}
        <View style={styles.cardTopRow}>
          <View style={styles.monthIcon}>
            <Ionicons name="calendar" size={18} color={Colors.primary} />
          </View>
          <View style={styles.cardTopMid}>
            <Text style={styles.monthText}>{item.monthName}</Text>
            <View style={styles.litresRow}>
              <Text style={styles.litresValue}>{formatLiters(item.totalLiters)}</Text>
            </View>
          </View>
          {/* Cost badge */}
          <View style={styles.costBadge}>
            <Text style={styles.costBadgeText}>{formatCost(item.totalCost, currency)}</Text>
          </View>
          <Animated.View
            style={{
              transform: [
                {
                  rotate: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '180deg'],
                  }),
                },
              ],
            }}>
            <Ionicons name="chevron-down" size={18} color={Colors.textMuted} />
          </Animated.View>
        </View>

        {/* Mini progress bar */}
        <View style={styles.miniTrack}>
          <View style={[styles.miniFill, { width: '100%', backgroundColor: Colors.primary }]} />
        </View>
        <View style={styles.miniLabels}>
          <Text style={styles.miniPct}>{item.monthName} Usage Details</Text>
          <Text style={styles.miniDays}>Tap to expand</Text>
        </View>

        {/* Expanded details */}
        <Animated.View style={{ height: expandedHeight, overflow: 'hidden' }}>
          <View style={styles.expandedContent}>
            <View style={styles.divider} />
            <View style={styles.detailGrid}>
              <DetailStat
                label="Daily Average"
                value={`${item.averageDailyLiters.toFixed(1)} L`}
                icon="water-outline"
              />
              <DetailStat
                label="Total Cost"
                value={formatCost(item.totalCost, currency)}
                icon="cash-outline"
                valueColor={Colors.accent}
              />
              <DetailStat
                label="Peak Usage Day"
                value={item.highestUsageDay}
                icon="today-outline"
              />
              <DetailStat
                label="Total Liters"
                value={formatLiters(item.totalLiters)}
                icon="trending-up-outline"
              />
            </View>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function DetailStat({
  label,
  value,
  icon,
  valueColor,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  valueColor?: string;
}) {
  return (
    <View style={styles.detailStat}>
      <Ionicons name={icon} size={14} color={Colors.textMuted} />
      <Text style={[styles.detailStatValue, valueColor ? { color: valueColor } : {}]}>
        {value}
      </Text>
      <Text style={styles.detailStatLabel}>{label}</Text>
    </View>
  );
}

// ── Summary Banner ─────────────────────────────────────────────────────────
function SummaryBanner({
  data,
  currency,
}: {
  data: MonthlyRecord[];
  currency: string;
}) {
  const totalL = data.reduce((s, d) => s + d.totalLiters, 0);
  const totalCost = data.reduce((s, d) => s + d.totalCost, 0);
  const avgL = data.length > 0 ? totalL / data.length : 0;

  return (
    <View style={styles.summaryBanner}>
      <View style={styles.bannerStat}>
        <Text style={styles.bannerValue}>{formatLiters(totalL)}</Text>
        <Text style={styles.bannerLabel}>Total Usage</Text>
      </View>
      <View style={styles.bannerDivider} />
      <View style={styles.bannerStat}>
        <Text style={styles.bannerValue}>{formatLiters(avgL)}</Text>
        <Text style={styles.bannerLabel}>Monthly Avg</Text>
      </View>
      <View style={styles.bannerDivider} />
      <View style={styles.bannerStat}>
        <Text style={[styles.bannerValue, { color: Colors.accent }]}>
          {currency} {totalCost.toFixed(0)}
        </Text>
        <Text style={styles.bannerLabel}>Total Cost</Text>
      </View>
    </View>
  );
}

// ── Filter Pills ───────────────────────────────────────────────────────────
function FilterPills({
  active,
  onChange,
  years,
}: {
  active: string;
  onChange: (f: string) => void;
  years: string[];
}) {
  const filters = ['All', ...years];
  return (
    <View style={styles.filterRow}>
      {filters.map(f => (
        <TouchableOpacity
          key={f}
          style={[styles.filterPill, active === f && styles.filterPillActive]}
          onPress={() => onChange(f)}
          activeOpacity={0.7}>
          <Text
            style={[
              styles.filterPillText,
              active === f && styles.filterPillTextActive,
            ]}>
            {f}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────
export default function HistoryScreen() {
  const { profile, loading: authLoading, activeDeviceId } = useAuth();
  const [historyData, setHistoryData] = useState<MonthlyRecord[]>([]);
  const [pricing, setPricing] = useState<PricingSettings>({ pricePerLiter: 0.05, currency: 'PKR' });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 700, useNativeDriver: true }).start();
  }, []);

  // Fetch global pricing settings once
  useEffect(() => {
    const pricingRef = ref(db, 'settings/pricing');
    const unsub = onValue(pricingRef, (snap) => {
      const val = snap.val();
      if (val) setPricing(val);
    });
    return () => unsub();
  }, []);

  // Fetch history for active device
  useEffect(() => {
    if (authLoading || !activeDeviceId) {
      if (!authLoading && !activeDeviceId) setLoading(false);
      return;
    }

    setLoading(true);
    const historyRef = ref(db, `history/${activeDeviceId}`);
    const unsubscribe = onValue(historyRef, (snapshot) => {
      const val = snapshot.val();
      if (val && typeof val === 'object') {
        // Keys are like "2024-03", values are the month objects
        const records: MonthlyRecord[] = Object.entries(val).map(([key, data]: [string, any]) => ({
          key,
          monthName: data.monthName ?? key,
          totalLiters: data.totalLiters ?? 0,
          totalCost: data.totalCost ?? 0,
          highestUsageDay: data.highestUsageDay ?? '—',
          averageDailyLiters: data.averageDailyLiters ?? 0,
        }));

        // Sort descending (newest first) — "2024-03" > "2023-11" sorts naturally
        records.sort((a, b) => b.key.localeCompare(a.key));
        setHistoryData(records);
      } else {
        setHistoryData([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeDeviceId, authLoading]);

  if (authLoading || (loading && activeDeviceId)) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!activeDeviceId) {
    return (
      <View style={[styles.root, styles.center, { padding: 40 }]}>
        <AdminDeviceSelector />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="calendar-outline" size={80} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Access Pending</Text>
          <Text style={styles.emptySub}>
            Connect a device to your account to start seeing usage history.
          </Text>
        </View>
      </View>
    );
  }

  // Derive unique years from keys e.g. "2024-03" → "2024"
  const availableYears = [...new Set(historyData.map(d => d.key.split('-')[0]))].sort((a, b) => b.localeCompare(a));

  const filtered =
    filter === 'All'
      ? historyData
      : historyData.filter(d => d.key.startsWith(filter));

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
            {
              opacity: headerAnim,
              transform: [
                {
                  translateY: headerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 0],
                  }),
                },
              ],
            },
          ]}>
          <AdminDeviceSelector />
          <View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
            <Text style={styles.screenLabel}>Records</Text>
            <Text style={styles.screenTitle}>Usage History</Text>
            <View style={styles.deviceRow}>
              <Ionicons name="hardware-chip-outline" size={12} color={Colors.textMuted} />
              <Text style={styles.deviceIdText}>{activeDeviceId}</Text>
              <View style={styles.currencyBadge}>
                <Text style={styles.currencyBadgeText}>{pricing.currency}</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Summary */}
        <SummaryBanner data={historyData} currency={pricing.currency} />

        {/* Filter */}
        <FilterPills active={filter} onChange={setFilter} years={availableYears} />

        {/* Cards */}
        <View style={styles.cardList}>
          {filtered.map((item, i) => (
            <HistoryCard
              key={item.key}
              item={item}
              index={i}
              currency={pricing.currency}
            />
          ))}
          {filtered.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No records found for {filter}</Text>
            </View>
          )}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  center: { justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },

  header: {
    paddingTop: 60,
    paddingBottom: 20,
  },
  screenLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  screenTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  deviceIdText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  currencyBadge: {
    backgroundColor: Colors.primaryGlow,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    marginLeft: 4,
  },
  currencyBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 20,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
  },

  // Summary banner
  summaryBanner: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: Colors.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    padding: 18,
    alignItems: 'center',
  },
  bannerStat: { flex: 1, alignItems: 'center' },
  bannerValue: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.primary,
  },
  bannerLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 4,
    letterSpacing: 0.3,
  },
  bannerDivider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.border,
  },

  // Filter pills
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterPillActive: {
    backgroundColor: Colors.primaryGlow,
    borderColor: Colors.borderBright,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filterPillTextActive: { color: Colors.primary },

  // Card list
  cardList: { paddingHorizontal: 20, gap: 12 },

  // History card
  historyCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  historyCardInner: { padding: 18 },

  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
  },
  monthIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primaryGlow,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTopMid: { flex: 1 },
  monthText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  litresRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 2,
  },
  litresValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  costBadge: {
    backgroundColor: Colors.bgCardAlt,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  costBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.accent,
  },

  // Mini progress
  miniTrack: {
    height: 5,
    backgroundColor: Colors.bgCardAlt,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  miniFill: { height: '100%', borderRadius: 3 },
  miniLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  miniPct: { fontSize: 11, color: Colors.textSecondary },
  miniDays: { fontSize: 11, color: Colors.textMuted },

  // Expanded detail
  expandedContent: { paddingTop: 4 },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 12,
    marginTop: 8,
  },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  detailStat: {
    flex: 1,
    minWidth: '40%',
    backgroundColor: Colors.bgCardAlt,
    borderRadius: 12,
    padding: 10,
    gap: 3,
  },
  detailStatValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  detailStatLabel: { fontSize: 10, color: Colors.textMuted },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textMuted,
  },
});
