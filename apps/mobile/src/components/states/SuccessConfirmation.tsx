import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../../theme/tokens';

interface SuccessConfirmationProps {
  icon?: string;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  celebratory?: boolean;
}

export function SuccessConfirmation({
  icon = '✓',
  title,
  message,
  actionLabel,
  onAction,
  celebratory = false,
}: SuccessConfirmationProps) {
  const scale = useRef(new Animated.Value(0.5)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 4,
        tension: 60,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scale, opacity]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.iconContainer,
          celebratory && styles.iconContainerCelebratory,
          { transform: [{ scale }], opacity },
        ]}
      >
        <Text style={[styles.icon, celebratory && styles.iconCelebratory]}>
          {icon}
        </Text>
      </Animated.View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction && (
        <View style={styles.actionContainer}>
          <Text style={styles.actionButton} onPress={onAction}>
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
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.green[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  iconContainerCelebratory: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.green[100],
  },
  icon: {
    fontSize: 48,
    color: colors.green[600],
    fontWeight: typography.fontWeight.bold,
  },
  iconCelebratory: {
    fontSize: 56,
  },
  title: {
    fontSize: typography.fontSize.h2,
    fontWeight: typography.fontWeight.bold,
    color: colors.gray[900],
    textAlign: 'center',
    marginBottom: spacing[3],
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
  actionButton: {
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
});
