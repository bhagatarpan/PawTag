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
} from 'react-native';
import api from '../api/client';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/tokens';

interface ForgotPasswordScreenProps {
  navigation: any;
}

export function ForgotPasswordScreen({ navigation }: ForgotPasswordScreenProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.logoContainer}>
          <View style={styles.logoIcon}>
            <Text style={styles.logoEmoji}>🐾</Text>
          </View>
        </View>

        <Text style={styles.title}>Forgot your password?</Text>
        <Text style={styles.subtitle}>Enter your email and we'll send you a reset link.</Text>

        <View style={styles.card}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {success ? (
            <View style={styles.successContainer}>
              <View style={styles.successIcon}>
                <Text style={styles.successIconText}>✓</Text>
              </View>
              <Text style={styles.successTitle}>Check your email</Text>
              <Text style={styles.successMessage}>
                If an account exists with <Text style={{ fontWeight: typography.fontWeight.semibold }}>{email}</Text>,
                we've sent a password reset link. Check your inbox and follow the instructions.
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.backToLogin}>← Back to Login</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email address</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
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
                  <Text style={styles.buttonText}>Send Reset Link</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigation.navigate('Login')}
                style={styles.loginLink}
              >
                <Text style={styles.loginLinkText}>Remember your password? Sign in</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[8],
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  logoIcon: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoEmoji: {
    fontSize: 32,
  },
  title: {
    fontSize: typography.fontSize.h2,
    fontWeight: typography.fontWeight.bold,
    color: colors.gray[900],
    textAlign: 'center',
    marginBottom: spacing[1],
  },
  subtitle: {
    fontSize: typography.fontSize.body,
    color: colors.gray[500],
    textAlign: 'center',
    marginBottom: spacing[6],
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius['2xl'],
    padding: spacing[6],
    ...shadows.subtle,
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
  },
  button: {
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.xl,
    paddingVertical: spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.white,
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.semibold,
  },
  loginLink: {
    alignItems: 'center',
    marginTop: spacing[4],
  },
  loginLinkText: {
    fontSize: typography.fontSize.bodySm,
    color: colors.gray[500],
  },
  // Success styles
  successContainer: {
    alignItems: 'center',
    paddingVertical: spacing[4],
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.green[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  successIconText: {
    fontSize: 32,
    color: colors.green[600],
    fontWeight: typography.fontWeight.bold,
  },
  successTitle: {
    fontSize: typography.fontSize.h3,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[900],
    marginBottom: spacing[2],
  },
  successMessage: {
    fontSize: typography.fontSize.body,
    color: colors.gray[500],
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing[6],
  },
  backToLogin: {
    fontSize: typography.fontSize.body,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
});
