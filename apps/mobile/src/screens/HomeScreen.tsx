import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useAuth } from '../lib/auth-context';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/tokens';

export function HomeScreen({ navigation }: any) {
  const { user, logout } = useAuth();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello, {user?.fullName?.split(' ')[0] || 'there'} 👋</Text>
        <Text style={styles.subtitle}>Your pets are safe with PawTag</Text>
      </View>

      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('Pets')}
        >
          <Text style={styles.actionIcon}>🐾</Text>
          <Text style={styles.actionTitle}>My Pets</Text>
          <Text style={styles.actionDesc}>View and manage your pets</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('RedeemTag')}
        >
          <Text style={styles.actionIcon}>🏷️</Text>
          <Text style={styles.actionTitle}>Activate Tag</Text>
          <Text style={styles.actionDesc}>Scan QR or tap NFC to activate</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('QRScanner')}
        >
          <Text style={styles.actionIcon}>📷</Text>
          <Text style={styles.actionTitle}>Scan QR</Text>
          <Text style={styles.actionDesc}>Quick QR code scan</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('NFCScanner')}
        >
          <Text style={styles.actionIcon}>📡</Text>
          <Text style={styles.actionTitle}>NFC Tap</Text>
          <Text style={styles.actionDesc}>Tap an NFC tag</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  content: {
    padding: spacing[6],
    paddingBottom: spacing[12],
  },
  header: {
    marginBottom: spacing[6],
    marginTop: spacing[4],
  },
  greeting: {
    fontSize: typography.fontSize.h1,
    fontWeight: typography.fontWeight.bold,
    color: colors.gray[900],
    marginBottom: spacing[1],
  },
  subtitle: {
    fontSize: typography.fontSize.body,
    color: colors.gray[500],
  },
  quickActions: {
    gap: spacing[3],
    marginBottom: spacing[6],
  },
  actionCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius['2xl'],
    padding: spacing[5],
    ...shadows.subtle,
  },
  actionIcon: {
    fontSize: 32,
    marginBottom: spacing[2],
  },
  actionTitle: {
    fontSize: typography.fontSize.h3,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[900],
    marginBottom: spacing[1],
  },
  actionDesc: {
    fontSize: typography.fontSize.bodySm,
    color: colors.gray[500],
  },
  logoutButton: {
    backgroundColor: colors.red[50],
    borderRadius: borderRadius.xl,
    paddingVertical: spacing[3],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.red[200],
  },
  logoutText: {
    color: colors.red[600],
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.semibold,
  },
});
