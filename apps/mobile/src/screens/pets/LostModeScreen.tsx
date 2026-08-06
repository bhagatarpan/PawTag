import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import api from '../../api/client';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/tokens';

interface Pet {
  _id: string;
  petId: string;
  name: string;
  petType: string;
  breed: string;
  status: string;
  foundByFinderAt?: string;
  linkedTag?: { tagId: string; status: string };
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; icon: string }> = {
  safe: { bg: colors.green[50], text: colors.green[700], icon: '✅' },
  lost: { bg: colors.red[50], text: colors.red[700], icon: '🚨' },
  found: { bg: colors.amber[50], text: colors.amber[700], icon: '🔍' },
};

export function LostModeScreen({ navigation }: any) {
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
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
    }
  };

  useEffect(() => {
    fetchPets();
  }, []);

  const handleToggleLost = (pet: Pet) => {
    if (pet.status === 'lost') {
      // Mark as found
      Alert.alert(
        'Mark as Found',
        `Mark ${pet.name} as found/safe?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Mark Found',
            onPress: async () => {
              setToggling(pet._id);
              try {
                await api.post(`/customer/pets/${pet._id}/mark-found`);
                await fetchPets();
              } catch (err: any) {
                Alert.alert('Error', err.response?.data?.error || 'Failed to update pet status');
              } finally {
                setToggling(null);
              }
            },
          },
        ],
      );
    } else if (pet.status === 'safe') {
      // Mark as lost
      Alert.alert(
        'Mark as Lost',
        `Mark ${pet.name} as lost? This will notify nearby finders when your tag is scanned.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Mark Lost',
            style: 'destructive',
            onPress: async () => {
              setToggling(pet._id);
              try {
                await api.post(`/customer/pets/${pet._id}/mark-lost`);
                await fetchPets();
              } catch (err: any) {
                Alert.alert('Error', err.response?.data?.error || 'Failed to update pet status');
              } finally {
                setToggling(null);
              }
            },
          },
        ],
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Lost Mode</Text>
        <Text style={styles.subtitle}>
          Toggle lost status for your pets. When marked as lost, nearby finders will be notified when your tag is scanned.
        </Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {pets.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>🐾</Text>
          <Text style={styles.emptyTitle}>No pets registered</Text>
          <Text style={styles.emptyText}>Add a pet first to use Lost Mode</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('AddPet')}
          >
            <Text style={styles.addButtonText}>Add a Pet</Text>
          </TouchableOpacity>
        </View>
      ) : (
        pets.map((pet) => {
          const statusConfig = STATUS_CONFIG[pet.status] || STATUS_CONFIG.safe;
          const isLost = pet.status === 'lost';
          const isSafe = pet.status === 'safe';
          const canToggle = isLost || isSafe;

          return (
            <View key={pet._id} style={styles.petCard}>
              <View style={styles.petHeader}>
                <View style={[styles.petAvatar, { backgroundColor: statusConfig.bg }]}>
                  <Text style={styles.petAvatarText}>{pet.name.charAt(0)}</Text>
                </View>
                <View style={styles.petInfo}>
                  <Text style={styles.petName}>{pet.name}</Text>
                  <Text style={styles.petDetails}>
                    {pet.petType} · {pet.breed || 'Unknown breed'}
                  </Text>
                  <Text style={styles.petId}>ID: {pet.petId}</Text>
                </View>
                <View style={[styles.statusIndicator, { backgroundColor: statusConfig.bg }]}>
                  <Text style={styles.statusIcon}>{statusConfig.icon}</Text>
                  <Text style={[styles.statusLabel, { color: statusConfig.text }]}>
                    {pet.status.charAt(0).toUpperCase() + pet.status.slice(1)}
                  </Text>
                </View>
              </View>

              {pet.linkedTag && (
                <View style={styles.tagInfo}>
                  <Text style={styles.tagLabel}>Linked Tag</Text>
                  <Text style={styles.tagId}>{pet.linkedTag.tagId}</Text>
                </View>
              )}

              {canToggle && (
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    isLost ? styles.foundButton : styles.lostButton,
                    toggling === pet._id && styles.buttonDisabled,
                  ]}
                  onPress={() => handleToggleLost(pet)}
                  disabled={toggling === pet._id}
                >
                  {toggling === pet._id ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <Text style={styles.toggleButtonText}>
                      {isLost ? 'Mark as Found/Safe' : 'Mark as Lost'}
                    </Text>
                  )}
                </TouchableOpacity>
              )}

              {pet.status === 'found' && (
                <View style={styles.foundBanner}>
                  <Text style={styles.foundBannerText}>
                    🎉 This pet has been found! A finder has scanned their tag.
                  </Text>
                  {pet.foundByFinderAt && (
                    <Text style={styles.foundTime}>
                      Found {new Date(pet.foundByFinderAt).toLocaleDateString('en-NZ')}
                    </Text>
                  )}
                </View>
              )}
            </View>
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
    lineHeight: 20,
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
  emptyCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius['2xl'],
    padding: spacing[8],
    alignItems: 'center',
    ...shadows.subtle,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing[3],
  },
  emptyTitle: {
    fontSize: typography.fontSize.h3,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[900],
    marginBottom: spacing[1],
  },
  emptyText: {
    fontSize: typography.fontSize.body,
    color: colors.gray[500],
    marginBottom: spacing[4],
  },
  addButton: {
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
  },
  addButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.semibold,
  },
  petCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius['2xl'],
    padding: spacing[5],
    marginBottom: spacing[3],
    ...shadows.subtle,
  },
  petHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  petAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  petAvatarText: {
    fontSize: typography.fontSize.h2,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  petInfo: {
    flex: 1,
    marginLeft: spacing[3],
  },
  petName: {
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[900],
  },
  petDetails: {
    fontSize: typography.fontSize.bodySm,
    color: colors.gray[500],
    marginTop: spacing[0.5],
  },
  petId: {
    fontSize: typography.fontSize.caption,
    color: colors.gray[400],
    fontFamily: 'monospace',
    marginTop: spacing[0.5],
  },
  statusIndicator: {
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.lg,
  },
  statusIcon: {
    fontSize: 20,
    marginBottom: spacing[0.5],
  },
  statusLabel: {
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.semibold,
  },
  tagInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.lg,
    padding: spacing[3],
    marginTop: spacing[3],
  },
  tagLabel: {
    fontSize: typography.fontSize.bodySm,
    color: colors.gray[500],
  },
  tagId: {
    fontSize: typography.fontSize.bodySm,
    fontWeight: typography.fontWeight.medium,
    color: colors.gray[900],
    fontFamily: 'monospace',
  },
  toggleButton: {
    borderRadius: borderRadius.xl,
    paddingVertical: spacing[3],
    alignItems: 'center',
    marginTop: spacing[4],
  },
  lostButton: {
    backgroundColor: colors.red[600],
  },
  foundButton: {
    backgroundColor: colors.green[600],
  },
  toggleButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.semibold,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  foundBanner: {
    backgroundColor: colors.green[50],
    borderRadius: borderRadius.lg,
    padding: spacing[3],
    marginTop: spacing[3],
    borderWidth: 1,
    borderColor: colors.green[200],
  },
  foundBannerText: {
    fontSize: typography.fontSize.bodySm,
    color: colors.green[700],
    fontWeight: typography.fontWeight.medium,
  },
  foundTime: {
    fontSize: typography.fontSize.caption,
    color: colors.green[600],
    marginTop: spacing[1],
  },
});
