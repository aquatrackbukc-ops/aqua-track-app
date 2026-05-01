import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/theme';

export default function AdminImpersonationBanner() {
  const { isAdmin, impersonatedUser, setImpersonatedUser } = useAuth();

  if (!isAdmin || !impersonatedUser) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.infoRow}>
            <View style={styles.iconContainer}>
              <Ionicons name="eye" size={16} color="white" />
            </View>
            <Text style={styles.label}>ADMIN VIEWING:</Text>
            <Text style={styles.idText}>{impersonatedUser.name}</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.exitBtn}
            onPress={() => setImpersonatedUser(null)}
            activeOpacity={0.7}
          >
            <Text style={styles.exitText}>EXIT</Text>
            <Ionicons name="close-circle" size={16} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: Colors.primary,
    zIndex: 9999,
  },
  container: {
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    ...Platform.select({
      android: {
        paddingTop: 35, // Adjust for status bar on Android if needed
      },
      ios: {
        paddingTop: 0,
      }
    }),
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 4,
    borderRadius: 6,
  },
  label: {
    color: 'white',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  idText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  exitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  exitText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '800',
  },
});
