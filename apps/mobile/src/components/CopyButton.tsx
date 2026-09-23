import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { colors } from '../theme/tokens';

interface CopyButtonProps {
  text: string;
  label?: string;
  size?: number;
}

/**
 * Mobile copy-to-clipboard button.
 * Uses expo-clipboard on native, fallback on web.
 */
export function CopyButton({ text, label = 'Copied', size = 14 }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (Platform.OS === 'web') {
        // Web fallback
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      } else {
        // Native: use Clipboard API
        const Clipboard = require('expo-clipboard');
        await Clipboard.setStringAsync(text);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.warn('Failed to copy:', err);
    }
  };

  return (
    <TouchableOpacity
      onPress={handleCopy}
      style={styles.button}
      accessibilityLabel={label}
      accessibilityRole="button"
    >
      <Text style={[styles.icon, { fontSize: size }, copied && styles.copied]}>
        {copied ? '✓' : '📋'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 4,
    marginLeft: 6,
  },
  icon: {
    color: colors.gray[400],
  },
  copied: {
    color: colors.green[500],
  },
});
