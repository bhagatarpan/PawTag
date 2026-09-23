import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import api from '../../api/client';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/tokens';

interface RedeemTagScreenProps {
  navigation: any;
  route: any;
}

export function RedeemTagScreen({ navigation, route }: RedeemTagScreenProps) {
  const { tagId: initialTagId } = route.params || {};
  const [tagId, setTagId] = useState(initialTagId || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [redeemedTag, setRedeemedTag] = useState<any>(null);
  const [pets, setPets] = useState<any[]>([]);
  const [selectedPetId, setSelectedPetId] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [linked, setLinked] = useState(false);

  useEffect(() => {
    if (initialTagId) {
      handleRedeem(initialTagId);
    }
  }, [initialTagId]);

  // Fetch pets after successful activation
  useEffect(() => {
    if (success && !redeemedTag?.petId) {
      api.get('/customer/pets')
        .then((res) => setPets(res.data.data || []))
        .catch(() => {});
    }
  }, [success, redeemedTag]);

  const handleRedeem = async (id?: string) => {
    const redeemTagId = id || tagId;
    if (!redeemTagId.trim()) {
      setError('Please enter a tag ID');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/customer/tags/redeem', { tagId: redeemTagId.trim() });
      setRedeemedTag(res.data.data);
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to activate tag');
    } finally {
      setLoading(false);
    }
  };

  const handleLinkToPet = async () => {
    if (!selectedPetId || !redeemedTag) return;
    setLinking(true);
    setLinkError('');
    try {
      await api.put(`/customer/tags/${redeemedTag._id}/link-pet`, { petId: selectedPetId });
      setLinked(true);
    } catch (err: any) {
      setLinkError(err.response?.data?.error || 'Failed to link tag');
    } finally {
      setLinking(false);
    }
  };

  // Already linked screen
  if (linked) {
    const linkedPet = pets.find((p: any) => p._id === selectedPetId);
    return (
      <View style={styles.container}>
        <View style={styles.successContent}>
          <View style={styles.successIcon}>
            <Text style={styles.successIconText}>✓</Text>
          </View>
          <Text style={styles.successTitle}>All Set!</Text>
          <Text style={styles.successMessage}>
            Tag {redeemedTag?.tagId} is now linked to {linkedPet?.name || 'your pet'}.{'\n\n'}
            Attach the physical tag to your pet's collar.
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.navigate('Pets', { screen: 'PetList', params: { refresh: true } })}
          >
            <Text style={styles.buttonText}>View My Pets</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Success — needs linking
  if (success && redeemedTag && !redeemedTag.petId) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.successContent}>
        <View style={styles.successIcon}>
          <Text style={styles.successIconText}>✓</Text>
        </View>
        <Text style={styles.successTitle}>Tag Activated!</Text>
        <Text style={styles.successMessage}>
          Tag {redeemedTag.tagId} is linked to your account.
        </Text>

        <View style={styles.linkSection}>
          <Text style={styles.linkTitle}>Link Tag to a Pet</Text>
          <Text style={styles.linkDescription}>
            Select which pet this tag belongs to so finders can see your pet's info.
          </Text>

          {pets.length === 0 ? (
            <Text style={styles.noPetsText}>
              No pets found. Create a pet profile first, then come back to link the tag.
            </Text>
          ) : (
            <>
              {pets.map((pet: any) => (
                <TouchableOpacity
                  key={pet._id}
                  style={[
                    styles.petOption,
                    selectedPetId === pet._id && styles.petOptionSelected,
                  ]}
                  onPress={() => setSelectedPetId(pet._id)}
                >
                  <Text style={[
                    styles.petOptionText,
                    selectedPetId === pet._id && styles.petOptionTextSelected,
                  ]}>
                    {pet.name} ({pet.petType || pet.species})
                  </Text>
                  {selectedPetId === pet._id && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}

              {linkError ? (
                <Text style={styles.linkError}>{linkError}</Text>
              ) : null}

              <TouchableOpacity
                style={[styles.button, !selectedPetId && styles.buttonDisabled]}
                onPress={handleLinkToPet}
                disabled={!selectedPetId || linking}
              >
                {linking ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Link to Pet</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>

        <TouchableOpacity style={styles.skipButton} onPress={() => navigation.goBack()}>
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // Success — already linked (replacement)
  if (success && redeemedTag?.petId) {
    return (
      <View style={styles.container}>
        <View style={styles.successContent}>
          <View style={styles.successIcon}>
            <Text style={styles.successIconText}>✓</Text>
          </View>
          <Text style={styles.successTitle}>Tag Activated!</Text>
          <Text style={styles.successMessage}>
            Tag {redeemedTag.tagId} has been linked to your pet automatically (replacement tag).
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.navigate('Pets', { screen: 'PetList', params: { refresh: true } })}
          >
            <Text style={styles.buttonText}>View My Pets</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Activation form
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon}>🏷️</Text>
        <Text style={styles.title}>Activate Your Tag</Text>
        <Text style={styles.message}>
          Enter the tag ID from your PawTag or scan it with your camera.
        </Text>

        <TextInput
          style={styles.input}
          value={tagId}
          onChangeText={setTagId}
          placeholder="PT-123456"
          placeholderTextColor={colors.gray[400]}
          autoCapitalize="characters"
          autoFocus
        />

        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.button, (!tagId.trim() || loading) && styles.buttonDisabled]}
          onPress={() => handleRedeem()}
          disabled={!tagId.trim() || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Activate Tag</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.scanButton}
          onPress={() => navigation.navigate('QRScanner', { mode: 'redeem' })}
        >
          <Text style={styles.scanButtonText}>📷 Scan QR Code</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[6],
  },
  successContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[6],
  },
  icon: {
    fontSize: 48,
    marginBottom: spacing[4],
  },
  title: {
    fontSize: typography.fontSize.h1,
    fontWeight: typography.fontWeight.bold,
    color: colors.gray[900],
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  message: {
    fontSize: typography.fontSize.body,
    color: colors.gray[500],
    textAlign: 'center',
    marginBottom: spacing[6],
    lineHeight: 24,
  },
  input: {
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    fontSize: 18,
    fontFamily: 'monospace',
    textAlign: 'center',
    backgroundColor: colors.white,
    marginBottom: spacing[4],
  },
  errorContainer: {
    backgroundColor: colors.red[50],
    borderWidth: 1,
    borderColor: colors.red[200],
    borderRadius: borderRadius.md,
    padding: spacing[2],
    marginBottom: spacing[4],
    width: '100%',
    maxWidth: 320,
  },
  errorText: {
    color: colors.red[600],
    fontSize: 14,
    textAlign: 'center',
  },
  button: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  scanButton: {
    marginTop: spacing[4],
    padding: spacing[2],
  },
  scanButtonText: {
    color: colors.primary[600],
    fontSize: 14,
    fontWeight: '500',
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.green[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  successIconText: {
    fontSize: 32,
    color: colors.green[600],
  },
  successTitle: {
    fontSize: typography.fontSize.h1,
    fontWeight: typography.fontWeight.bold,
    color: colors.gray[900],
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  successMessage: {
    fontSize: typography.fontSize.body,
    color: colors.gray[500],
    textAlign: 'center',
    marginBottom: spacing[6],
    lineHeight: 24,
  },
  linkSection: {
    width: '100%',
    backgroundColor: colors.blue[50],
    borderWidth: 1,
    borderColor: colors.blue[200],
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[6],
  },
  linkTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.blue[700],
    marginBottom: spacing[1],
  },
  linkDescription: {
    fontSize: 13,
    color: colors.blue[600],
    marginBottom: spacing[4],
  },
  noPetsText: {
    fontSize: 13,
    color: colors.blue[500],
    marginBottom: spacing[2],
  },
  petOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[2],
    borderWidth: 1,
    borderColor: colors.blue[200],
    borderRadius: borderRadius.md,
    marginBottom: spacing[1],
    backgroundColor: colors.white,
  },
  petOptionSelected: {
    borderColor: colors.primary[600],
    backgroundColor: colors.blue[50],
  },
  petOptionText: {
    fontSize: 14,
    color: colors.gray[900],
  },
  petOptionTextSelected: {
    color: colors.primary[600],
    fontWeight: '600',
  },
  checkmark: {
    color: colors.primary[600],
    fontSize: 16,
    fontWeight: '700',
  },
  linkError: {
    color: colors.red[600],
    fontSize: 13,
    marginBottom: spacing[2],
  },
  skipButton: {
    padding: spacing[2],
  },
  skipText: {
    color: colors.gray[400],
    fontSize: 14,
  },
});
