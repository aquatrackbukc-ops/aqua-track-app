import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ref, onValue } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/theme';

export default function AdminDeviceSelector() {
  const { isAdmin, adminSelectedDeviceId, setAdminSelectedDeviceId } = useAuth();
  const [devices, setDevices] = useState<string[]>([]);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    const devicesRef = ref(db, 'AquaTrack');
    const unsubscribe = onValue(devicesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setDevices(Object.keys(data));
      } else {
        setDevices([]);
      }
    });

    return () => unsubscribe();
  }, [isAdmin]);

  if (!isAdmin) return null;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.selectorBtn} onPress={() => setModalVisible(true)}>
        <Ionicons name="shield-checkmark" size={16} color={Colors.primary} />
        <Text style={styles.selectorText}>
          {adminSelectedDeviceId ? `Viewing: ${adminSelectedDeviceId}` : 'Admin: Select Device'}
        </Text>
        <Ionicons name="chevron-down" size={16} color={Colors.textSecondary} />
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Device to View</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.deviceList}>
              <TouchableOpacity
                style={[styles.deviceOption, !adminSelectedDeviceId && styles.deviceOptionSelected]}
                onPress={() => {
                  setAdminSelectedDeviceId(null);
                  setModalVisible(false);
                }}
              >
                <Text style={[styles.deviceOptionText, !adminSelectedDeviceId && styles.deviceOptionTextSelected]}>
                  None (Clear Selection)
                </Text>
              </TouchableOpacity>

              {devices.map((id) => (
                <TouchableOpacity
                  key={id}
                  style={[styles.deviceOption, adminSelectedDeviceId === id && styles.deviceOptionSelected]}
                  onPress={() => {
                    setAdminSelectedDeviceId(id);
                    setModalVisible(false);
                  }}
                >
                  <Text style={[styles.deviceOptionText, adminSelectedDeviceId === id && styles.deviceOptionTextSelected]}>
                    {id}
                  </Text>
                  {adminSelectedDeviceId === id && (
                    <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 5,
    zIndex: 100,
  },
  selectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignSelf: 'flex-start',
    gap: 6,
  },
  selectorText: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: Colors.bgCard,
    borderRadius: 20,
    maxHeight: '70%',
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  closeBtn: {
    padding: 4,
  },
  deviceList: {
    maxHeight: 300,
  },
  deviceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
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
});
