import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import api from '../../api/client';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/tokens';
import { ErrorState } from '../../components/states/ErrorState';
import { hapticLight } from '../../lib/haptics';

interface GuardianData {
  tier: string;
  points: number;
  pointsToNextTier: number | null;
  nextTier: string | null;
  pawRewardsBalance: number;
  isGoldMember: boolean;
}

const TIER_CONFIG: Record<string, { color: string; icon: string; benefits: string[] }> = {
  CARE: { color: colors.emerald[500], icon: '🌿', benefits: ['1x points', '$2/mo PawRewards', 'Free shipping over $100'] },
  NURTURE: { color: colors.teal[500], icon: '💚', benefits: ['1x points', '$3/mo PawRewards', 'Free shipping over $75'] },
  PROTECTOR: { color: colors.violet[500], icon: '🛡️', benefits: ['1x points', '$5/mo PawRewards', 'Free shipping over $50'] },
  SAFEGUARD: { color: colors.amber[500], icon: '👑', benefits: ['2x points', '$8/mo PawRewards', 'Free shipping', 'Gold benefits'] },
};

export function GuardianDashboardScreen({ navigation }: any) {
  const [data, setData] = useState<GuardianData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [tierRes, pointsRes, rewardsRes] = await Promise.all([
        api.get('/customer/guardian/tier'),
        api.get('/customer/guardian/points'),
        api.get('/customer/guardian/rewards'),
      ]);

      const tierData = tierRes.data.data;
      const pointsData = pointsRes.data.data;
      const rewardsData = rewardsRes.data.data;

      setData({
        tier: tierData.tier || 'CARE',
        points: pointsData.balance || 0,
        pointsToNextTier: tierData.pointsToNextTier || null,
        nextTier: tierData.nextTier || null,
        pawRewardsBalance: rewardsData.balance || 0,
        isGoldMember: tierData.isGoldMember || false,
      });
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load Guardian data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const tierConfig = data ? TIER_CONFIG[data.tier] || TIER_CONFIG.CARE : TIER_CONFIG.CARE;
  const progress = data?.pointsToNextTier && data.pointsToNextTier > 0
    ? Math.min(100, ((data.points - (data.tier === 'CARE' ? 0 : data.tier === 'NURTURE' ? 500 : data.tier === 'PROTECTOR' ? 2000 : 5000)) / data.pointsToNextTier) * 100)
    : 100;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
      </View>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchData} />;
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Guardian Dashboard</Text>
        <Text style={styles.subtitle}>Your loyalty journey and rewards</Text>
      </View>

      {/* Tier Card */}
      <View style={[styles.tierCard, { backgroundColor: tierConfig.color + '10' }]}>
        <View style={styles.tierHeader}>
          <Text style={styles.tierIcon}>{tierConfig.icon}</Text>
          <View>
            <Text style={[styles.tierName, { color: tierConfig.color }]}>{data?.tier} Tier</Text>
            {data?.isGoldMember && (
              <Text style={styles.goldBadge}>Gold Member</Text>
            )}
          </View>
        </View>

        {/* Points */}
        <View style={styles.pointsContainer}>
          <Text style={styles.pointsValue}>{data?.points || 0}</Text>
          <Text style={styles.pointsLabel}>Guardian Points</Text>
        </View>

        {/* Progress to Next Tier */}
        {data?.nextTier && data.pointsToNextTier && data.pointsToNextTier > 0 ? (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {data.pointsToNextTier} points to {data.nextTier}
            </Text>
          </View>
        ) : (
          <Text style={styles.maxTierText}>You've reached the highest tier!</Text>
        )}
      </View>

      {/* PawRewards Balance */}
      <View style={styles.rewardsCard}>
        <Text style={styles.rewardsLabel}>PawRewards Balance</Text>
        <Text style={styles.rewardsValue}>${(data?.pawRewardsBalance || 0).toFixed(2)}</Text>
        <Text style={styles.rewardsSubtext}>Redeem on your next purchase</Text>
      </View>

      {/* Current Benefits */}
      <View style={styles.benefitsCard}>
        <Text style={styles.benefitsTitle}>Your Benefits</Text>
        {tierConfig.benefits.map((benefit, index) => (
          <View key={index} style={styles.benefitItem}>
            <Text style={styles.benefitIcon}>✓</Text>
            <Text style={styles.benefitText}>{benefit}</Text>
          </View>
        ))}
      </View>

      {/* Quick Actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            hapticLight();
            navigation.navigate('GuardianPoints');
          }}
        >
          <Text style={styles.actionButtonText}>View Points History</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            hapticLight();
            navigation.navigate('GuardianRewards');
          }}
        >
          <Text style={styles.actionButtonText}>Manage PawRewards</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
  },
  header: {
    padding: spacing[4],
    paddingBottom: spacing[2],
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.gray[900],
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[500],
    marginTop: spacing[1],
  },
  tierCard: {
    margin: spacing[4],
    padding: spacing[5],
    borderRadius: borderRadius.xl,
    ...shadows.md,
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  tierIcon: {
    fontSize: 32,
  },
  tierName: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  goldBadge: {
    fontSize: typography.fontSize.xs,
    color: colors.amber[600],
    fontWeight: typography.fontWeight.medium,
  },
  pointsContainer: {
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  pointsValue: {
    fontSize: 48,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
  },
  pointsLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[600],
  },
  progressContainer: {
    marginTop: spacing[2],
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.gray[200],
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.full,
  },
  progressText: {
    fontSize: typography.fontSize.xs,
    color: colors.gray[600],
    textAlign: 'center',
    marginTop: spacing[2],
  },
  maxTierText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
    textAlign: 'center',
  },
  rewardsCard: {
    margin: spacing[4],
    marginTop: 0,
    padding: spacing[5],
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.gray[100],
    ...shadows.sm,
  },
  rewardsLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[500],
  },
  rewardsValue: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.amber[600],
    marginTop: spacing[1],
  },
  rewardsSubtext: {
    fontSize: typography.fontSize.xs,
    color: colors.gray[400],
    marginTop: spacing[1],
  },
  benefitsCard: {
    margin: spacing[4],
    marginTop: 0,
    padding: spacing[5],
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.gray[100],
    ...shadows.sm,
  },
  benefitsTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[900],
    marginBottom: spacing[3],
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  benefitIcon: {
    color: colors.primary[500],
    fontWeight: typography.fontWeight.bold,
  },
  benefitText: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[700],
  },
  actionsContainer: {
    padding: spacing[4],
    gap: spacing[3],
  },
  actionButton: {
    backgroundColor: colors.primary[500],
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  actionButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
});
