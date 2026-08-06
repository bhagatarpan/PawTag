import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import api from '../../api/client';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/tokens';

const PET_TYPES = ['Dog', 'Cat', 'Rabbit', 'Hamster', 'Guinea Pig', 'Bird'];
const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'unknown', label: 'Unknown' },
];

interface AddPetScreenProps {
  navigation: any;
}

export function AddPetScreen({ navigation }: AddPetScreenProps) {
  const [form, setForm] = useState({
    name: '',
    petType: 'Dog',
    species: '',
    breed: '',
    gender: 'unknown' as string,
    color: '',
    weight: '',
    dateOfBirth: '',
    medicalAlerts: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!form.name || !form.breed || !form.color) {
      setError('Please fill in name, breed, and color');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const payload: any = {
        name: form.name,
        petType: form.petType,
        species: form.petType,
        breed: form.breed,
        gender: form.gender,
        color: form.color,
      };
      if (form.weight) payload.weight = parseFloat(form.weight);
      if (form.dateOfBirth) payload.dateOfBirth = form.dateOfBirth;
      if (form.medicalAlerts) payload.medicalAlerts = form.medicalAlerts;
      if (form.notes) payload.notes = form.notes;

      await api.post('/customer/pets', payload);
      navigation.goBack();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add pet');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Add a New Pet</Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Pet Name *</Text>
          <TextInput
            style={styles.input}
            value={form.name}
            onChangeText={(t) => setForm({ ...form, name: t })}
            placeholder="e.g. Buddy"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Pet Type</Text>
          <View style={styles.chipGroup}>
            {PET_TYPES.map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.chip, form.petType === type && styles.chipActive]}
                onPress={() => setForm({ ...form, petType: type })}
              >
                <Text style={[styles.chipText, form.petType === type && styles.chipTextActive]}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Breed *</Text>
          <TextInput
            style={styles.input}
            value={form.breed}
            onChangeText={(t) => setForm({ ...form, breed: t })}
            placeholder="e.g. Golden Retriever"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Color *</Text>
          <TextInput
            style={styles.input}
            value={form.color}
            onChangeText={(t) => setForm({ ...form, color: t })}
            placeholder="e.g. Golden"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Gender</Text>
          <View style={styles.chipGroup}>
            {GENDERS.map((g) => (
              <TouchableOpacity
                key={g.value}
                style={[styles.chip, form.gender === g.value && styles.chipActive]}
                onPress={() => setForm({ ...form, gender: g.value })}
              >
                <Text style={[styles.chipText, form.gender === g.value && styles.chipTextActive]}>
                  {g.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Weight (kg)</Text>
          <TextInput
            style={styles.input}
            value={form.weight}
            onChangeText={(t) => setForm({ ...form, weight: t })}
            placeholder="e.g. 25"
            keyboardType="decimal-pad"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Medical Alerts</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={form.medicalAlerts}
            onChangeText={(t) => setForm({ ...form, medicalAlerts: t })}
            placeholder="Any allergies or conditions"
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={form.notes}
            onChangeText={(t) => setForm({ ...form, notes: t })}
            placeholder="Anything else about your pet"
            multiline
            numberOfLines={3}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>Add Pet</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  content: {
    padding: spacing[6],
    paddingTop: spacing[8],
  },
  title: {
    fontSize: typography.fontSize.h2,
    fontWeight: typography.fontWeight.bold,
    color: colors.gray[900],
    marginBottom: spacing[6],
  },
  errorText: {
    fontSize: typography.fontSize.bodySm,
    color: colors.red[600],
    backgroundColor: colors.red[50],
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[4],
  },
  inputGroup: {
    marginBottom: spacing[4],
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
    minHeight: 80,
    textAlignVertical: 'top',
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  chip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.gray[300],
    backgroundColor: colors.white,
  },
  chipActive: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  chipText: {
    fontSize: typography.fontSize.bodySm,
    color: colors.gray[700],
  },
  chipTextActive: {
    color: colors.white,
    fontWeight: typography.fontWeight.medium,
  },
  button: {
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.xl,
    paddingVertical: spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginTop: spacing[4],
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.white,
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.semibold,
  },
});
