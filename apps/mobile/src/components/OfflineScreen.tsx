import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../theme/tokens';

interface OfflineScreenProps {
  title?: string;
  message?: string;
}

export function OfflineScreen({
  title = 'PawTag is currently offline',
  message = 'Please come back later.',
}: OfflineScreenProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>🐾</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      <Text style={styles.footer}>PawTag — Reuniting lost pets with their families</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[50],
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[6],
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontSize: typography.fontSize.h2,
    fontWeight: typography.fontWeight.bold,
    color: colors.gray[900],
    textAlign: 'center',
    marginBottom: spacing[3],
  },
  message: {
    fontSize: typography.fontSize.bodyLg,
    fontWeight: typography.fontWeight.regular,
    color: colors.gray[600],
    textAlign: 'center',
    marginBottom: spacing[8],
    lineHeight: 24,
  },
  footer: {
    fontSize: typography.fontSize.bodySm,
    color: colors.gray[400],
    textAlign: 'center',
  },
});
