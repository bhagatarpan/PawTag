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
import { EmptyState } from '../../components/states/EmptyState';
import { ErrorState } from '../../components/states/ErrorState';
import { hapticLight } from '../../lib/haptics';

interface Order {
  _id: string;
  orderNumber: string;
  status: string;
  total: number;
  currency: string;
  createdAt: string;
  items: Array<{
    productName: string;
    quantity: number;
    price: number;
  }>;
  shipping?: {
    trackingNumber?: string;
    carrier?: string;
    status?: string;
  };
  payment: {
    status: string;
  };
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  pending_payment: { bg: colors.amber[100], text: colors.amber[700], label: 'Pending' },
  paid: { bg: colors.green[100], text: colors.green[700], label: 'Paid' },
  processing: { bg: colors.primary[100], text: colors.primary[700], label: 'Processing' },
  shipped: { bg: colors.blue[100], text: colors.blue[700], label: 'Shipped' },
  delivered: { bg: colors.green[100], text: colors.green[700], label: 'Delivered' },
  cancelled: { bg: colors.gray[100], text: colors.gray[600], label: 'Cancelled' },
  refunded: { bg: colors.red[100], text: colors.red[700], label: 'Refunded' },
};

export function OrderHistoryScreen({ navigation }: any) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await api.get('/customer/orders');
      setOrders(res.data.data);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-NZ', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const toggleExpand = (id: string) => {
    hapticLight();
    setExpandedId(expandedId === id ? null : id);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  if (error && orders.length === 0) {
    return (
      <View style={styles.centered}>
        <ErrorState message={error} onRetry={fetchOrders} />
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
        <Text style={styles.title}>Order History</Text>
        <Text style={styles.subtitle}>View your past orders</Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {orders.length === 0 ? (
        <EmptyState
          icon="🛒"
          title="No orders yet"
          message="Your order history will appear here"
        />
      ) : (
        orders.map((order) => {
          const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.paid;
          const isExpanded = expandedId === order._id;

          return (
            <TouchableOpacity
              key={order._id}
              style={styles.card}
              onPress={() => toggleExpand(order._id)}
              activeOpacity={0.7}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardLeft}>
                  <Text style={styles.orderNumber}>{order.orderNumber}</Text>
                  <Text style={styles.orderDate}>{formatDate(order.createdAt)}</Text>
                </View>
                <View style={styles.cardRight}>
                  <Text style={styles.orderTotal}>${order.total.toFixed(2)}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                    <Text style={[styles.statusText, { color: statusConfig.text }]}>
                      {statusConfig.label}
                    </Text>
                  </View>
                </View>
              </View>

              {isExpanded && (
                <View style={styles.expandedContent}>
                  <View style={styles.divider} />
                  <Text style={styles.sectionTitle}>Items</Text>
                  {order.items.map((item, idx) => (
                    <View key={idx} style={styles.itemRow}>
                      <Text style={styles.itemName} numberOfLines={1}>
                        {item.productName}
                      </Text>
                      <Text style={styles.itemQty}>×{item.quantity}</Text>
                      <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
                    </View>
                  ))}

                  {order.shipping?.trackingNumber && (
                    <View style={styles.trackingSection}>
                      <Text style={styles.sectionTitle}>Tracking</Text>
                      <Text style={styles.trackingNumber}>
                        {order.shipping.carrier}: {order.shipping.trackingNumber}
                      </Text>
                    </View>
                  )}

                  <View style={styles.paymentRow}>
                    <Text style={styles.paymentLabel}>Payment</Text>
                    <Text style={styles.paymentStatus}>
                      {order.payment.status === 'paid' ? '✓ Paid' : order.payment.status}
                    </Text>
                  </View>
                </View>
              )}

              <Text style={styles.expandHint}>
                {isExpanded ? 'Tap to collapse' : 'Tap for details'}
              </Text>
            </TouchableOpacity>
          );
        })
      )}
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
    marginBottom: spacing[3],
    ...shadows.subtle,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardLeft: {
    flex: 1,
  },
  cardRight: {
    alignItems: 'flex-end',
  },
  orderNumber: {
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[900],
    fontFamily: 'monospace',
  },
  orderDate: {
    fontSize: typography.fontSize.bodySm,
    color: colors.gray[500],
    marginTop: spacing[1],
  },
  orderTotal: {
    fontSize: typography.fontSize.h3,
    fontWeight: typography.fontWeight.bold,
    color: colors.gray[900],
    marginBottom: spacing[1],
  },
  statusBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
    borderRadius: borderRadius.full,
  },
  statusText: {
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.semibold,
  },
  expandedContent: {
    marginTop: spacing[3],
  },
  divider: {
    height: 1,
    backgroundColor: colors.gray[100],
    marginBottom: spacing[3],
  },
  sectionTitle: {
    fontSize: typography.fontSize.bodySm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[700],
    marginBottom: spacing[2],
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[50],
  },
  itemName: {
    flex: 1,
    fontSize: typography.fontSize.bodySm,
    color: colors.gray[700],
  },
  itemQty: {
    fontSize: typography.fontSize.bodySm,
    color: colors.gray[500],
    marginHorizontal: spacing[3],
  },
  itemPrice: {
    fontSize: typography.fontSize.bodySm,
    fontWeight: typography.fontWeight.medium,
    color: colors.gray[900],
  },
  trackingSection: {
    marginTop: spacing[3],
  },
  trackingNumber: {
    fontSize: typography.fontSize.bodySm,
    color: colors.primary[700],
    fontFamily: 'monospace',
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing[3],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
  },
  paymentLabel: {
    fontSize: typography.fontSize.bodySm,
    color: colors.gray[500],
  },
  paymentStatus: {
    fontSize: typography.fontSize.bodySm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.green[600],
  },
  expandHint: {
    fontSize: typography.fontSize.caption,
    color: colors.gray[400],
    textAlign: 'center',
    marginTop: spacing[2],
  },
});
