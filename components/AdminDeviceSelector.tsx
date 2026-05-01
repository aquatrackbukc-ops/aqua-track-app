import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Modal, 
  TextInput, 
  FlatList, 
  ActivityIndicator,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/theme';
import { db } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';

export default function AdminDeviceSelector() {
  const { isAdmin, impersonatedUser, setImpersonatedUser } = useAuth();
  const [modalVisible, setModalVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [devices, setDevices] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'meters'>('users');

  useEffect(() => {
    if (!modalVisible || !isAdmin) return;

    setLoading(true);
    // Fetch users
    const usersRef = ref(db, 'users');
    const unsubUsers = onValue(usersRef, (snap) => {
      const data = snap.val();
      if (data) {
        setUsers(Object.entries(data).map(([uid, profile]: [string, any]) => ({
          uid,
          ...profile
        })));
      }
    });

    // Fetch raw meters
    const devicesRef = ref(db, 'AquaTrack');
    const unsubDevices = onValue(devicesRef, (snap) => {
      const data = snap.val();
      if (data) {
        setDevices(Object.keys(data));
      }
      setLoading(false);
    });

    return () => {
      unsubUsers();
      unsubDevices();
    };
  }, [modalVisible, isAdmin]);

  if (!isAdmin) return null;

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(search.toLowerCase()) || 
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.device_id?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredDevices = devices.filter(d => 
    d.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelectUser = (user: any) => {
    if (!user.device_id) {
      alert("This user has no device assigned.");
      return;
    }
    setImpersonatedUser({
      uid: user.uid,
      name: user.name || 'User',
      deviceId: user.device_id
    });
    setModalVisible(false);
  };

  const handleSelectMeter = (deviceId: string) => {
    setImpersonatedUser({
      uid: 'raw',
      name: `Meter: ${deviceId}`,
      deviceId: deviceId
    });
    setModalVisible(false);
  };

  return (
    <>
      <TouchableOpacity 
        style={styles.floatingBtn}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="swap-horizontal" size={22} color="white" />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Switch View</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color={Colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search name, email, or meter ID..."
                placeholderTextColor={Colors.textMuted}
                value={search}
                onChangeText={setSearch}
              />
            </View>

            <View style={styles.tabBar}>
              <TouchableOpacity 
                style={[styles.tab, activeTab === 'users' && styles.tabActive]}
                onPress={() => setActiveTab('users')}
              >
                <Text style={[styles.tabText, activeTab === 'users' && styles.tabTextActive]}>Users</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tab, activeTab === 'meters' && styles.tabActive]}
                onPress={() => setActiveTab('meters')}
              >
                <Text style={[styles.tabText, activeTab === 'meters' && styles.tabTextActive]}>Raw Meters</Text>
              </TouchableOpacity>
            </View>

            {loading ? (
              <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} />
            ) : (
              <FlatList
                data={activeTab === 'users' ? filteredUsers : filteredDevices}
                keyExtractor={(item) => typeof item === 'string' ? item : item.uid}
                renderItem={({ item }) => (
                  activeTab === 'users' ? (
                    <TouchableOpacity 
                      style={styles.listItem}
                      onPress={() => handleSelectUser(item)}
                    >
                      <View style={styles.userIcon}>
                        <Ionicons name="person-outline" size={18} color={Colors.primary} />
                      </View>
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Text style={styles.itemSub}>{item.device_id || 'No Device'}</Text>
                      </View>
                      {impersonatedUser?.uid === item.uid && (
                        <Ionicons name="checkmark-circle" size={20} color={Colors.accent} />
                      )}
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity 
                      style={styles.listItem}
                      onPress={() => handleSelectMeter(item)}
                    >
                      <View style={styles.meterIcon}>
                        <Ionicons name="hardware-chip-outline" size={18} color={Colors.accent} />
                      </View>
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName}>{item}</Text>
                        <Text style={styles.itemSub}>Direct Access</Text>
                      </View>
                      {impersonatedUser?.deviceId === item && impersonatedUser?.uid === 'raw' && (
                        <Ionicons name="checkmark-circle" size={20} color={Colors.accent} />
                      )}
                    </TouchableOpacity>
                  )
                )}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No matches found</Text>
                }
              />
            )}

            {impersonatedUser && (
              <TouchableOpacity 
                style={styles.clearBtn}
                onPress={() => {
                  setImpersonatedUser(null);
                  setModalVisible(false);
                }}
              >
                <Text style={styles.clearBtnText}>Reset to Global View</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  floatingBtn: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    zIndex: 999,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    height: '80%',
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCardAlt,
    paddingHorizontal: 12,
    borderRadius: 12,
    height: 48,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    color: Colors.textPrimary,
    fontSize: 15,
  },
  tabBar: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: Colors.bgCardAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabActive: {
    backgroundColor: Colors.primaryGlow,
    borderColor: Colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.primary,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  userIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryGlow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  meterIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,255,179,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  itemSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: Colors.textMuted,
    fontSize: 14,
  },
  clearBtn: {
    marginTop: 20,
    backgroundColor: Colors.bgCardAlt,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.danger,
    alignItems: 'center',
  },
  clearBtnText: {
    color: Colors.danger,
    fontWeight: '700',
    fontSize: 14,
  },
});
