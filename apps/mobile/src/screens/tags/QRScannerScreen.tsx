import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/tokens';
import api from '../../api/client';

interface QRScannerScreenProps {
  navigation: any;
}

export function QRScannerScreen({ navigation }: QRScannerScreenProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);

  const handleBarcodeScanned = async (data: string) => {
    if (!scanning) return;
    setScanning(false);

    // Extract tagId from the scanned URL
    // URLs look like: https://pawtag.co.nz/finder/PT-123456 or just PT-123456
    let tagId = '';
    try {
      const url = new URL(data);
      const pathParts = url.pathname.split('/');
      tagId = pathParts[pathParts.length - 1];
    } catch {
      // If it's not a URL, treat it as a raw tag ID
      tagId = data;
    }

    if (!tagId) {
      Alert.alert('Invalid QR Code', 'Could not read a tag ID from the QR code.', [
        { text: 'Try Again', onPress: () => setScanning(true) },
      ]);
      return;
    }

    // Navigate to redemption with the scanned tagId
    navigation.navigate('RedeemTag', { tagId });
  };

  if (!permission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Requesting camera access...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Camera Access Required</Text>
        <Text style={styles.message}>
          PawTag needs camera access to scan QR codes on your pet's tag.
        </Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanning ? undefined : undefined}
      />
      <View style={styles.overlay}>
        <View style={styles.scanArea} />
        <Text style={styles.instruction}>Point your camera at the QR code on your tag</Text>
      </View>
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.cancelBottomButton} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelBottomText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
    paddingHorizontal: spacing[8],
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: colors.white,
    borderRadius: borderRadius.xl,
    backgroundColor: 'transparent',
  },
  instruction: {
    color: colors.white,
    fontSize: typography.fontSize.body,
    textAlign: 'center',
    marginTop: spacing[6],
    paddingHorizontal: spacing[8],
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing[6],
    paddingBottom: spacing[8],
  },
  cancelBottomButton: {
    alignSelf: 'center',
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
  },
  cancelBottomText: {
    color: colors.white,
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.medium,
  },
  title: {
    fontSize: typography.fontSize.h2,
    fontWeight: typography.fontWeight.bold,
    color: colors.gray[900],
    marginBottom: spacing[3],
    textAlign: 'center',
  },
  message: {
    fontSize: typography.fontSize.body,
    color: colors.gray[500],
    textAlign: 'center',
    marginBottom: spacing[6],
    lineHeight: 24,
  },
  button: {
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[3],
    marginBottom: spacing[3],
  },
  buttonText: {
    color: colors.white,
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.semibold,
  },
  cancelButton: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  cancelButtonText: {
    color: colors.gray[500],
    fontSize: typography.fontSize.body,
  },
  loadingText: {
    fontSize: typography.fontSize.body,
    color: colors.gray[500],
  },
});
