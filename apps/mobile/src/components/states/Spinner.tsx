import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, typography } from '../../theme/tokens';

interface SpinnerProps {
  size?: 'small' | 'large';
  color?: string;
  label?: string;
}

export function Spinner({
  size = 'small',
  color = colors.primary[600],
  label,
}: SpinnerProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={color} />
      {label && <Text style={[styles.label, { color }]}>{label}</Text>}
    </View>
  );
}

interface FullScreenSpinnerProps {
  label?: string;
}

export function FullScreenSpinner({ label = 'Loading...' }: FullScreenSpinnerProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [opacity]);

  return (
    <Animated.View style={[styles.fullScreen, { opacity }]}>
      <ActivityIndicator size="large" color={colors.primary[600]} />
      <Text style={styles.fullScreenLabel}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: {
    fontSize: typography.fontSize.bodySm,
    fontWeight: typography.fontWeight.medium,
  },
  fullScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
  },
  fullScreenLabel: {
    marginTop: 12,
    fontSize: typography.fontSize.body,
    color: colors.gray[500],
  },
});
