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
  Modal,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
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
  pricePerLiter?: number; // Historical rate
  currency?: string;    // Historical currency
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
  pricing,
  onGenerateBill,
}: {
  item: MonthlyRecord;
  index: number;
  currency: string;
  pricing: PricingSettings;
  onGenerateBill: () => void;
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
    outputRange: [0, 300], // Bumped to 300 to ensure button clearance
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
                label="Rate"
                value={`${item.pricePerLiter?.toFixed(2) || '—'} ${item.currency || pricing.currency}/L`}
                icon="cash-outline"
              />
              <DetailStat
                label="Total Cost"
                value={formatCost(item.totalCost, item.currency || pricing.currency)}
                icon="receipt-outline"
                valueColor={Colors.accent}
              />
              <DetailStat
                label="Peak Usage"
                value={formatLiters(item.totalLiters)}
                icon="trending-up-outline"
              />
            </View>

            {/* Generate Bill Button */}
            <TouchableOpacity
              style={styles.generateBillBtn}
              activeOpacity={0.8}
              onPress={onGenerateBill}>
              <Ionicons name="document-text-outline" size={16} color={Colors.primary} />
              <Text style={styles.generateBillText}>Generate Digital Bill</Text>
            </TouchableOpacity>
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


// ── PDF Helpers ─────────────────────────────────────────────────────────────
/**
 * Renders a minimalistic SVG bar chart for the last 12 months of usage.
 */
function renderUsageChart(allRecords: MonthlyRecord[], currentMonthKey: string) {
  // Get last 12 months in chronological order
  const sorted = [...allRecords].sort((a, b) => a.key.localeCompare(b.key));
  const latestIndex = sorted.findIndex(r => r.key === currentMonthKey);
  const chartData = latestIndex !== -1 
    ? sorted.slice(Math.max(0, latestIndex - 11), latestIndex + 1)
    : sorted.slice(-12);
  
  const width = 600;
  const height = 140;
  const padding = 20;
  const maxL = Math.max(...chartData.map(d => d.totalLiters), 10);
  const barW = (width - padding * 2) / 12 - 6;
  
  let barsHtml = '';
  chartData.forEach((d, i) => {
    const barH = (d.totalLiters / maxL) * (height - padding * 2);
    const x = padding + i * (barW + 6);
    const y = height - padding - barH;
    const isActive = d.key === currentMonthKey;
    
    barsHtml += `
      <rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="${isActive ? '#00ffb3' : '#e2e8f0'}" rx="3" />
      <text x="${x + barW / 2}" y="${height - 5}" font-size="8" text-anchor="middle" fill="#94a3b8">${d.key.split('-')[1]}</text>
    `;
  });

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#f1f5f9" stroke-width="1" />
      ${barsHtml}
    </svg>
  `;
}


// ── Main Screen ────────────────────────────────────────────────────────────
export default function HistoryScreen() {
  const { profile, loading: authLoading, activeDeviceId, impersonatedUser, setImpersonatedUser, isAdmin } = useAuth();
  const [historyData, setHistoryData] = useState<MonthlyRecord[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<MonthlyRecord | null>(null);
  const [pricing, setPricing] = useState<PricingSettings>({ pricePerLiter: 0.05, currency: 'PKR' });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(new Date().getFullYear().toString());
  const [showYearPicker, setShowYearPicker] = useState(false);
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
        const records: MonthlyRecord[] = Object.entries(val).map(([key, data]: [string, any]) => {
          const liters = data.totalLiters ?? 0;
          const cost = data.totalCost ?? 0;
          
          // Intelligent fallback: if pricePerLiter is missing, calculate it from cost/liters
          let rate = data.pricePerLiter;
          if (rate === undefined && liters > 0) {
            rate = cost / liters;
          }

          return {
            key,
            monthName: data.monthName ?? key,
            totalLiters: liters,
            totalCost: cost,
            highestUsageDay: data.highestUsageDay ?? '—',
            averageDailyLiters: data.averageDailyLiters ?? 0,
            pricePerLiter: rate,
            currency: data.currency,
          };
        });

        // Sort descending (newest first) — "2024-03" > "2023-11" sorts naturally
        records.sort((a, b) => b.key.localeCompare(a.key));
        setHistoryData(records);
      } else {
        setHistoryData([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeDeviceId, authLoading, isAdmin]);

  if (authLoading || loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const availableYears = [...new Set(historyData.map(d => d.key.split('-')[0]))].sort((a, b) => b.localeCompare(a));

  const filtered =
    filter === 'All'
      ? historyData
      : historyData.filter(d => d.key.startsWith(filter));

  const exportPDF = async (record: MonthlyRecord, mode: 'download' | 'share' = 'download') => {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 15);
    const formattedDueDate = dueDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    
    const usageChartSvg = renderUsageChart(historyData, record.key);

    const html = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>
            * { box-sizing: border-box; }
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 30px; color: #1e293b; line-height: 1.4; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 4px solid #00ffb3; padding-bottom: 20px; margin-bottom: 30px; }
            .brand-section h1 { margin: 0; color: #00ffb3; font-size: 32px; font-weight: 900; letter-spacing: -2px; }
            .brand-section p { margin: 2px 0; color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; }
            .consumer-info { text-align: right; }
            .consumer-info h2 { margin: 0; font-size: 15px; font-weight: 800; color: #0f172a; }
            .consumer-info p { margin: 1px 0; font-size: 12px; color: #64748b; }
            
            .summary-deck { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 30px; }
            .summary-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; text-align: center; }
            .box-label { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
            .box-value { font-size: 12px; font-weight: 800; color: #0f172a; }
            .box-value.highlight { color: #00ffb3; font-size: 18px; }
            
            .chart-box { margin-bottom: 30px; border: 1px solid #f1f5f9; border-radius: 16px; padding: 15px; }
            .section-label { font-size: 11px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 12px; display: flex; align-items: center; }
            .section-label::before { content: ''; width: 4px; height: 14px; background: #00ffb3; margin-right: 8px; border-radius: 2px; }
            
            .details-table { width: 100%; border-collapse: collapse; margin-bottom: 35px; }
            .details-table th { text-align: left; padding: 10px; background: #f8fafc; font-size: 10px; text-transform: uppercase; color: #64748b; }
            .details-table td { padding: 12px 10px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
            
            .footer-grid { display: flex; justify-content: space-between; align-items: flex-end; padding-top: 25px; border-top: 1px solid #f1f5f9; }
            .notes p { margin: 2px 0; font-size: 11px; color: #64748b; }
            .qr-code { width: 70px; height: 70px; border: 1px solid #e2e8f0; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 7px; color: #94a3b8; text-align: center; }
            
            .total-ribbon { background: #0f172a; color: white; padding: 20px; border-radius: 14px; display: flex; justify-content: space-between; align-items: center; }
            .total-label { font-size: 13px; font-weight: 700; color: #94a3b8; }
            .total-val { font-size: 28px; font-weight: 900; color: #00ffb3; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="brand-section">
              <h1>AQUATRACK</h1>
              <p>Sustainable Metering</p>
            </div>
            <div class="consumer-info">
              <h2>Consumer: ${impersonatedUser?.name || profile?.name || 'Valued Customer'}</h2>
              <p>Device ID: ${activeDeviceId}</p>
              <p>Reference: #QT-${record.key.replace('-', '')}</p>
            </div>
          </div>

          <div class="summary-deck">
            <div class="summary-box">
              <div class="box-label">Amount Due</div>
              <div class="box-value highlight">${record.currency || pricing.currency} ${record.totalCost.toFixed(0)}</div>
            </div>
            <div class="summary-box">
              <div class="box-label">Units Used</div>
              <div class="box-value">${record.totalLiters.toFixed(2)} L</div>
            </div>
            <div class="summary-box">
              <div class="box-label">Previous Balance</div>
              <div class="box-value">${record.currency || pricing.currency} 0.00</div>
            </div>
            <div class="summary-box">
              <div class="box-label">Due Date</div>
              <div style="color: #f43f5e;" class="box-value">${formattedDueDate}</div>
            </div>
          </div>

          <div class="chart-box">
            <div class="section-label">12-Month Usage Trend</div>
            <div style="text-align: center;">
              ${usageChartSvg}
            </div>
          </div>

          <div class="section-label">Bill Breakdown</div>
          <table class="details-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Quantity</th>
                <th>Rate</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="font-weight: 700;">Water Consumption</td>
                <td>${record.totalLiters.toFixed(2)} L</td>
                <td>${record.pricePerLiter?.toFixed(2) || pricing.pricePerLiter.toFixed(2)} /L</td>
                <td style="font-weight: 800;">${record.currency || pricing.currency} ${record.totalCost.toFixed(2)}</td>
              </tr>
              <tr>
                <td>Fixed Service Charge</td>
                <td>1 Month</td>
                <td>0.00</td>
                <td>0.00</td>
              </tr>
              <tr>
                <td>Applicable Taxes</td>
                <td>0%</td>
                <td>0.00</td>
                <td>0.00</td>
              </tr>
            </tbody>
          </table>

          <div class="total-ribbon">
            <div class="total-label">TOTAL PAYABLE AMOUNT</div>
            <div class="total-val">${record.currency || pricing.currency} ${record.totalCost.toFixed(2)}</div>
          </div>

          <div class="footer-grid">
            <div class="notes">
              <p style="font-weight: 800; color: #0f172a; margin-bottom: 5px;">Billing Notes:</p>
              <p>• Payments made after the due date may incur late fees.</p>
              <p>• Save water, save future. Monitor leaks via the dashboard.</p>
              <p>• For queries, reach us at support@aquatrack.com</p>
              <p style="margin-top: 12px; font-size: 9px; color: #cbd5e1;">Generated on ${new Date().toLocaleString()}</p>
            </div>
            <div class="qr-code">
              VERIFIED<br/>DIGITAL<br/>BILL
            </div>
          </div>
        </body>
      </html>
    `;

    try {
      if (Platform.OS === 'web') {
        const { uri } = await Print.printToFileAsync({ html });
        const link = document.createElement('a');
        link.href = uri;
        link.download = `AquaTrack_Invoice_${record.key}.pdf`;
        link.click();
      } else if (mode === 'share') {
        const { uri } = await Print.printToFileAsync({ html });
        await Sharing.shareAsync(uri, { 
          UTI: '.pdf', 
          mimeType: 'application/pdf',
          dialogTitle: `AquaTrack Invoice - ${record.monthName}` 
        });
      } else {
        await Print.printAsync({ html });
      }
    } catch (error) {
      console.error('PDF Error:', error);
    }
  };

  const currentYear = new Date().getFullYear().toString();

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />

      {/* Year Selection Modal */}
      <Modal
        visible={showYearPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowYearPicker(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowYearPicker(false)}
        >
          <View style={styles.yearModalContent}>
            <Text style={styles.yearModalTitle}>Filter by Year</Text>
            <View style={styles.yearGridScrollContainer}>
              <ScrollView 
                style={styles.yearGridScroll}
                contentContainerStyle={styles.yearGrid}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled
              >
                {/* "All" Option */}
                <TouchableOpacity
                  style={[
                    styles.yearGridItem,
                    filter === 'All' && styles.yearGridItemActive,
                    { width: '92%' }
                  ]}
                  onPress={() => {
                    setFilter('All');
                    setShowYearPicker(false);
                  }}
                >
                  <Text style={[
                    styles.yearGridText,
                    filter === 'All' && styles.yearGridTextActive
                  ]}>
                    All-Time History
                  </Text>
                </TouchableOpacity>

                {availableYears.map(y => (
                  <TouchableOpacity
                    key={y}
                    style={[
                      styles.yearGridItem,
                      filter === y && styles.yearGridItemActive
                    ]}
                    onPress={() => {
                      setFilter(y);
                      setShowYearPicker(false);
                    }}
                  >
                    <Text style={[
                      styles.yearGridText,
                      filter === y && styles.yearGridTextActive
                    ]}>
                      {y}
                    </Text>
                    {y === currentYear && <View style={styles.currentYearDot} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <TouchableOpacity 
              style={styles.modalCloseBtn}
              onPress={() => setShowYearPicker(false)}
            >
              <Text style={styles.modalCloseBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
          <TouchableOpacity 
            activeOpacity={0.7}
            onPress={() => setShowYearPicker(true)}
            style={{ paddingHorizontal: 20, paddingTop: 10 }}
          >
            <View style={styles.screenLabelRow}>
              <Text style={styles.screenLabel}>Records</Text>
              <Ionicons name="chevron-down" size={12} color={Colors.textMuted} />
            </View>
            <View style={styles.titleWithIcon}>
              <Text style={styles.screenTitle}>
                {filter === 'All' ? 'Usage History' : `${filter} History`}
              </Text>
              <View style={styles.yearIndicator}>
                <Ionicons name="filter-outline" size={14} color={Colors.primary} />
              </View>
            </View>
            <View style={styles.headerSubRow}>
              {impersonatedUser ? (
                <TouchableOpacity 
                  style={styles.impersonationBadge}
                  onPress={() => setImpersonatedUser(null)}
                >
                  <Ionicons name="eye-outline" size={14} color={Colors.accent} />
                  <Text style={styles.impersonationText}>
                    {impersonatedUser.uid === 'raw' ? `Meter: ${impersonatedUser.deviceId}` : `Viewing: ${impersonatedUser.name}`}
                  </Text>
                  <Ionicons name="close-circle" size={14} color={Colors.textMuted} style={{marginLeft: 4}} />
                </TouchableOpacity>
              ) : (
                <View style={styles.deviceRow}>
                  <Ionicons name="hardware-chip-outline" size={12} color={Colors.textMuted} />
                  <Text style={styles.deviceIdText}>{activeDeviceId || (isAdmin ? 'Global Mode' : 'No Device')}</Text>
                  <View style={styles.currencyBadge}>
                    <Text style={styles.currencyBadgeText}>{pricing.currency}</Text>
                  </View>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Main Content */}
        {!activeDeviceId && isAdmin ? (
          <View style={{ padding: 40, alignItems: 'center', marginTop: 100 }}>
             <Ionicons name="library-outline" size={80} color={Colors.primary} />
             <Text style={styles.emptyTitle}>Records Portal</Text>
             <Text style={styles.emptySub}>
               Select a user or a specific meter from the search switcher to view historical invoices and billing records.
             </Text>
          </View>
        ) : !activeDeviceId ? (
          <View style={styles.emptyState}>
            <Ionicons name="shield-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Device access pending. Please contact admin.</Text>
          </View>
        ) : (
          <>
            {/* Summary */}
            <SummaryBanner data={historyData} currency={pricing.currency} />

            <View style={styles.cardList}>
              {filtered.map((item, i) => (
                <HistoryCard
                  key={item.key}
                  item={item}
                  index={i}
                  currency={pricing.currency}
                  pricing={pricing}
                  onGenerateBill={() => setSelectedInvoice(item)}
                />
              ))}
              {filtered.length === 0 && (
                <View style={styles.emptyState}>
                  <Ionicons name="calendar-outline" size={48} color={Colors.textMuted} />
                  <Text style={styles.emptyText}>No records found for {filter}</Text>
                </View>
              )}
            </View>
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <AdminDeviceSelector />

      {/* Invoice Modal */}
      <Modal
        visible={selectedInvoice !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedInvoice(null)}>
        <View style={styles.invoiceOverlay}>
          <View style={styles.invoiceContainer}>
            {/* Header */}
            <View style={styles.invoiceHeader}>
              <View>
                <Text style={styles.invoiceTitle}>Monthly Invoice</Text>
                <Text style={styles.invoiceSub}>AquaTrack Inc.</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedInvoice(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            {selectedInvoice && (
              <ScrollView 
                style={styles.invoiceBody} 
                contentContainerStyle={{ paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
              >
                {/* Brand Header */}
                <View style={styles.invoiceMetaHeader}>
                  <View>
                    <Text style={[styles.invoiceLabel, { marginBottom: 0 }]}>Consumer Details</Text>
                    <Text style={styles.invoiceConsumerName}>{impersonatedUser?.name || profile?.name || 'Valued Customer'}</Text>
                    <Text style={styles.invoiceDescriptor}>Device: ${activeDeviceId}</Text>
                  </View>
                  <View style={styles.invoiceRefBox}>
                    <Text style={styles.invoiceRefLabel}>REFERENCE</Text>
                    <Text style={styles.invoiceRefVal}>#AT-${selectedInvoice.key.replace('-', '')}</Text>
                  </View>
                </View>

                {/* Summary Cards */}
                <View style={styles.modalSummaryGrid}>
                  <View style={styles.modalSummaryBox}>
                    <Text style={styles.mBoxLabel}>Usage</Text>
                    <Text style={styles.mBoxValue}>{selectedInvoice.totalLiters.toFixed(0)} L</Text>
                  </View>
                  <View style={styles.modalSummaryBox}>
                    <Text style={styles.mBoxLabel}>Rate</Text>
                    <Text style={styles.mBoxValue}>{selectedInvoice.pricePerLiter?.toFixed(2) || pricing.pricePerLiter.toFixed(2)}</Text>
                  </View>
                  <View style={[styles.modalSummaryBox, { backgroundColor: Colors.primaryGlow, borderColor: Colors.primary }]}>
                    <Text style={[styles.mBoxLabel, { color: Colors.primary }]}>Payable</Text>
                    <Text style={[styles.mBoxValue, { color: Colors.primary }]}>{selectedInvoice.currency || pricing.currency}</Text>
                  </View>
                </View>

                <View style={styles.invoiceDivider} />

                {/* mini chart in modal */}
                <View style={styles.modalChartContainer}>
                  <Text style={styles.modalSectionTitle}>12-Month Usage Trend</Text>
                  <View style={styles.modalUsageStats}>
                     {/* We can't render the SVG string directly in RN easily without a WebView, 
                         but I can show a representative summary or wait for PDF. 
                         Actually, let's just keep the text breakdown detailed here. */}
                     <View style={styles.historyHighlight}>
                        <Ionicons name="trending-up" size={16} color={Colors.accent} />
                        <Text style={styles.historyHighlightText}>
                          Consumption is ${selectedInvoice.totalLiters > (historyData[1]?.totalLiters || 0) ? 'up' : 'down'} from last month
                        </Text>
                     </View>
                  </View>
                </View>

                <View style={styles.invoiceSection}>
                  <View style={styles.billRow}>
                    <Text style={styles.billKey}>Water Consumption</Text>
                    <Text style={styles.billVal}>{selectedInvoice.currency || pricing.currency} {selectedInvoice.totalCost.toFixed(2)}</Text>
                  </View>
                  <View style={styles.billRow}>
                    <Text style={styles.billKey}>Fixed Service Fee</Text>
                    <Text style={styles.billVal}>{selectedInvoice.currency || pricing.currency} 0.00</Text>
                  </View>
                  <View style={styles.billRow}>
                    <Text style={styles.billKey}>Taxes (0%)</Text>
                    <Text style={styles.billVal}>{selectedInvoice.currency || pricing.currency} 0.00</Text>
                  </View>
                </View>

                <View style={styles.invoiceDivider} />

                <View style={styles.grandTotalContainer}>
                  <Text style={styles.grandTotalLabel}>TOTAL AMOUNT DUE</Text>
                  <Text style={styles.grandTotalValue}>
                    {selectedInvoice.currency || pricing.currency} {selectedInvoice.totalCost.toFixed(2)}
                  </Text>
                </View>

                <View style={styles.dueDateBadge}>
                  <Ionicons name="time-outline" size={14} color="#f43f5e" />
                  <Text style={styles.dueDateText}>Due by: ${new Date(Date.now() + 15 * 86400000).toLocaleDateString()}</Text>
                </View>
              </ScrollView>
            )}

            <View style={styles.invoiceFooter}>
              <View style={styles.dualActionRow}>
                <TouchableOpacity 
                  style={styles.printBtn} 
                  onPress={() => selectedInvoice && exportPDF(selectedInvoice, 'download')}
                >
                  <Ionicons name="cloud-download-outline" size={18} color="#fff" />
                  <Text style={styles.printBtnText}>Download</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.shareBtn} 
                  onPress={() => selectedInvoice && exportPDF(selectedInvoice, 'share')}
                >
                  <Ionicons name="share-social-outline" size={18} color={Colors.primary} />
                  <Text style={styles.shareBtnText}>Share</Text>
                </TouchableOpacity>
              </View>
              
              <TouchableOpacity 
                style={styles.closeInvoiceBtn} 
                onPress={() => setSelectedInvoice(null)}
              >
                <Text style={styles.closeInvoiceBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 40,
    marginTop: 10,
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 40,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
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

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  yearModalContent: {
    width: '100%',
    backgroundColor: Colors.bgCard,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  yearModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 20,
    textAlign: 'center',
  },
  yearGridScrollContainer: {
    maxHeight: 320,
    width: '100%',
  },
  yearGridScroll: {
    width: '100%',
  },
  yearGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    paddingVertical: 4,
  },
  yearGridItem: {
    width: '45%',
    backgroundColor: Colors.bgCardAlt,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  yearGridItemActive: {
    backgroundColor: Colors.primaryGlow,
    borderColor: Colors.primary,
  },
  yearGridText: {
    fontSize: 16, // slightly smaller for longer text like "Show All"
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  yearGridTextActive: {
    color: Colors.primary,
  },
  currentYearDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
  },
  modalCloseBtn: {
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.bgCardAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  modalCloseBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  screenLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  yearIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.primaryGlow,
  },

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
  expandedContent: { paddingTop: 4, paddingBottom: 16 },
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

  generateBillBtn: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: Colors.primaryGlow,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.borderBright,
  },
  generateBillText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },

  // Invoice Modal
  invoiceOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    padding: 16,
  },
  invoiceContainer: {
    backgroundColor: Colors.bg,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    maxHeight: '90%',
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    backgroundColor: Colors.bgCard,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  invoiceTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  invoiceSub: {
    fontSize: 12,
    color: Colors.accent,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  closeBtn: {
    backgroundColor: Colors.bgCardAlt,
    padding: 8,
    borderRadius: 12,
  },
  invoiceBody: {
    padding: 24,
  },
  invoiceMetaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  invoiceConsumerName: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: 2,
  },
  invoiceDescriptor: {
    fontSize: 12,
    color: Colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
  invoiceRefBox: {
    alignItems: 'flex-end',
  },
  invoiceRefLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textMuted,
  },
  invoiceRefVal: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  modalSummaryGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  modalSummaryBox: {
    flex: 1,
    backgroundColor: Colors.bgCardAlt,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  mBoxLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 4,
  },
  mBoxValue: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  modalChartContainer: {
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  historyHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,180,255,0.05)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,180,255,0.1)',
  },
  historyHighlightText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  billKey: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  billVal: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  grandTotalContainer: {
    backgroundColor: Colors.primaryGlow,
    padding: 20,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  grandTotalLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primary,
  },
  grandTotalValue: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.primary,
  },
  dueDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 20,
  },
  dueDateText: {
    fontSize: 12,
    color: '#f43f5e',
    fontWeight: '700',
  },
  invoiceFooter: {
    padding: 24,
    backgroundColor: Colors.bgCard,
    borderTopWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  printBtn: {
    flex: 1.2,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  printBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  shareBtn: {
    flex: 1,
    backgroundColor: Colors.bgCardAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textSecondary,
  },
  dualActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  closeInvoiceBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeInvoiceBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  headerSubRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
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
  modalUsageStats: {
    gap: 8,
  },
  invoiceSection: {
    marginBottom: 20,
  },
  invoiceDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 20,
  },
  invoiceLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
});
