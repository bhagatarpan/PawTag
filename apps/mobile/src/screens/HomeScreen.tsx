import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useAuth } from '../lib/auth-context';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/tokens';

export function HomeScreen() {
  const { user, logout } = useAuth();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello, {user?.fullName?.split(' ')[0] || 'there'} 👋</Text>
        <Text style={styles.subtitle}>Your pets are safe with PawTag</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Getting Started</Text>
        <Text style={styles.cardDescription}>
          This is your PawTag home screen. More features coming in the next phases:
        </Text>
        <View style={styles.featureList}>
          <Text style={styles.featureItem}>• Pet management & profiles</Text>
          <Text style={styles.featureItem}>• QR & NFC tag activation</Text>
          <Text style={styles.featureItem}>• Push notifications</Text>
          <Text style={styles.featureItem}>• Lost mode</Text>
          <Text style={styles.featureItem}>• Order history</Text>
        </View>
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
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius['2xl'],
    padding: spacing[6],
    marginBottom: spacing[6],
    ...shadows.subtle,
  },
  cardTitle: {
    fontSize: typography.fontSize.h3,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[900],
    marginBottom: spacing[2],
  },
  cardDescription: {
    fontSize: typography.fontSize.body,
    color: colors.gray[500],
    lineHeight: 24,
    marginBottom: spacing[4],
  },
  featureList: {
    gap: spacing[2],
  },
  featureItem: {
    fontSize: typography.fontSize.body,
    color: colors.gray[700],
    lineHeight: 24,
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
