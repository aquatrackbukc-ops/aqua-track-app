import { Colors } from '@/constants/theme';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { onValue, ref, update } from 'firebase/database';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

interface UserProfile {
  uid: string;
  name: string;
  email: string;
  device_id?: string;
  role: 'admin' | 'user';
}

export default function AdminScreen() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [devices, setDevices] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [newDeviceId, setNewDeviceId] = useState('');
  const [pricing, setPricing] = useState({ pricePerLiter: 0, currency: 'PKR' });
  const [editingPrice, setEditingPrice] = useState(false);
  const [tempPrice, setTempPrice] = useState('');
  const [systemStats, setSystemStats] = useState({ 
    totalLiters: 0, 
    activeDevices: 0, 
    totalUsers: 0,
    flowingDevices: 0 
  });
  const [rawDeviceData, setRawDeviceData] = useState<Record<string, any>>({});
  const [closingUser, setClosingUser] = useState<UserProfile | null>(null);
  const { setImpersonatedUser, impersonatedUser } = useAuth();

  useEffect(() => {
    let usersReady = false;
    let devicesReady = false;

    const checkReady = () => {
      if (usersReady && devicesReady) setLoading(false);
    };

    const usersRef = ref(db, 'users');
    const unsubscribeUsers = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const userList = Object.entries(data).map(([uid, profile]: [string, any]) => ({
          uid,
          ...profile,
        }));
        setUsers(userList);
        setSystemStats(prev => ({ ...prev, totalUsers: userList.length }));
      }
      usersReady = true;
      checkReady();
    });

    const devicesRef = ref(db, 'AquaTrack');
    const unsubscribeDevices = onValue(devicesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setRawDeviceData(data);
        setDevices(Object.keys(data));
        
        // Calculate system stats
        let totalL = 0;
        let flowing = 0;
        let active = 0;
        Object.values(data).forEach((device: any) => {
          totalL += device.TotalLiters || 0;
          if (device.WaterStatus === 'Connected' || device.FlowRate_LPM > 0) active++;
          if (device.FlowRate_LPM > 0) flowing++;
        });
        setSystemStats(prev => ({ 
          ...prev, 
          totalLiters: totalL, 
          activeDevices: active,
          flowingDevices: flowing 
        }));
      } else {
        setDevices([]);
        setRawDeviceData({});
        setSystemStats(prev => ({ ...prev, totalLiters: 0, activeDevices: 0, flowingDevices: 0 }));
      }
      devicesReady = true;
      checkReady();
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

    return () => {
      unsubscribeUsers();
      unsubscribeDevices();
      unsubscribePricing();
    };
  }, []);

  const handleUpdateDevice = async () => {
    if (!editingUser) return;
    
    try {
      await update(ref(db, `users/${editingUser.uid}`), {
        device_id: newDeviceId || null,
      });
      setEditingUser(null);
      setNewDeviceId('');
    } catch (error) {
      console.error('Error updating device_id:', error);
      alert('Failed to update device ID');
    }
  };

  const handleUpdatePrice = async () => {
    const priceNum = parseFloat(tempPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      alert('Please enter a valid positive number');
      return;
    }
    try {
      await update(ref(db, 'settings/pricing'), {
        pricePerLiter: priceNum,
      });
      setEditingPrice(false);
    } catch (error) {
      console.error('Error updating price:', error);
      alert('Failed to update price');
    }
  };

  const handleFinalizeMonth = async () => {
    if (!closingUser || !closingUser.device_id) return;
    const deviceId = closingUser.device_id;
    const deviceData = rawDeviceData[deviceId];
    
    if (!deviceData) {
      alert('Device data not found');
      return;
    }

    const now = new Date();
    const monthKey = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });
    const currentDay = now.getDate();
    
    const liters = deviceData.TotalLiters || 0;
    const cost = liters * pricing.pricePerLiter;

    const record = {
      monthName,
      totalLiters: liters,
      totalCost: cost,
      pricePerLiter: pricing.pricePerLiter,
      currency: pricing.currency,
      averageDailyLiters: liters / currentDay,
      highestUsageDay: now.toISOString().split('T')[0], // Use today as placeholder for highest
    };

    try {
      await update(ref(db, `history/${deviceId}`), {
        [monthKey]: record
      });
      alert(`Month finalized for ${monthName} at ${pricing.currency} ${pricing.pricePerLiter}/L`);
      setClosingUser(null);
    } catch (error) {
      console.error('Error finalizing month:', error);
      alert('Failed to finalize month');
    }
  };

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(search.toLowerCase()) || 
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.device_id?.toLowerCase().includes(search.toLowerCase())
  );

  const renderUserItem = ({ item }: { item: UserProfile }) => {
    const device = item.device_id ? rawDeviceData[item.device_id] : null;
    const isFlowing = device?.FlowRate_LPM > 0;
    const isOnline = device?.WaterStatus === 'Connected' || isFlowing;

    return (
      <View style={styles.userCard}>
        <View style={styles.userIconContainer}>
          <View style={[styles.statusDot, { backgroundColor: isOnline ? Colors.accent : Colors.danger }]} />
          <View style={styles.userIcon}>
            <Ionicons name="person" size={20} color={isOnline ? Colors.primary : Colors.textMuted} />
          </View>
        </View>
        
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.name || 'No Name'}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
          
          <View style={styles.userMetaRow}>
            <View style={styles.deviceBadge}>
              <Ionicons name="hardware-chip-outline" size={12} color={item.device_id ? Colors.primary : Colors.textMuted} />
              <Text style={[styles.deviceText, !item.device_id && { color: Colors.textMuted }]}>
                {item.device_id || 'unlinked'}
              </Text>
            </View>
            {device && (
              <View style={styles.usageBadge}>
                <Ionicons name="water-outline" size={12} color={Colors.accent} />
                <Text style={styles.usageBadgeText}>{device.TotalLiters?.toFixed(1)} L</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.cardActions}>
          {item.device_id && (
            <>
              <TouchableOpacity 
                style={styles.actionIconBtn}
                onPress={() => setClosingUser(item)}
              >
                <Ionicons name="receipt-outline" size={18} color={Colors.accent} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.actionIconBtn, 
                  impersonatedUser?.uid === item.uid && styles.actionIconBtnActive
                ]}
                onPress={() => {
                  if (impersonatedUser?.uid === item.uid) {
                    setImpersonatedUser(null);
                  } else {
                    setImpersonatedUser({
                      uid: item.uid,
                      name: item.name || 'User',
                      deviceId: item.device_id!
                    });
                  }
                }}
              >
                <Ionicons 
                  name={impersonatedUser?.uid === item.uid ? "eye-off-outline" : "eye-outline"} 
                  size={20} 
                  color={impersonatedUser?.uid === item.uid ? Colors.primary : Colors.textSecondary} 
                />
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity 
            style={styles.actionIconBtn}
            onPress={() => {
              setEditingUser(item);
              setNewDeviceId(item.device_id || '');
            }}
          >
            <Ionicons name="settings-outline" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <FlatList
        data={filteredUsers}
        renderItem={renderUserItem}
        keyExtractor={item => item.uid}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Admin Panel</Text>
              <Text style={styles.subtitle}>Full system control and analytics</Text>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Total Usage</Text>
                <Text style={styles.statValue}>{systemStats.totalLiters.toLocaleString()} L</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Active Devices</Text>
                <Text style={styles.statValue}>{systemStats.activeDevices} / {devices.length}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Total Users</Text>
                <Text style={styles.statValue}>{users.length}</Text>
              </View>
              <View style={[styles.statBox, systemStats.flowingDevices > 0 && { borderColor: Colors.accent }]}>
                <Text style={styles.statLabel}>Currently Flowing</Text>
                <Text style={[styles.statValue, systemStats.flowingDevices > 0 && { color: Colors.accent }]}>
                  {systemStats.flowingDevices}
                </Text>
              </View>
            </View>

            <View style={styles.settingsSection}>
              <View style={styles.settingsCard}>
                <View style={styles.settingsInfo}>
                  <View style={styles.settingsIcon}>
                    <Ionicons name="cash-outline" size={22} color={Colors.primary} />
                  </View>
                  <View>
                    <Text style={styles.settingsTitle}>Global Billing Rate</Text>
                    <Text style={styles.settingsSub}>
                      {pricing.currency} {pricing.pricePerLiter.toFixed(2)} / Litre
                    </Text>
                  </View>
                </View>
                <TouchableOpacity 
                  style={styles.settingsActionBtn}
                  onPress={() => {
                    setTempPrice(String(pricing.pricePerLiter));
                    setEditingPrice(true);
                  }}
                >
                  <Text style={styles.settingsActionText} >Update</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.listHeader}>
              <Text style={styles.listTitle}>User Directory</Text>
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={18} color={Colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search users or devices..."
                  placeholderTextColor={Colors.textMuted}
                  value={search}
                  onChangeText={setSearch}
                />
              </View>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No matching users found</Text>
          </View>
        }
      />

      {/* Edit Device Modal */}
      <Modal
        visible={!!editingUser}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Link Device</Text>
            <Text style={styles.modalSub}>Select a Device ID for {editingUser?.name}</Text>
            
            <View style={styles.deviceListContainer}>
              <ScrollView style={styles.deviceList} nestedScrollEnabled showsVerticalScrollIndicator={true}>
                <TouchableOpacity
                  style={[
                    styles.deviceOption,
                    newDeviceId === '' && styles.deviceOptionSelected,
                  ]}
                  onPress={() => setNewDeviceId('')}
                >
                  <Text
                    style={[
                      styles.deviceOptionText,
                      newDeviceId === '' && styles.deviceOptionTextSelected,
                    ]}
                  >
                    None (Unlink Device)
                  </Text>
                  {newDeviceId === '' && (
                    <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                  )}
                </TouchableOpacity>

                {devices.map((deviceId) => (
                  <TouchableOpacity
                    key={deviceId}
                    style={[
                      styles.deviceOption,
                      newDeviceId === deviceId && styles.deviceOptionSelected,
                    ]}
                    onPress={() => setNewDeviceId(deviceId)}
                  >
                    <Text
                      style={[
                        styles.deviceOptionText,
                        newDeviceId === deviceId && styles.deviceOptionTextSelected,
                      ]}
                    >
                      {deviceId}
                    </Text>
                    {newDeviceId === deviceId && (
                      <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.cancelBtn]} 
                onPress={() => setEditingUser(null)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.saveBtn]} 
                onPress={handleUpdateDevice}
              >
                <Text style={styles.saveBtnText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Price Modal */}
      <Modal
        visible={editingPrice}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Update Pricing</Text>
            <Text style={styles.modalSub}>Set the global price per litre ({pricing.currency})</Text>
            
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.modalInput}
                placeholder="Rate per litre"
                placeholderTextColor={Colors.textMuted}
                value={tempPrice}
                onChangeText={setTempPrice}
                keyboardType="decimal-pad"
                autoFocus
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.cancelBtn]} 
                onPress={() => setEditingPrice(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.saveBtn]} 
                onPress={handleUpdatePrice}
              >
                <Text style={styles.saveBtnText}>Apply Global Rate</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Finalize Month Modal */}
      <Modal
        visible={!!closingUser}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.closeHeader}>
              <Ionicons name="calendar-outline" size={32} color={Colors.accent} />
              <Text style={[styles.modalTitle, { marginTop: 12 }]}>Finalize Month</Text>
            </View>
            <Text style={styles.modalSub}>
              This will create a permanent snapshot for <Text style={{fontWeight: '700'}}>{closingUser?.name}</Text> using current meter data.
            </Text>
            
            <View style={styles.summaryBox}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Month</Text>
                <Text style={styles.summaryValue}>{new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Usage</Text>
                <Text style={styles.summaryValue}>{rawDeviceData[closingUser?.device_id || '']?.TotalLiters?.toFixed(1) || 0} L</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Current Rate</Text>
                <Text style={styles.summaryValue}>{pricing.currency} {pricing.pricePerLiter.toFixed(2)}/L</Text>
              </View>
              <View style={[styles.summaryRow, styles.summaryGrand]}>
                <Text style={styles.summaryLabelBold}>Bill Total</Text>
                <Text style={styles.summaryValueBold}>
                  {pricing.currency} {((rawDeviceData[closingUser?.device_id || '']?.TotalLiters || 0) * pricing.pricePerLiter).toFixed(2)}
                </Text>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.cancelBtn]} 
                onPress={() => setClosingUser(null)}
              >
                <Text style={styles.cancelBtnText}>Discard</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: Colors.accent }]} 
                onPress={handleFinalizeMonth}
              >
                <Text style={styles.saveBtnText}>Finalize & Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },

  // Redesigned Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },

  // Settings Section
  settingsSection: {
    marginHorizontal: 20,
    marginBottom: 32,
  },
  settingsCard: {
    backgroundColor: Colors.bgCardAlt,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingsIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Colors.primaryGlow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  settingsSub: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  settingsActionBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  settingsActionText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 12,
  },

  // List Styling
  listHeader: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    height: 48,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    marginLeft: 10,
    fontSize: 14,
  },
  listContent: {
    paddingBottom: 40,
  },

  // User Card 
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  userIconContainer: {
    position: 'relative',
  },
  statusDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: Colors.bgCard,
    zIndex: 1,
  },
  userIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.bgCardAlt,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  userInfo: {
    flex: 1,
    marginLeft: 14,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  userEmail: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  userMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  deviceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCardAlt,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  deviceText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '600',
  },
  usageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  usageBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.accent,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 4,
  },
  actionIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.bgCardAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionIconBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryGlow,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
    gap: 12,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 14,
  },

  // Modal Styling
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: Colors.bgCard,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  modalSub: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 6,
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: Colors.bgCardAlt,
    borderRadius: 12,
    height: 55,
    paddingHorizontal: 16,
    color: Colors.textPrimary,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 24,
  },
  inputContainer: {
    width: '100%',
  },
  deviceListContainer: {
    backgroundColor: Colors.bgCardAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    maxHeight: 200,
    marginBottom: 24,
    overflow: 'hidden',
  },
  deviceList: {
    paddingVertical: 4,
  },
  deviceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  deviceOptionSelected: {
    backgroundColor: 'rgba(0, 200, 255, 0.05)',
  },
  deviceOptionText: {
    fontSize: 16,
    color: Colors.textPrimary,
  },
  deviceOptionTextSelected: {
    fontWeight: '700',
    color: Colors.primary,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: Colors.bgCardAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
  },
  cancelBtnText: {
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  saveBtnText: {
    color: 'white',
    fontWeight: '700',
  },
  closeHeader: {
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryBox: {
    backgroundColor: Colors.bgCardAlt,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  summaryGrand: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginBottom: 0,
  },
  summaryLabelBold: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  summaryValueBold: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.accent,
  },
});
