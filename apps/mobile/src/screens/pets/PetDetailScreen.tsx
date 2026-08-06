import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import api from '../../api/client';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/tokens';
import { hapticMedium, hapticSuccess, hapticError } from '../../lib/haptics';

interface Pet {
  _id: string;
  petId: string;
  name: string;
  petType: string;
  breed: string;
  color: string;
  gender: string;
  weight?: number;
  status: string;
  medicalAlerts?: string;
  notes?: string;
  isNeutered: boolean;
  linkedTag?: { tagId: string; status: string; subscriptionStatus: string };
  vaccinations: any[];
  microchips: any[];
  medications: any[];
  allergies: any[];
}

interface PetDetailScreenProps {
  navigation: any;
  route: any;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  safe: { bg: colors.green[100], text: colors.green[700] },
  lost: { bg: colors.red[100], text: colors.red[700] },
  found: { bg: colors.amber[100], text: colors.amber[700] },
};

export function PetDetailScreen({ navigation, route }: PetDetailScreenProps) {
  const { petId } = route.params;
  const [pet, setPet] = useState<Pet | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    breed: '',
    color: '',
    weight: '',
    medicalAlerts: '',
    notes: '',
  });

  const fetchPet = async () => {
    try {
      const res = await api.get(`/customer/pets/${petId}`);
      const p = res.data.data;
      setPet(p);
      setForm({
        breed: p.breed || '',
        color: p.color || '',
        weight: p.weight?.toString() || '',
        medicalAlerts: p.medicalAlerts || '',
        notes: p.notes || '',
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load pet');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPet();
  }, [petId]);

  const handleSave = async () => {
    if (!pet) return;
    setSaving(true);
    setError('');
    try {
      const payload: any = {
        breed: form.breed,
        color: form.color,
      };
      if (form.weight) payload.weight = parseFloat(form.weight);
      if (form.medicalAlerts !== undefined) payload.medicalAlerts = form.medicalAlerts;
      if (form.notes !== undefined) payload.notes = form.notes;

      await api.put(`/customer/pets/${pet._id}`, payload);
      hapticSuccess();
      setEditing(false);
      await fetchPet();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update pet');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Pet', `Are you sure you want to delete ${pet?.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/customer/pets/${petId}`);
            hapticSuccess();
            Alert.alert('Deleted', `${pet?.name} has been deleted.`, [
              { text: 'OK', onPress: () => navigation.goBack() },
            ]);
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.error || 'Failed to delete pet');
          }
        },
      },
    ]);
  };

  const handleMarkLost = () => {
    Alert.alert('Mark as Lost', `Mark ${pet?.name} as lost? This will notify nearby finders.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark Lost',
        style: 'destructive',
        onPress: async () => {
          try {
            hapticError();
            await api.post(`/customer/pets/${petId}/mark-lost`);
            await fetchPet();
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.error || 'Failed to mark as lost');
          }
        },
      },
    ]);
  };

  const handleMarkFound = async () => {
    try {
      hapticSuccess();
      await api.post(`/customer/pets/${petId}/mark-found`);
      await fetchPet();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to mark as found');
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  if (!pet) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error || 'Pet not found'}</Text>
      </View>
    );
  }

  const statusStyle = STATUS_COLORS[pet.status] || STATUS_COLORS.safe;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{pet.name.charAt(0)}</Text>
        </View>
        <Text style={styles.petName}>{pet.name}</Text>
        <Text style={styles.petId}>ID: {pet.petId}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
          <Text style={[styles.statusText, { color: statusStyle.text }]}>
            {pet.status.charAt(0).toUpperCase() + pet.status.slice(1)}
          </Text>
        </View>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {pet.linkedTag && (
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Linked Tag</Text>
          <Text style={styles.infoValue}>{pet.linkedTag.tagId}</Text>
          <Text style={styles.infoSubtext}>
            Subscription: {pet.linkedTag.subscriptionStatus}
          </Text>
        </View>
      )}

      {editing ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Edit Pet</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Breed</Text>
            <TextInput
              style={styles.input}
              value={form.breed}
              onChangeText={(t) => setForm({ ...form, breed: t })}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Color</Text>
            <TextInput
              style={styles.input}
              value={form.color}
              onChangeText={(t) => setForm({ ...form, color: t })}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Weight (kg)</Text>
            <TextInput
              style={styles.input}
              value={form.weight}
              onChangeText={(t) => setForm({ ...form, weight: t })}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Medical Alerts</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.medicalAlerts}
              onChangeText={(t) => setForm({ ...form, medicalAlerts: t })}
              multiline
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.notes}
              onChangeText={(t) => setForm({ ...form, notes: t })}
              multiline
            />
          </View>
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setEditing(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Details</Text>
            <TouchableOpacity onPress={() => setEditing(true)}>
              <Text style={styles.editLink}>Edit</Text>
            </TouchableOpacity>
          </View>
          <InfoRow label="Type" value={pet.petType} />
          <InfoRow label="Breed" value={pet.breed} />
          <InfoRow label="Color" value={pet.color} />
          <InfoRow label="Gender" value={pet.gender} />
          {pet.weight && <InfoRow label="Weight" value={`${pet.weight} kg`} />}
          <InfoRow label="Neutered" value={pet.isNeutered ? 'Yes' : 'No'} />
          {pet.medicalAlerts && <InfoRow label="Medical Alerts" value={pet.medicalAlerts} />}
          {pet.notes && <InfoRow label="Notes" value={pet.notes} />}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Health Records</Text>
        <View style={styles.statsRow}>
          <StatBox label="Vaccinations" count={pet.vaccinations?.length || 0} />
          <StatBox label="Microchips" count={pet.microchips?.length || 0} />
          <StatBox label="Medications" count={pet.medications?.length || 0} />
          <StatBox label="Allergies" count={pet.allergies?.length || 0} />
        </View>
        <TouchableOpacity
          style={styles.healthButton}
          onPress={() => navigation.navigate('HealthRecords', { petId: pet._id, petName: pet.name })}
        >
          <Text style={styles.healthButtonText}>View All Health Records</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actionsCard}>
        {pet.status === 'safe' ? (
          <TouchableOpacity style={styles.lostButton} onPress={handleMarkLost}>
            <Text style={styles.lostButtonText}>Mark as Lost</Text>
          </TouchableOpacity>
        ) : pet.status === 'lost' ? (
          <TouchableOpacity style={styles.foundButton} onPress={handleMarkFound}>
            <Text style={styles.foundButtonText}>Mark as Found</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>Delete Pet</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={infoStyles.value}>{value}</Text>
    </View>
  );
}

function StatBox({ label, count }: { label: string; count: number }) {
  return (
    <View style={statStyles.box}>
      <Text style={statStyles.count}>{count}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
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
    flex: 1,
    textAlign: 'right',
  },
});

const statStyles = StyleSheet.create({
  box: {
    flex: 1,
    alignItems: 'center',
    padding: spacing[3],
  },
  count: {
    fontSize: typography.fontSize.h2,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
  },
  label: {
    fontSize: typography.fontSize.caption,
    color: colors.gray[500],
    marginTop: spacing[1],
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
    alignItems: 'center',
    marginBottom: spacing[6],
    marginTop: spacing[4],
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  avatarText: {
    fontSize: typography.fontSize.display,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  petName: {
    fontSize: typography.fontSize.h1,
    fontWeight: typography.fontWeight.bold,
    color: colors.gray[900],
  },
  petId: {
    fontSize: typography.fontSize.bodySm,
    color: colors.gray[400],
    marginTop: spacing[1],
  },
  statusBadge: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
    marginTop: spacing[2],
  },
  statusText: {
    fontSize: typography.fontSize.bodySm,
    fontWeight: typography.fontWeight.semibold,
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
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  cardTitle: {
    fontSize: typography.fontSize.h3,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[900],
    marginBottom: spacing[3],
  },
  editLink: {
    fontSize: typography.fontSize.bodySm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  infoCard: {
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  infoLabel: {
    fontSize: typography.fontSize.caption,
    color: colors.primary[700],
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing[1],
  },
  infoValue: {
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[800],
  },
  infoSubtext: {
    fontSize: typography.fontSize.bodySm,
    color: colors.primary[600],
    marginTop: spacing[1],
  },
  inputGroup: {
    marginBottom: spacing[3],
  },
  label: {
    fontSize: typography.fontSize.bodySm,
    fontWeight: typography.fontWeight.medium,
    color: colors.gray[700],
    marginBottom: spacing[1],
  },
  input: {
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: typography.fontSize.body,
    color: colors.gray[900],
    backgroundColor: colors.white,
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[3],
  },
  cancelButton: {
    flex: 1,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing[3],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray[300],
  },
  cancelButtonText: {
    color: colors.gray[700],
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.medium,
  },
  saveButton: {
    flex: 1,
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.xl,
    paddingVertical: spacing[3],
    alignItems: 'center',
  },
  saveButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.semibold,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: spacing[4],
  },
  healthButton: {
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.xl,
    paddingVertical: spacing[3],
    alignItems: 'center',
  },
  healthButtonText: {
    color: colors.primary[700],
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.semibold,
  },
  actionsCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius['2xl'],
    padding: spacing[5],
    ...shadows.subtle,
  },
  lostButton: {
    backgroundColor: colors.red[600],
    borderRadius: borderRadius.xl,
    paddingVertical: spacing[3],
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  lostButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.semibold,
  },
  foundButton: {
    backgroundColor: colors.green[600],
    borderRadius: borderRadius.xl,
    paddingVertical: spacing[3],
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  foundButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.semibold,
  },
  deleteButton: {
    borderRadius: borderRadius.xl,
    paddingVertical: spacing[3],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.red[200],
  },
  deleteButtonText: {
    color: colors.red[600],
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.medium,
  },
});
