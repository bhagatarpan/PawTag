import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Linking,
  RefreshControl,
} from 'react-native';
import api from '../../api/client';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/tokens';
import { EmptyState } from '../../components/states/EmptyState';
import { ErrorState } from '../../components/states/ErrorState';

interface Subscription {
  _id: string;
  planName: string;
  planType: string;
  status: string;
  price: number;
  currency: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  autoRenew: boolean;
  petName: string | null;
  petType: string | null;
  productName: string | null;
  tagId: { tagId: string } | null;
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: colors.green[100], text: colors.green[700], label: 'Active' },
  grace_period: { bg: colors.amber[100], text: colors.amber[700], label: 'Grace Period' },
  expired: { bg: colors.red[100], text: colors.red[700], label: 'Expired' },
  cancelled: { bg: colors.gray[100], text: colors.gray[600], label: 'Cancelled' },
};

export function SubscriptionScreen({ navigation }: any) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const fetchSubscriptions = useCallback(async () => {
    try {
      const res = await api.get('/customer/subscriptions');
      setSubscriptions(res.data.data);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load subscriptions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSubscriptions();
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const res = await api.post('/customer/subscriptions/portal-link');
      const url = res.data.data?.url;
      if (url) {
        await Linking.openURL(url);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to open subscription manager');
    } finally {
      setPortalLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-NZ', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diffMs = end.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  if (error && subscriptions.length === 0) {
    return (
      <View style={styles.centered}>
        <ErrorState message={error} onRetry={fetchSubscriptions} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Subscriptions</Text>
        <Text style={styles.subtitle}>Manage your PawTag subscriptions</Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {subscriptions.length === 0 ? (
        <EmptyState
          icon="📦"
          title="No subscriptions yet"
          message="Activate a tag to start your subscription"
          actionLabel="Activate a Tag"
          onAction={() => navigation.navigate('RedeemTag')}
        />
      ) : (
        subscriptions.map((sub) => {
          const statusConfig = STATUS_CONFIG[sub.status] || STATUS_CONFIG.active;
          const daysRemaining = getDaysRemaining(sub.currentPeriodEnd);

          return (
            <View key={sub._id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.planName}>{sub.planName}</Text>
                  {sub.petName && (
                    <Text style={styles.petName}>{sub.petName}</Text>
                  )}
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                  <Text style={[styles.statusText, { color: statusConfig.text }]}>
                    {statusConfig.label}
                  </Text>
                </View>
              </View>

              <View style={styles.detailsGrid}>
                <DetailItem label="Tag" value={sub.tagId?.tagId || 'N/A'} />
                <DetailItem label="Price" value={`$${sub.price.toFixed(2)} ${sub.currency}`} />
                <DetailItem label="Billing" value={sub.planType === 'annual' ? 'Annual' : 'Monthly'} />
                <DetailItem
                  label="Next billing"
                  value={sub.autoRenew ? formatDate(sub.currentPeriodEnd) : 'Auto-renew off'}
                />
                {sub.status === 'active' && (
                  <DetailItem
                    label="Days remaining"
                    value={`${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`}
                    highlight={daysRemaining <= 7}
                  />
                )}
                {sub.status === 'grace_period' && (
                  <DetailItem
                    label="Grace period ends"
                    value={formatDate(sub.currentPeriodEnd)}
                    highlight
                  />
                )}
              </View>

              <TouchableOpacity
                style={[styles.manageButton, portalLoading && styles.buttonDisabled]}
                onPress={handleManageSubscription}
                disabled={portalLoading}
              >
                {portalLoading ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.manageButtonText}>Manage Subscription</Text>
                )}
              </TouchableOpacity>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

function DetailItem({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={detailStyles.row}>
      <Text style={detailStyles.label}>{label}</Text>
      <Text style={[detailStyles.value, highlight && detailStyles.highlight]}>{value}</Text>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  label: {
    fontSize: typography.fontSize.bodySm,
    color: colors.gray[500],
  },
  value: {
    fontSize: typography.fontSize.bodySm,
    color: colors.gray[900],
    fontWeight: typography.fontWeight.medium,
  },
  highlight: {
    color: colors.amber[600],
    fontWeight: typography.fontWeight.semibold,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  content: {
    padding: spacing[6],
    paddingBottom: spacing[12],
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
  },
  header: {
    marginBottom: spacing[6],
    marginTop: spacing[4],
  },
  backButton: {
    marginBottom: spacing[3],
  },
  backText: {
    fontSize: typography.fontSize.body,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  title: {
    fontSize: typography.fontSize.h1,
    fontWeight: typography.fontWeight.bold,
    color: colors.gray[900],
    marginBottom: spacing[1],
  },
  subtitle: {
    fontSize: typography.fontSize.body,
    color: colors.gray[500],
  },
  errorText: {
    fontSize: typography.fontSize.bodySm,
    color: colors.red[600],
    backgroundColor: colors.red[50],
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[4],
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius['2xl'],
    padding: spacing[5],
    marginBottom: spacing[4],
    ...shadows.subtle,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[4],
  },
  planName: {
    fontSize: typography.fontSize.h3,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[900],
  },
  petName: {
    fontSize: typography.fontSize.bodySm,
    color: colors.gray[500],
    marginTop: spacing[1],
  },
  statusBadge: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
  },
  statusText: {
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.semibold,
  },
  detailsGrid: {
    marginBottom: spacing[4],
  },
  manageButton: {
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.xl,
    paddingVertical: spacing[3],
    alignItems: 'center',
  },
  manageButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.semibold,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
