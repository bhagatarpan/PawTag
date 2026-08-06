import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../api/client';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/tokens';

interface Pet {
  _id: string;
  petId: string;
  name: string;
  petType: string;
  breed: string;
  color: string;
  status: string;
  photos: Array<{ url: string; isMain: boolean }>;
  linkedTag?: { tagId: string; status: string; subscriptionStatus: string };
}

interface PetListScreenProps {
  navigation: any;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  safe: { bg: colors.green[100], text: colors.green[700] },
  lost: { bg: colors.red[100], text: colors.red[700] },
  found: { bg: colors.amber[100], text: colors.amber[700] },
};

export function PetListScreen({ navigation }: PetListScreenProps) {
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchPets = async () => {
    try {
      const res = await api.get('/customer/pets');
      setPets(res.data.data);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load pets');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchPets();
    }, []),
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchPets();
  };

  const getMainPhoto = (pet: Pet) => {
    const main = pet.photos?.find((p) => p.isMain);
    return main?.url || pet.photos?.[0]?.url;
  };

  const renderPet = ({ item }: { item: Pet }) => {
    const statusStyle = STATUS_COLORS[item.status] || STATUS_COLORS.safe;
    return (
      <TouchableOpacity
        style={styles.petCard}
        onPress={() => navigation.navigate('PetDetail', { petId: item._id })}
      >
        <View style={styles.petCardContent}>
          <View style={styles.petAvatar}>
            <Text style={styles.petAvatarText}>{item.name.charAt(0)}</Text>
          </View>
          <View style={styles.petInfo}>
            <Text style={styles.petName}>{item.name}</Text>
            <Text style={styles.petBreed}>
              {item.breed} · {item.petType}
            </Text>
            {item.linkedTag && (
              <Text style={styles.petTag}>
                Tag: {item.linkedTag.tagId} ({item.linkedTag.subscriptionStatus})
              </Text>
            )}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusText, { color: statusStyle.text }]}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Loading pets...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Pets</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('AddPet')}
        >
          <Text style={styles.addButtonText}>+ Add Pet</Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <FlatList
        data={pets}
        keyExtractor={(item) => item._id}
        renderItem={renderPet}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={pets.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🐾</Text>
            <Text style={styles.emptyTitle}>No pets yet</Text>
            <Text style={styles.emptyMessage}>
              Add your first pet to get started with PawTag.
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => navigation.navigate('AddPet')}
            >
              <Text style={styles.emptyButtonText}>Add a Pet</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
  },
  loadingText: {
    fontSize: typography.fontSize.body,
    color: colors.gray[500],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[6],
    paddingTop: spacing[8],
    paddingBottom: spacing[4],
  },
  title: {
    fontSize: typography.fontSize.h1,
    fontWeight: typography.fontWeight.bold,
    color: colors.gray[900],
  },
  addButton: {
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  addButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.bodySm,
    fontWeight: typography.fontWeight.semibold,
  },
  errorText: {
    fontSize: typography.fontSize.bodySm,
    color: colors.red[600],
    backgroundColor: colors.red[50],
    marginHorizontal: spacing[6],
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[3],
  },
  listContent: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[8],
  },
  petCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius['2xl'],
    marginBottom: spacing[3],
    ...shadows.subtle,
  },
  petCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[4],
  },
  petAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  petAvatarText: {
    fontSize: typography.fontSize.h2,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  petInfo: {
    flex: 1,
  },
  petName: {
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[900],
    marginBottom: 2,
  },
  petBreed: {
    fontSize: typography.fontSize.bodySm,
    color: colors.gray[500],
  },
  petTag: {
    fontSize: typography.fontSize.caption,
    color: colors.primary[600],
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
  },
  statusText: {
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.semibold,
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
    fontSize: 64,
    marginBottom: spacing[4],
  },
  emptyTitle: {
    fontSize: typography.fontSize.h2,
    fontWeight: typography.fontWeight.bold,
    color: colors.gray[900],
    marginBottom: spacing[2],
  },
  emptyMessage: {
    fontSize: typography.fontSize.body,
    color: colors.gray[500],
    textAlign: 'center',
    marginBottom: spacing[6],
  },
  emptyButton: {
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
  },
  emptyButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.semibold,
  },
});
