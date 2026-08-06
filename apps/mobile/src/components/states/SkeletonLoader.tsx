import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { colors, borderRadius } from '../../theme/tokens';

interface SkeletonLineProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  marginBottom?: number;
}

function SkeletonLine({
  width = '100%',
  height = 14,
  borderRadius: br = borderRadius.sm,
  marginBottom = 12,
}: SkeletonLineProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.line,
        { width, height, borderRadius: br, marginBottom, opacity },
      ]}
    />
  );
}

interface SkeletonLoaderProps {
  lines?: number;
  lineHeight?: number;
  lastLineWidth?: number | `${number}%`;
  avatar?: boolean;
  style?: ViewStyle;
}

export function SkeletonLoader({
  lines = 3,
  lineHeight = 14,
  lastLineWidth = '60%',
  avatar = false,
  style,
}: SkeletonLoaderProps) {
  return (
    <View style={[styles.container, style]}>
      {avatar && <SkeletonLine width={48} height={48} borderRadius={24} />}
      <View style={avatar ? styles.linesWithAvatar : undefined}>
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonLine
            key={i}
            height={lineHeight}
            width={i === lines - 1 ? lastLineWidth : '100%'}
            marginBottom={i < lines - 1 ? 12 : 0}
          />
        ))}
      </View>
    </View>
  );
}

interface SkeletonCardProps {
  style?: ViewStyle;
}

export function SkeletonCard({ style }: SkeletonCardProps) {
  return (
    <View style={[styles.card, style]}>
      <SkeletonLine width="100%" height={120} borderRadius={borderRadius.xl} />
      <View style={styles.cardContent}>
        <SkeletonLine width="70%" height={18} />
        <SkeletonLine width="100%" height={14} />
        <SkeletonLine width="40%" height={14} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  line: {
    backgroundColor: colors.gray[200],
  },
  linesWithAvatar: {
    flex: 1,
    marginLeft: 12,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius['2xl'],
    padding: 16,
    marginBottom: 16,
  },
  cardContent: {
    marginTop: 12,
    gap: 8,
  },
});
