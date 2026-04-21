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
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import AdminDeviceSelector from '@/components/AdminDeviceSelector';
import { db } from '@/lib/firebase';
import { onValue, ref } from 'firebase/database';

const { width } = Dimensions.get('window');

// ── Constants ──────────────────────────────────────────────────────────────
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', ' Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CHART_HORIZONTAL_PADDING = 20;
const BAR_AREA_WIDTH = width - CHART_HORIZONTAL_PADDING * 2;
const BAR_GAP = 6;
const CHART_HEIGHT = 200;

// ── Types ──────────────────────────────────────────────────────────────────
interface MonthlyDataNode {
  key: string;       // e.g. "2024-03"
  month: string;     // e.g. "Mar"
  year: number;      // e.g. 2024
  liters: number;
}

// ── Bar Component ──────────────────────────────────────────────────────────
function AnimatedBar({
  item,
  index,
  maxValue,
  isCurrent,
  isSelected,
  onPress,
}: {
  item: MonthlyDataNode;
  index: number;
  maxValue: number;
  isCurrent: boolean;
  isSelected: boolean;
  onPress: () => void;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const barH = item.liters > 0 ? (item.liters / (maxValue || 1)) * CHART_HEIGHT : 0;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: barH,
      duration: 700 + index * 60,
      useNativeDriver: false,
    }).start();
  }, [barH]);

  const barColor = isCurrent ? Colors.accent : isSelected ? Colors.primary : Colors.primary;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={styles.barColumn}>
      <View style={[styles.barTrack, { height: CHART_HEIGHT }]}>
        <Animated.View
          style={[
            styles.barFill,
            {
              height: anim,
              backgroundColor: item.liters === 0 ? Colors.bgCardAlt : barColor,
              opacity: item.liters === 0 ? 0.3 : 1,
            },
          ]}
        />
      </View>
      <Text style={[styles.barLabel, isCurrent && { color: Colors.accent }]}>
        {item.month}
      </Text>
    </TouchableOpacity>
  );
}

