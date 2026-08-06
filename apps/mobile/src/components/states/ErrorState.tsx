import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../../theme/tokens';

interface ErrorStateProps {
  title?: string;
  message: string;
  actionLabel?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  actionLabel = 'Try again',
  onRetry,
}: ErrorStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>⚠️</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <View style={styles.actionContainer}>
          <Text style={styles.retryButton} onPress={onRetry}>
            {actionLabel}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[12],
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.red[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontSize: typography.fontSize.h3,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[900],
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  message: {
    fontSize: typography.fontSize.body,
    color: colors.gray[500],
    textAlign: 'center',
    lineHeight: typography.fontSize.body * typography.lineHeight.relaxed,
    marginBottom: spacing[6],
  },
  actionContainer: {
    marginTop: spacing[2],
  },
  retryButton: {
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
});
