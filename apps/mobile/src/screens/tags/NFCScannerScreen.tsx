import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import NfcManager, { NfcTech } from 'react-native-nfc-manager';
import { colors, typography, spacing, borderRadius } from '../../theme/tokens';

interface NFCScannerScreenProps {
  navigation: any;
}

export function NFCScannerScreen({ navigation }: NFCScannerScreenProps) {
  const [supported, setSupported] = useState(true);
  const [reading, setReading] = useState(false);

  useEffect(() => {
    NfcManager.isSupported().then((isSupported) => {
      setSupported(isSupported);
      if (isSupported) {
        NfcManager.start();
      }
    });
    return () => {
      NfcManager.cancelTechnologyRequest().catch(() => {});
    };
  }, []);

  const readNFC = async () => {
    setReading(true);
    try {
      await NfcManager.requestTechnology([NfcTech.Ndef]);
      const tag = await NfcManager.getTag();
      if (!tag) {
        throw new Error('No tag detected');
      }

      // Try to read NDEF message from the tag
      const ndefMessage = tag.ndefMessage;
      let tagId = '';

      if (ndefMessage && ndefMessage.length > 0) {
        // Look for a URL record
        for (const record of ndefMessage) {
          if (record.type === 'U') {
            // URI record
            const payload = record.payload;
            // The payload contains the URL — extract tagId from it
            const url = String.fromCharCode(...payload);
            try {
              const parsedUrl = new URL(url);
              const pathParts = parsedUrl.pathname.split('/');
              tagId = pathParts[pathParts.length - 1];
            } catch {
              tagId = url;
            }
            break;
          }
        }
      }

      if (!tagId) {
        // Fallback: use the tag's ID
        tagId = tag.id || '';
      }

      if (!tagId) {
        throw new Error('Could not read tag ID');
      }

      NfcManager.cancelTechnologyRequest();
      navigation.navigate('RedeemTag', { tagId });
    } catch (error: any) {
      if (error.message !== 'User cancelled') {
        // User cancelled scanning
      }
    } finally {
      setReading(false);
    }
  };

  if (!supported) {
    return (
      <View style={styles.centered}>
        <Text style={styles.icon}>📡</Text>
        <Text style={styles.title}>NFC Not Available</Text>
        <Text style={styles.message}>
          Your device does not support NFC. You can still activate your tag using the QR code scanner.
        </Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.nfcArea}>
        <Text style={styles.nfcIcon}>📡</Text>
        <Text style={styles.title}>Tap Your Tag</Text>
        <Text style={styles.message}>
          Hold your phone near the NFC tag on your pet's collar or tag.
        </Text>

        {reading && (
          <View style={styles.readingIndicator}>
            <Text style={styles.readingText}>Scanning...</Text>
          </View>
        )}
      </View>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.scanButton, reading && styles.buttonDisabled]}
          onPress={readNFC}
          disabled={reading}
        >
          <Text style={styles.scanButtonText}>
            {reading ? 'Scanning...' : 'Start NFC Scan'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
    paddingHorizontal: spacing[8],
  },
  nfcArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[8],
  },
  nfcIcon: {
    fontSize: 80,
    marginBottom: spacing[6],
  },
  icon: {
    fontSize: 64,
    marginBottom: spacing[4],
  },
  title: {
    fontSize: typography.fontSize.h1,
    fontWeight: typography.fontWeight.bold,
    color: colors.gray[900],
    marginBottom: spacing[3],
    textAlign: 'center',
  },
  message: {
    fontSize: typography.fontSize.body,
    color: colors.gray[500],
    textAlign: 'center',
    lineHeight: 24,
  },
  readingIndicator: {
    marginTop: spacing[6],
    padding: spacing[4],
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.xl,
  },
  readingText: {
    fontSize: typography.fontSize.body,
    color: colors.primary[700],
    fontWeight: typography.fontWeight.medium,
  },
  bottomBar: {
    padding: spacing[6],
    paddingBottom: spacing[8],
  },
  scanButton: {
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.xl,
    paddingVertical: spacing[4],
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  scanButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.semibold,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  cancelButton: {
    paddingVertical: spacing[3],
    alignItems: 'center',
  },
  cancelButtonText: {
    color: colors.gray[500],
    fontSize: typography.fontSize.body,
  },
  button: {
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[3],
    marginTop: spacing[6],
  },
  buttonText: {
    color: colors.white,
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.semibold,
  },
});