// ── Summary Row ───────────────────────────────────────────────────────────
function SummaryRow({ data }: { data: MonthlyDataNode[] }) {
  const recorded = data.filter(d => d.liters > 0);
  const total = recorded.reduce((s, d) => s + d.liters, 0);
  const avg = recorded.length ? total / recorded.length : 0;
  const peak = recorded.length ? Math.max(...recorded.map(d => d.liters)) : 0;
  const peakMonth = recorded.find(d => d.liters === peak)?.month ?? '—';

  const cards = [
    { label: 'YTD Total', value: `${(total / 1000).toFixed(1)}k L`, icon: 'water-outline' as const },
    { label: 'Monthly Avg', value: `${(avg / 1000).toFixed(1)}k L`, icon: 'stats-chart-outline' as const },
    { label: 'Peak Month', value: peakMonth, sub: `${(peak / 1000).toFixed(1)}k L`, icon: 'trophy-outline' as const },
  ];

  return (
    <View style={styles.summaryRow}>
      {cards.map((c, i) => (
        <View key={i} style={styles.summaryCard}>
          <Ionicons name={c.icon} size={18} color={Colors.primary} />
          <Text style={styles.summaryValue}>{c.value}</Text>
          {c.sub && <Text style={styles.summarySub}>{c.sub}</Text>}
          <Text style={styles.summaryLabel}>{c.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────
export default function AnalyticsScreen() {
  const { profile, loading: authLoading, activeDeviceId } = useAuth();
  const currentYear = new Date().getFullYear();
  const currentMonthIndex = new Date().getMonth();

  const [allRecords, setAllRecords] = useState<MonthlyDataNode[]>([]);
  const [liveTotalLiters, setLiveTotalLiters] = useState<number>(0);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [analyticsData, setAnalyticsData] = useState<MonthlyDataNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState<number>(currentMonthIndex);
  const [showOlderYears, setShowOlderYears] = useState(false);

  const headerAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 700, useNativeDriver: true }).start();
  }, []);

  // Fetch from new history path
  useEffect(() => {
    if (authLoading || !activeDeviceId) {
      if (!authLoading && !activeDeviceId) setLoading(false);
      return;
    }

    const historyRef = ref(db, `history/${activeDeviceId}`);
    const unsubscribeHistory = onValue(historyRef, (snapshot) => {
      const val = snapshot.val();

      if (val && typeof val === 'object') {
        // Keys are "YYYY-MM", map to MonthlyDataNode
        const records: MonthlyDataNode[] = Object.entries(val).map(([key, data]: [string, any]) => {
          const [yearStr, monthStr] = key.split('-');
          const monthIndex = parseInt(monthStr, 10) - 1; // 0-based
          return {
            key,
            month: MONTH_NAMES[monthIndex] ?? key,
            year: parseInt(yearStr, 10),
            liters: data.totalLiters ?? 0,
          };
        });
        setAllRecords(records);
        // Do NOT auto-switch year — always stay on currentYear by default
      } else {
        setAllRecords([]);
      }
      setLoading(false);
    });

    const liveRef = ref(db, `AquaTrack/${activeDeviceId}/TotalLiters`);
    const unsubscribeLive = onValue(liveRef, (snapshot) => {
      setLiveTotalLiters(snapshot.val() || 0);
    });

    return () => {
      unsubscribeHistory();
      unsubscribeLive();
    };
  }, [activeDeviceId, authLoading]);

  // Rebuild 12-slot chart array whenever year or records change
  useEffect(() => {
    const slots: MonthlyDataNode[] = MONTH_NAMES.map((m, i) => ({
      key: `${selectedYear}-${String(i + 1).padStart(2, '0')}`,
      month: m,
      year: selectedYear,
      liters: 0,
    }));
    allRecords
      .filter(r => r.year === selectedYear)
      .forEach(r => {
        const monthIndex = parseInt(r.key.split('-')[1], 10) - 1;
        if (monthIndex >= 0 && monthIndex < 12) slots[monthIndex].liters = r.liters;
      });

    // Inject live current-month data over the history data
    if (selectedYear === currentYear) {
      slots[currentMonthIndex].liters = liveTotalLiters;
    }

    setAnalyticsData(slots);
    
    // Automatically select the current month if viewing the current year,
    // otherwise default to selecting the latest month with data or December.
    if (selectedYear === currentYear) {
      setSelectedIndex(currentMonthIndex);
    } else {
      setSelectedIndex(11); // Defaults to Dec for historical years, can be changed by user
    }
  }, [selectedYear, allRecords, liveTotalLiters]);

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
          <Ionicons name="stats-chart-outline" size={80} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Insights Locked</Text>
          <Text style={styles.emptySub}>
            Monthly analytics will appear here once your device is active and data is recorded.
          </Text>
        </View>
      </View>
    );
  }

  const rawMax = Math.max(...analyticsData.map(d => Number(d.liters) || 0), 2000);
  // Pad the max value heavily (20% headroom) and round to nearest 1000 to cleanly cap the chart
  const maxValue = Math.ceil((rawMax * 1.2) / 1000) * 1000;
  const selected = analyticsData[selectedIndex] || null;
  
  // All years in data sorted descending; always include currentYear at front
  const allYears = [...new Set([currentYear, ...allRecords.map(r => r.year)])].sort((a, b) => b - a);
  // Max 2 visible pills so '···' almost always appears for testing
  const visibleYears = allYears.slice(0, 2);
  const olderYears = allYears.slice(2);

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
              transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
              zIndex: 100, // Elevates the dropdown above the rest of the scroll view
              elevation: 10,
            },
          ]}>
          <AdminDeviceSelector />
          <View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
            <Text style={styles.screenLabel}>Analytics</Text>
            <Text style={styles.screenTitle}>{selectedYear} Usage</Text>
            <Text style={styles.deviceIdText}>Connected Device: {activeDeviceId}</Text>
          </View>
          {/* Year selector pills */}
          {allYears.length > 1 && (
            <View style={styles.yearPillRow}>
              {visibleYears.map(y => (
                <TouchableOpacity
                  key={y}
                  style={[styles.yearPill, selectedYear === y && styles.yearPillActive]}
                  onPress={() => { setSelectedYear(y); setShowOlderYears(false); }}>
                  <Text style={[styles.yearPillText, selectedYear === y && styles.yearPillTextActive]}>
                    {y === currentYear ? `${y} ·` : `${y}`}
                  </Text>
                </TouchableOpacity>
              ))}

              {/* Overflow button for older years */}
              {olderYears.length > 0 && (
                <View>
                  <TouchableOpacity
                    style={[styles.yearPill, olderYears.includes(selectedYear) && styles.yearPillActive]}
                    onPress={() => setShowOlderYears(v => !v)}>
                    <Text style={[styles.yearPillText, olderYears.includes(selectedYear) && styles.yearPillTextActive]}>
                      {olderYears.includes(selectedYear) ? `${selectedYear}` : '···'}
                    </Text>
                    <Ionicons
                      name={showOlderYears ? 'chevron-up' : 'chevron-down'}
                      size={12}
                      color={olderYears.includes(selectedYear) ? Colors.primary : Colors.textMuted}
                    />
                  </TouchableOpacity>

                  {/* Dropdown */}
                  {showOlderYears && (
                    <View style={styles.olderDropdown}>
                      {olderYears.map(y => (
                        <TouchableOpacity
                          key={y}
                          style={[styles.olderDropdownItem, selectedYear === y && styles.olderDropdownItemActive]}
                          onPress={() => { setSelectedYear(y); setShowOlderYears(false); }}>
                          <Text style={[styles.olderDropdownText, selectedYear === y && styles.yearPillTextActive]}>
                            {y}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>
          )}
        </Animated.View>

        {/* Summary strip */}
        <SummaryRow data={analyticsData} />

        {/* Chart card */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Monthly Consumption</Text>
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: Colors.accent }]} />
              <Text style={styles.legendText}>Current</Text>
              <View style={[styles.legendDot, { backgroundColor: Colors.primary, marginLeft: 10 }]} />
              <Text style={styles.legendText}>Past</Text>
            </View>
          </View>

          {selected && (
            <View style={styles.selectedInfo}>
              <Text style={styles.selectedMonth}>{selected.month} {selectedYear}</Text>
              <Text style={styles.selectedValue}>
                {selected.liters >= 1000
                  ? `${(selected.liters / 1000).toFixed(2)}k L`
                  : `${selected.liters.toFixed(1)} L`}
              </Text>
              {selectedIndex === currentMonthIndex && selectedYear === currentYear && (
                <View style={styles.partialBadge}>
                  <Text style={styles.partialBadgeText}>Live Month</Text>
                </View>
              )}
            </View>
          )}

          {/* Chart */}
          <View style={styles.chartArea}>
            {/* Y-axis labels */}
            <View style={styles.yAxis}>
              {[1, 0.75, 0.5, 0.25, 0].map((pct, i) => (
                <Text key={i} style={styles.yLabel}>
                  {((maxValue * pct) / 1000).toFixed(1)}k
                </Text>
              ))}
            </View>

            {/* Bars */}
            <View style={styles.barsContainer}>
              {/* Horizontal grid lines */}
              {[0.25, 0.5, 0.75, 1].map((pct, i) => (
                <View
                  key={i}
                  style={[
                    styles.gridLine,
                    // barsRow sits at bottom: 20, so offset grid lines by 20 as well
                    { bottom: CHART_HEIGHT * pct + 20 },
                  ]}
                />
              ))}

              <View style={styles.barsRow}>
                {analyticsData.map((item, index) => (
                  <AnimatedBar
                    key={item.month}
                    item={item}
                    index={index}
                    maxValue={maxValue}
                    isCurrent={index === currentMonthIndex && selectedYear === currentYear}
                    isSelected={selectedIndex === index}
                    onPress={() => setSelectedIndex(index)} // Now only selects, never unselects
                  />
                ))}
              </View>
            </View>
          </View>
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

  yearPillRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 8,
  },
  yearPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  yearPillActive: {
    backgroundColor: Colors.primaryGlow,
    borderColor: Colors.borderBright,
  },
  yearPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  yearPillTextActive: { color: Colors.primary },

  olderDropdown: {
    position: 'absolute',
    top: 36,
    right: 0,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 4,
    minWidth: 80,
    zIndex: 100, // ensure it floats over charts
  },
  olderDropdownItem: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  olderDropdownItemActive: {
    backgroundColor: Colors.primaryGlow,
  },
  olderDropdownText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
  },

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
  deviceIdText: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
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

  // Summary
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    gap: 10,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    alignItems: 'flex-start',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: 8,
  },
  summarySub: {
    fontSize: 11,
    color: Colors.primary,
    marginTop: 1,
  },
  summaryLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 3,
    letterSpacing: 0.3,
  },

  // Chart card
  chartCard: {
    marginHorizontal: 20,
    backgroundColor: Colors.bgCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, color: Colors.textSecondary, marginLeft: 4 },

  // Selected info
  selectedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
    flexWrap: 'wrap',
  },
  selectedMonth: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  selectedValue: { fontSize: 22, fontWeight: '800', color: Colors.primary },
  partialBadge: {
    backgroundColor: Colors.primaryGlow,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.borderBright,
  },
  partialBadgeText: { fontSize: 10, color: Colors.primary, fontWeight: '600' },

  // Chart layout
  chartArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 4,
  },
  yAxis: {
    width: 36,
    height: CHART_HEIGHT + 20,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: 6,
    paddingBottom: 20,
  },
  yLabel: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  barsContainer: {
    flex: 1,
    height: CHART_HEIGHT + 20,
    position: 'relative',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: CHART_HEIGHT,
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
  },

  // Bar
  barColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 2,
  },
  barTrack: { justifyContent: 'flex-end', width: '100%' },
  barFill: { borderRadius: 4, width: '100%' },
  barLabel: {
    marginTop: 6,
    fontSize: 9,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
