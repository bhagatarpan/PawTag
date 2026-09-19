import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import NfcManager, { NfcTech } from 'react-native-nfc-manager';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, borderRadius } from '../../theme/tokens';

interface NFCScannerScreenProps {
  navigation: any;
}

/**
 * NDEF URI prefix codes.
 * The first byte of a URI record payload indicates the URI scheme.
 * @see https://nfc-wallet.readthedocs.io/en/latest/ndef/record-type-definition.html
 */
const NDEF_URI_PREFIXES: Record<number, string> = {
  0x00: '',                     // No prepend
  0x01: 'http://www.',          // http://www.
  0x02: 'https://www.',         // https://www.
  0x03: 'http://',              // http://
  0x04: 'https://',             // https://
  0x05: 'tel:',                 // tel:
  0x06: 'mailto:',              // mailto:
  0x07: 'ftp://anonymous:anonymous@', // ftp://anonymous:anonymous@
  0x08: 'ftp://ftp.',           // ftp://ftp.
  0x09: 'ftps://',              // ftps://
  0x0A: 'sftp://',              // sftp://
  0x0B: 'smb://',               // smb://
  0x0C: 'nfs://',               // nfs://
  0x0D: 'ftp://',               // ftp://
  0x0E: 'dav://',               // dav://
  0x0F: 'news:',                // news:
  0x10: 'telnet://',            // telnet://
  0x11: 'imap:',                // imap:
  0x12: 'rtsp://',              // rtsp://
  0x13: 'urn:',                 // urn:
  0x14: 'pop:',                 // pop:
  0x15: 'sip:',                 // sip:
  0x16: 'sips:',                // sips:
  0x17: 'tftp:',                // tftp:
  0x18: 'btspp://',             // btspp://
  0x19: 'btl2cap://',           // btl2cap://
  0x1A: 'btgoep://',            // btgoep://
  0x1B: 'tcpobex://',           // tcpobex://
  0x1C: 'irdaobex://',          // irdaobex://
  0x1D: 'file://',              // file://
  0x1E: 'urn:epc:id:',          // urn:epc:id:
  0x1F: 'urn:epc:tag:',         // urn:epc:tag:
  0x20: 'urn:epc:pat:',         // urn:epc:pat:
  0x21: 'urn:epc:raw:',         // urn:epc:raw:
  0x22: 'urn:epc:',             // urn:epc:
  0x23: 'urn:nfc:',             // urn:nfc:
};

/**
 * Decode an NDEF URI record payload to a full URL string.
 *
 * NDEF URI records have a prefix byte followed by the URI body.
 * For example, a PawTag QR URL like "https://pawtag.co.nz/finder/PT-123456"
 * would be encoded as: [0x04, 'pawtag.co.nz/finder/PT-123456']
 * where 0x04 = 'https://' prefix.
 */
function decodeNdefUriPayload(payload: number[]): string {
  if (payload.length === 0) return '';

  const prefixCode = payload[0];
  const prefix = NDEF_URI_PREFIXES[prefixCode] ?? '';
  const uriBody = String.fromCharCode(...payload.slice(1));

  return prefix + uriBody;
}

export function NFCScannerScreen({ navigation }: NFCScannerScreenProps) {
  const [supported, setSupported] = useState(true);
  const [reading, setReading] = useState(false);
  const insets = useSafeAreaInsets();

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
        // Look for a URL record (type 'U')
        for (const record of ndefMessage) {
          if (record.type === 'U') {
            // URI record — decode with prefix byte semantics
            const url = decodeNdefUriPayload(record.payload);
            try {
              const parsedUrl = new URL(url);
              const pathParts = parsedUrl.pathname.split('/');
              tagId = pathParts[pathParts.length - 1];
            } catch {
              // Not a valid URL, try to extract tag ID directly
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
        throw new Error('Could not read tag ID from NFC tag');
      }

      NfcManager.cancelTechnologyRequest();
      navigation.navigate('RedeemTag', { tagId });
    } catch (error: any) {
      // Show meaningful error for non-cancel scenarios
      if (error.message !== 'User cancelled') {
        Alert.alert(
          'NFC Read Error',
          error.message || 'Failed to read NFC tag. Please try again.',
          [
            { text: 'Try Again', onPress: () => setReading(false) },
            { text: 'Cancel', onPress: () => navigation.goBack() },
          ]
        );
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

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing[6] }]}>
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
