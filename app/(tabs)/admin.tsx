import { Colors } from '@/constants/theme';
import { db } from '@/lib/firebase';
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

  useEffect(() => {
    const usersRef = ref(db, 'users');
    const unsubscribeUsers = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const userList = Object.entries(data).map(([uid, profile]: [string, any]) => ({
          uid,
          ...profile,
        }));
        setUsers(userList);
      }
      setLoading(false);
    });

    const devicesRef = ref(db, 'AquaTrack');
    const unsubscribeDevices = onValue(devicesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setDevices(Object.keys(data));
      } else {
        setDevices([]);
      }
    });

    return () => {
      unsubscribeUsers();
      unsubscribeDevices();
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

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(search.toLowerCase()) || 
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.device_id?.toLowerCase().includes(search.toLowerCase())
  );

  const renderUserItem = ({ item }: { item: UserProfile }) => (
    <View style={styles.userCard}>
      <View style={styles.userIcon}>
        <Ionicons name="person" size={24} color={Colors.primary} />
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.name || 'No Name'}</Text>
        <Text style={styles.userEmail}>{item.email}</Text>
        <View style={styles.deviceBadge}>
          <Ionicons name="hardware-chip-outline" size={14} color={item.device_id ? Colors.accent : Colors.textMuted} />
          <Text style={[styles.deviceText, !item.device_id && { color: Colors.textMuted }]}>
            {item.device_id || 'No Device Linked'}
          </Text>
        </View>
      </View>
      <TouchableOpacity 
        style={styles.editButton}
        onPress={() => {
          setEditingUser(item);
          setNewDeviceId(item.device_id || '');
        }}
      >
        <Ionicons name="settings-outline" size={20} color={Colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>User Management</Text>
        <Text style={styles.subtitle}>Assign devices and manage accounts</Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search items..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filteredUsers}
        renderItem={renderUserItem}
        keyExtractor={item => item.uid}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No users found</Text>
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    marginHorizontal: 20,
    marginVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    height: 50,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    marginLeft: 10,
    fontSize: 16,
  },
  listContent: {
    padding: 20,
    paddingTop: 10,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  userIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primaryGlow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
    marginLeft: 16,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  userEmail: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  deviceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  deviceText: {
    fontSize: 12,
    color: Colors.accent,
    fontWeight: '600',
  },
  editButton: {
    padding: 8,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 40,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 16,
  },

  // Modal
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
});
