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
import { useAuth } from '../lib/auth-context';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/tokens';

interface LoginScreenProps {
  navigation: any;
}

export function LoginScreen({ navigation }: LoginScreenProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // MFA state
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaTempToken, setMfaTempToken] = useState('');
  const [mfaMaskedEmail, setMfaMaskedEmail] = useState('');
  const [mfaOtp, setMfaOtp] = useState('');
  const [mfaExpiry, setMfaExpiry] = useState(300);
  const [mfaLoading, setMfaLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.mfaRequired) {
        setMfaRequired(true);
        setMfaTempToken(result.tempToken!);
        setMfaMaskedEmail(result.maskedEmail!);
        setMfaExpiry(result.expiresIn || 300);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaVerify = async () => {
    if (mfaOtp.length !== 6) return;
    setMfaLoading(true);
    setError('');
    try {
      const api = (await import('../api/client')).default;
      const res = await api.post('/auth/mfa/verify', {
        tempToken: mfaTempToken,
        otp: mfaOtp,
      });
      const { token, refreshToken, user } = res.data.data;
      const { setTokens } = await import('../lib/tokenStorage');
      await setTokens(token, refreshToken);
      // User will be set by the auth context on next refresh
    } catch (err: any) {
      const code = err.response?.data?.code;
      if (code === 'OTP_EXPIRED' || code === 'OTP_MAX_ATTEMPTS') {
        setError(err.response?.data?.error || 'Code expired. Please request a new one.');
      } else {
        setError(err.response?.data?.error || 'Invalid code. Please try again.');
      }
      setMfaOtp('');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleResendOtp = async () => {
    try {
      const api = (await import('../api/client')).default;
      await api.post('/auth/mfa/send-otp', { tempToken: mfaTempToken });
      setMfaExpiry(300);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to resend code.');
    }
  };

  // MFA OTP screen
  if (mfaRequired) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <Text style={styles.mfaTitle}>Two-Factor Verification</Text>
            <Text style={styles.mfaSubtitle}>Enter the code sent to your email</Text>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Text style={styles.mfaEmailLabel}>A verification code has been sent to</Text>
            <Text style={styles.mfaEmail}>{mfaMaskedEmail}</Text>

            <TextInput
              style={styles.otpInput}
              value={mfaOtp}
              onChangeText={(t) => setMfaOtp(t.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />

            <TouchableOpacity
              style={[styles.button, (mfaLoading || mfaOtp.length !== 6) && styles.buttonDisabled]}
              onPress={handleMfaVerify}
              disabled={mfaLoading || mfaOtp.length !== 6}
            >
              {mfaLoading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.buttonText}>Verify Code</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={handleResendOtp} style={styles.linkButton}>
              <Text style={styles.linkText}>Didn't receive the code? Resend</Text>
            </TouchableOpacity>

            <Text style={styles.mfaTimer}>
              Code expires in {Math.floor(mfaExpiry / 60)}:{(mfaExpiry % 60).toString().padStart(2, '0')}
            </Text>

            <TouchableOpacity
              onPress={() => {
                setMfaRequired(false);
                setMfaOtp('');
                setError('');
              }}
              style={styles.backButton}
            >
              <Text style={styles.backText}>← Back to login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Login screen
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
          <Text style={styles.logoText}>
            Paw<Text style={styles.logoAccent}>Tag</Text>
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to manage your pets</Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
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

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            onPress={() => navigation.navigate('ForgotPassword')}
            style={styles.forgotButton}
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.footerLink}>Create one</Text>
          </TouchableOpacity>
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
    marginBottom: spacing[8],
  },
  logoIcon: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  logoEmoji: {
    fontSize: 32,
  },
  logoText: {
    fontSize: typography.fontSize.h1,
    fontWeight: typography.fontWeight.bold,
    color: colors.gray[900],
  },
  logoAccent: {
    color: colors.primary[600],
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius['2xl'],
    padding: spacing[6],
    ...shadows.subtle,
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
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: spacing[4],
  },
  forgotText: {
    fontSize: typography.fontSize.bodySm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing[6],
  },
  footerText: {
    fontSize: typography.fontSize.body,
    color: colors.gray[500],
  },
  footerLink: {
    fontSize: typography.fontSize.body,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.semibold,
  },
  // MFA styles
  mfaTitle: {
    fontSize: typography.fontSize.h2,
    fontWeight: typography.fontWeight.bold,
    color: colors.gray[900],
    textAlign: 'center',
    marginBottom: spacing[1],
  },
  mfaSubtitle: {
    fontSize: typography.fontSize.body,
    color: colors.gray[500],
    textAlign: 'center',
    marginBottom: spacing[6],
  },
  mfaEmailLabel: {
    fontSize: typography.fontSize.bodySm,
    color: colors.gray[500],
    textAlign: 'center',
  },
  mfaEmail: {
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.medium,
    color: colors.gray[900],
    textAlign: 'center',
    marginBottom: spacing[6],
  },
  otpInput: {
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: typography.fontSize.h2,
    fontFamily: typography.fontFamily.mono,
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: spacing[4],
  },
  linkButton: {
    alignItems: 'center',
    marginTop: spacing[4],
  },
  linkText: {
    fontSize: typography.fontSize.bodySm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  mfaTimer: {
    fontSize: typography.fontSize.caption,
    color: colors.gray[400],
    textAlign: 'center',
    marginTop: spacing[3],
  },
  backButton: {
    alignItems: 'center',
    marginTop: spacing[6],
  },
  backText: {
    fontSize: typography.fontSize.bodySm,
    color: colors.gray[500],
  },
});
