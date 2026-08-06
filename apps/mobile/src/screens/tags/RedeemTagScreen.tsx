import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
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

  useEffect(() => {
    if (initialTagId) {
      handleRedeem(initialTagId);
    }
  }, [initialTagId]);

  const handleRedeem = async (id?: string) => {
    const redeemTagId = id || tagId;
    if (!redeemTagId.trim()) {
      setError('Please enter a tag ID');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await api.post('/customer/tags/redeem', { tagId: redeemTagId.trim() });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to activate tag');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <View style={styles.container}>
        <View style={styles.successContent}>
          <View style={styles.successIcon}>
            <Text style={styles.successIconText}>✓</Text>
          </View>
          <Text style={styles.successTitle}>Tag Activated!</Text>
          <Text style={styles.successMessage}>
            Your tag has been successfully activated. You can now link it to one of your pets.
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() =>
              navigation.navigate('Pets', {
                screen: 'PetList',
                params: { refresh: true },
              })
            }
          >
            <Text style={styles.buttonText}>View My Pets</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.scanAnother} onPress={() => {
            setSuccess(false);
            setTagId('');
          }}>
            <Text style={styles.scanAnotherText}>Activate Another Tag</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon}>🏷️</Text>
        <Text style={styles.title}>Activate Your Tag</Text>
        <Text style={styles.message}>
          Enter the tag ID from your PawTag or scan it with your camera.
        </Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Tag ID</Text>
          <TextInput
            style={styles.input}
            value={tagId}
            onChangeText={setTagId}
            placeholder="e.g. PT-123456"
            autoCapitalize="characters"
            autoCorrect={false}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={() => handleRedeem()}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>Activate Tag</Text>
          )}
        </TouchableOpacity>

        <View style={styles.scanOptions}>
          <TouchableOpacity
            style={styles.scanOption}
            onPress={() => navigation.navigate('QRScanner')}
          >
            <Text style={styles.scanOptionIcon}>📷</Text>
            <Text style={styles.scanOptionText}>Scan QR Code</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.scanOption}
            onPress={() => navigation.navigate('NFCScanner')}
          >
            <Text style={styles.scanOptionIcon}>📡</Text>
            <Text style={styles.scanOptionText}>Tap NFC Tag</Text>
          </TouchableOpacity>
        </View>
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
    padding: spacing[6],
    justifyContent: 'center',
    alignItems: 'center',
  },
  successContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[8],
  },
  icon: {
    fontSize: 64,
    marginBottom: spacing[4],
  },
  title: {
    fontSize: typography.fontSize.h1,
    fontWeight: typography.fontWeight.bold,
    color: colors.gray[900],
    marginBottom: spacing[2],
    textAlign: 'center',
  },
  message: {
    fontSize: typography.fontSize.body,
    color: colors.gray[500],
    textAlign: 'center',
    marginBottom: spacing[6],
    lineHeight: 24,
  },
  errorText: {
    fontSize: typography.fontSize.bodySm,
    color: colors.red[600],
    backgroundColor: colors.red[50],
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[4],
    textAlign: 'center',
    width: '100%',
  },
  inputGroup: {
    width: '100%',
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
    fontSize: typography.fontSize.h3,
    fontFamily: typography.fontFamily.mono,
    textAlign: 'center',
    letterSpacing: 2,
    backgroundColor: colors.white,
  },
  button: {
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.xl,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[8],
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    width: '100%',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.white,
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.semibold,
  },
  scanOptions: {
    flexDirection: 'row',
    gap: spacing[4],
    marginTop: spacing[8],
  },
  scanOption: {
    alignItems: 'center',
    padding: spacing[4],
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.gray[200],
    minWidth: 120,
  },
  scanOptionIcon: {
    fontSize: 32,
    marginBottom: spacing[2],
  },
  scanOptionText: {
    fontSize: typography.fontSize.bodySm,
    color: colors.gray[700],
    fontWeight: typography.fontWeight.medium,
  },
  // Success styles
  successIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.green[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  successIconText: {
    fontSize: 48,
    color: colors.green[600],
    fontWeight: typography.fontWeight.bold,
  },
  successTitle: {
    fontSize: typography.fontSize.h2,
    fontWeight: typography.fontWeight.bold,
    color: colors.gray[900],
    marginBottom: spacing[3],
  },
  successMessage: {
    fontSize: typography.fontSize.body,
    color: colors.gray[500],
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing[6],
  },
  scanAnother: {
    marginTop: spacing[4],
  },
  scanAnotherText: {
    fontSize: typography.fontSize.body,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
});
