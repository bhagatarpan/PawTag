import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../api/client';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/tokens';

interface HealthRecordsScreenProps {
  navigation: any;
  route: any;
}

type Tab = 'vaccinations' | 'microchips' | 'medications' | 'allergies' | 'surgeries' | 'weight' | 'conditions';

const TABS: { key: Tab; label: string }[] = [
  { key: 'vaccinations', label: 'Vaccinations' },
  { key: 'microchips', label: 'Microchips' },
  { key: 'medications', label: 'Medications' },
  { key: 'allergies', label: 'Allergies' },
  { key: 'surgeries', label: 'Surgeries' },
  { key: 'weight', label: 'Weight' },
  { key: 'conditions', label: 'Conditions' },
];

export function HealthRecordsScreen({ navigation, route }: HealthRecordsScreenProps) {
  const { petId, petName } = route.params;
  const [activeTab, setActiveTab] = useState<Tab>('vaccinations');
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const fetchRecords = async () => {
    try {
      const res = await api.get(`/customer/pets/${petId}/${activeTab}`);
      setRecords(res.data.data || []);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchRecords();
    }, [activeTab, petId]),
  );

  const handleDelete = (endpoint: string) => {
    Alert.alert('Delete Record', 'Are you sure you want to delete this record?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/customer/pets/${petId}/${endpoint}`);
            fetchRecords();
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.error || 'Failed to delete');
          }
        },
      },
    ]);
  };

  const formatDate = (date: string) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-NZ', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const renderItem = ({ item }: { item: any }) => {
    const id = item._id;
    switch (activeTab) {
      case 'vaccinations':
        return (
          <RecordCard
            title={item.vaccine}
            subtitle={item.vaccineType}
            details={[
              { label: 'Date', value: formatDate(item.dateGiven) },
              { label: 'Next Due', value: formatDate(item.nextDueDate) },
              item.vetClinic && { label: 'Clinic', value: item.vetClinic },
              item.veterinarian && { label: 'Vet', value: item.veterinarian },
            ].filter(Boolean) as any[]}
            onDelete={() => handleDelete(`vaccinations/${id}`)}
          />
        );
      case 'microchips':
        return (
          <RecordCard
            title={item.chipNumber}
            subtitle={item.brand}
            details={[
              item.implantDate && { label: 'Implanted', value: formatDate(item.implantDate) },
              item.implantLocation && { label: 'Location', value: item.implantLocation },
              item.implantedBy && { label: 'By', value: item.implantedBy },
            ].filter(Boolean) as any[]}
            onDelete={() => handleDelete(`microchips/${id}`)}
          />
        );
      case 'medications':
        return (
          <RecordCard
            title={item.name}
            subtitle={item.dosage}
            details={[
              item.frequency && { label: 'Frequency', value: item.frequency },
              item.startDate && { label: 'Start', value: formatDate(item.startDate) },
              item.endDate && { label: 'End', value: formatDate(item.endDate) },
              item.prescribedBy && { label: 'Prescribed by', value: item.prescribedBy },
              item.reason && { label: 'Reason', value: item.reason },
            ].filter(Boolean) as any[]}
            onDelete={() => handleDelete(`medications/${id}`)}
          />
        );
      case 'allergies':
        return (
          <RecordCard
            title={item.allergen}
            subtitle={`Severity: ${item.severity}`}
            details={[
              item.reaction && { label: 'Reaction', value: item.reaction },
              item.diagnosedBy && { label: 'Diagnosed by', value: item.diagnosedBy },
            ].filter(Boolean) as any[]}
            onDelete={() => handleDelete(`allergies/${id}`)}
          />
        );
      case 'surgeries':
        return (
          <RecordCard
            title={item.procedure}
            subtitle={formatDate(item.date)}
            details={[
              item.performedBy && { label: 'Performed by', value: item.performedBy },
              item.clinic && { label: 'Clinic', value: item.clinic },
              item.reason && { label: 'Reason', value: item.reason },
            ].filter(Boolean) as any[]}
            onDelete={() => handleDelete(`surgeries/${id}`)}
          />
        );
      case 'weight':
        return (
          <RecordCard
            title={`${item.weight} kg`}
            subtitle={formatDate(item.date)}
            details={[item.notes && { label: 'Notes', value: item.notes }].filter(Boolean) as any[]}
            onDelete={() => handleDelete(`weight-history/${id}`)}
          />
        );
      case 'conditions':
        return (
          <RecordCard
            title={item.condition}
            subtitle={`Severity: ${item.severity}`}
            details={[
              item.diagnosedDate && { label: 'Diagnosed', value: formatDate(item.diagnosedDate) },
              item.diagnosedBy && { label: 'Diagnosed by', value: item.diagnosedBy },
              item.treatment && { label: 'Treatment', value: item.treatment },
            ].filter(Boolean) as any[]}
            onDelete={() => handleDelete(`health-conditions/${id}`)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.petName}>{petName} — Health Records</Text>

      <FlatList
        horizontal
        data={TABS}
        keyExtractor={(item) => item.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabBar}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.tab, activeTab === item.key && styles.tabActive]}
            onPress={() => setActiveTab(item.key)}
          >
            <Text style={[styles.tabText, activeTab === item.key && styles.tabTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary[600]} />
        </View>
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={records.length === 0 ? styles.emptyContainer : styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>No records yet</Text>
              <Text style={styles.emptyMessage}>
                Add a {activeTab.replace(/-/g, ' ').replace(/s$/, '')} record for this pet.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function RecordCard({
  title,
  subtitle,
  details,
  onDelete,
}: {
  title: string;
  subtitle?: string;
  details: Array<{ label: string; value: string }>;
  onDelete: () => void;
}) {
  return (
    <View style={recordStyles.card}>
      <View style={recordStyles.header}>
        <View style={recordStyles.titleContainer}>
          <Text style={recordStyles.title}>{title}</Text>
          {subtitle ? <Text style={recordStyles.subtitle}>{subtitle}</Text> : null}
        </View>
        <TouchableOpacity onPress={onDelete} style={recordStyles.deleteButton}>
          <Text style={recordStyles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
      {details.length > 0 && (
        <View style={recordStyles.details}>
          {details.map((d, i) => (
            <View key={i} style={recordStyles.detailRow}>
              <Text style={recordStyles.detailLabel}>{d.label}</Text>
              <Text style={recordStyles.detailValue}>{d.value}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const recordStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: colors.gray[100],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[900],
  },
  subtitle: {
    fontSize: typography.fontSize.bodySm,
    color: colors.gray[500],
    marginTop: 2,
  },
  deleteButton: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
  },
  deleteText: {
    fontSize: typography.fontSize.caption,
    color: colors.red[500],
    fontWeight: typography.fontWeight.medium,
  },
  details: {
    marginTop: spacing[3],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing[1],
  },
  detailLabel: {
    fontSize: typography.fontSize.bodySm,
    color: colors.gray[500],
  },
  detailValue: {
    fontSize: typography.fontSize.bodySm,
    color: colors.gray[700],
    fontWeight: typography.fontWeight.medium,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  petName: {
    fontSize: typography.fontSize.h3,
    fontWeight: typography.fontWeight.bold,
    color: colors.gray[900],
    paddingHorizontal: spacing[6],
    paddingTop: spacing[8],
    paddingBottom: spacing[3],
  },
  tabBar: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[3],
    gap: spacing[2],
  },
  tab: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  tabActive: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  tabText: {
    fontSize: typography.fontSize.bodySm,
    color: colors.gray[600],
    fontWeight: typography.fontWeight.medium,
  },
  tabTextActive: {
    color: colors.white,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[8],
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: spacing[8],
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing[3],
  },
  emptyTitle: {
    fontSize: typography.fontSize.h3,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[900],
    marginBottom: spacing[2],
  },
  emptyMessage: {
    fontSize: typography.fontSize.body,
    color: colors.gray[500],
    textAlign: 'center',
  },
});
