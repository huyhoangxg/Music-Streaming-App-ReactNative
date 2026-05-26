import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import Constants from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';

const debuggerHost = Constants.expoConfig?.hostUri;
const localhost = debuggerHost ? debuggerHost.split(':')[0] : 'localhost';
const API_URL = `http://${localhost}:5000`;

const COLORS = {
  baseBlack: '#000000',
  accentOrange: '#ff6a00',
  neutralDarkGrey: '#2A2A2A',
  neutralMidGrey: '#3A3A3A',
  neutralLightGrey: '#A0A0A0',
  whiteText: '#FFFFFF',
  errorRed: '#FF4D4D',
  successGreen: '#4CAF50',
};

// ─── Shared input component ───────────────────────────────────────────────────
const InputItem = ({
  iconName,
  placeholder,
  secureTextEntry,
  onTextChange,
  value,
  keyboardType,
}: {
  iconName: string;
  placeholder: string;
  secureTextEntry?: boolean;
  onTextChange: (v: string) => void;
  value: string;
  keyboardType?: 'default' | 'email-address';
}) => (
  <View style={styles.inputWrapper}>
    <MaterialIcons
      name={iconName as any}
      size={20}
      color={COLORS.neutralLightGrey}
      style={styles.inputIcon}
    />
    <TextInput
      style={styles.inputField}
      placeholder={placeholder}
      placeholderTextColor={COLORS.neutralLightGrey}
      secureTextEntry={secureTextEntry}
      autoCapitalize="none"
      onChangeText={onTextChange}
      value={value}
      keyboardType={keyboardType ?? 'default'}
    />
  </View>
);

// ─── Step indicator ───────────────────────────────────────────────────────────
const StepIndicator = ({ current }: { current: 1 | 2 | 3 }) => (
  <View style={styles.stepRow}>
    {[1, 2, 3].map((s) => (
      <React.Fragment key={s}>
        <View
          style={[
            styles.stepDot,
            s < current && styles.stepDotDone,
            s === current && styles.stepDotActive,
          ]}
        >
          {s < current ? (
            <MaterialIcons name="check" size={11} color={COLORS.baseBlack} />
          ) : (
            <Text style={[styles.stepDotText, s === current && { color: COLORS.baseBlack }]}>
              {s}
            </Text>
          )}
        </View>
        {s < 3 && (
          <View style={[styles.stepLine, s < current && styles.stepLineDone]} />
        )}
      </React.Fragment>
    ))}
  </View>
);

// ─── Main screen ──────────────────────────────────────────────────────────────
type Step = 1 | 2 | 3;

const STEP_TITLES: Record<Step, string> = {
  1: 'Forgot\nPassword',
  2: 'Check Your\nEmail',
  3: 'New\nPassword',
};

const STEP_SUBTITLES: Record<Step, string> = {
  1: "Enter the email address linked to your account and we'll send you a reset code.",
  2: "We sent a 6-digit code to your email. Enter it below.",
  3: 'Choose a strong new password.',
};

const ForgotPasswordScreen = () => {
  const navigation = useNavigation<any>();

  const [step, setStep] = useState<Step>(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const otpRefs = useRef<(TextInput | null)[]>([]);
  const resendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── OTP helpers ─────────────────────────────────────────────────────────────
  const handleOtpChange = (text: string, index: number) => {
    // allow pasting full 6-digit code into first box
    if (text.length === 6 && index === 0) {
      const digits = text.replace(/\D/g, '').slice(0, 6).split('');
      const next = [...otp];
      digits.forEach((d, i) => { next[i] = d; });
      setOtp(next);
      otpRefs.current[5]?.focus();
      return;
    }
    const digit = text.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  // ── Cooldown timer ───────────────────────────────────────────────────────────
  const startResendCooldown = (seconds = 60) => {
    setResendCooldown(seconds);
    if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    resendTimerRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(resendTimerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // ── Step 1: send reset code ──────────────────────────────────────────────────
  const handleSendCode = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      Alert.alert('Missing info', 'Please enter your email address.');
      return;
    }

    setIsLoading(true);
    try {
      await axios.post(`${API_URL}/api/auth/forgot-password`, { email: trimmed });
      startResendCooldown(60);
      setStep(2);
    } catch (error: any) {
      const status = error.response?.status;
      const msg = error.response?.data?.message;
      if (status === 429) {
        Alert.alert('Too many requests', msg || 'Please wait before trying again.');
      } else {
        Alert.alert('Error', msg || 'Could not send reset code. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ── Resend code (from step 2) ────────────────────────────────────────────────
  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setIsLoading(true);
    try {
      await axios.post(`${API_URL}/api/auth/forgot-password`, {
        email: email.trim().toLowerCase(),
      });
      startResendCooldown(60);
      Alert.alert('Code sent', 'A new reset code has been sent to your email.');
    } catch (error: any) {
      const msg = error.response?.data?.message;
      Alert.alert('Error', msg || 'Could not resend code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Step 2: verify OTP → go to step 3 ───────────────────────────────────────
  const handleVerifyOtp = () => {
    const code = otp.join('');
    if (code.length < 6) {
      Alert.alert('Incomplete code', 'Please enter all 6 digits.');
      return;
    }
    setStep(3);
  };

  // ── Step 3: reset password ───────────────────────────────────────────────────
  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Missing info', 'Please fill in both password fields.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Too short', 'Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      await axios.post(`${API_URL}/api/auth/reset-password`, {
        email: email.trim().toLowerCase(),
        code: otp.join(''),
        newPassword,
      });

      Alert.alert(
        'Password reset! 🎉',
        'Your password has been updated. Please log in with your new password.',
        [{ text: 'Log in', onPress: () => navigation.replace('Login') }],
      );
    } catch (error: any) {
      const status = error.response?.status;
      const msg = error.response?.data?.message;
      if (status === 400) {
        // Bad OTP → go back to OTP step
        Alert.alert(
          'Invalid code',
          msg || 'The reset code is invalid or has expired.',
          [
            { text: 'Try again', onPress: () => { setOtp(['', '', '', '', '', '']); setStep(2); } },
          ],
        );
      } else if (status === 429) {
        Alert.alert('Too many attempts', msg || 'Please wait before trying again.');
      } else {
        Alert.alert('Error', msg || 'Could not reset password. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ── Back button logic ────────────────────────────────────────────────────────
  const handleBack = () => {
    if (step === 1) {
      navigation.goBack();
    } else if (step === 2) {
      setStep(1);
    } else {
      setStep(2);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <MaterialIcons name="arrow-back-ios" size={20} color={COLORS.whiteText} />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
          </View>

          {/* Step indicator */}
          <StepIndicator current={step} />

          {/* Title */}
          <View style={styles.titleContainer}>
            <Text style={styles.titleText}>{STEP_TITLES[step]}</Text>
            <Text style={styles.subtitleText}>{STEP_SUBTITLES[step]}</Text>
          </View>

          {/* ── STEP 1: email ── */}
          {step === 1 && (
            <View style={styles.formContainer}>
              <InputItem
                iconName="email"
                placeholder="Email address"
                keyboardType="email-address"
                onTextChange={setEmail}
                value={email}
              />
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleSendCode}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={COLORS.baseBlack} />
                ) : (
                  <Text style={styles.primaryButtonText}>Send Reset Code</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* ── STEP 2: OTP ── */}
          {step === 2 && (
            <View style={styles.formContainer}>
              <Text style={styles.emailHint}>
                Sent to <Text style={styles.emailHighlight}>{email}</Text>
              </Text>

              {/* 6 OTP boxes */}
              <View style={styles.otpRow}>
                {otp.map((digit, i) => (
                  <TextInput
                    key={i}
                    ref={(r) => { otpRefs.current[i] = r; }}
                    style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
                    value={digit}
                    onChangeText={(t) => handleOtpChange(t, i)}
                    onKeyPress={(e) => handleOtpKeyPress(e, i)}
                    keyboardType="number-pad"
                    maxLength={i === 0 ? 6 : 1}
                    textAlign="center"
                    selectTextOnFocus
                    caretHidden
                  />
                ))}
              </View>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleVerifyOtp}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={COLORS.baseBlack} />
                ) : (
                  <Text style={styles.primaryButtonText}>Verify Code</Text>
                )}
              </TouchableOpacity>

              {/* Resend */}
              <View style={styles.resendRow}>
                <Text style={styles.resendLabel}>Didn't receive it? </Text>
                <TouchableOpacity onPress={handleResend} disabled={resendCooldown > 0 || isLoading}>
                  <Text
                    style={[
                      styles.resendLink,
                      (resendCooldown > 0 || isLoading) && styles.resendLinkDisabled,
                    ]}
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── STEP 3: new password ── */}
          {step === 3 && (
            <View style={styles.formContainer}>
              <InputItem
                iconName="lock-outline"
                placeholder="New password"
                secureTextEntry
                onTextChange={setNewPassword}
                value={newPassword}
              />
              <InputItem
                iconName="lock"
                placeholder="Confirm new password"
                secureTextEntry
                onTextChange={setConfirmPassword}
                value={confirmPassword}
              />

              {/* Password strength hint */}
              {newPassword.length > 0 && (
                <View style={styles.strengthRow}>
                  {[1, 2, 3, 4].map((lvl) => {
                    const len = newPassword.length;
                    const filled = len >= lvl * 3;
                    const color =
                      len < 6
                        ? COLORS.errorRed
                        : len < 10
                        ? COLORS.accentOrange
                        : COLORS.successGreen;
                    return (
                      <View
                        key={lvl}
                        style={[
                          styles.strengthBar,
                          filled && { backgroundColor: color },
                        ]}
                      />
                    );
                  })}
                  <Text style={styles.strengthLabel}>
                    {newPassword.length < 6
                      ? 'Too short'
                      : newPassword.length < 10
                      ? 'Fair'
                      : 'Strong'}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleResetPassword}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={COLORS.baseBlack} />
                ) : (
                  <Text style={styles.primaryButtonText}>Reset Password</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.baseBlack,
    paddingHorizontal: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 15,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    color: COLORS.whiteText,
    fontSize: 14.5,
    marginLeft: 5,
  },
  // Step indicator
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.neutralDarkGrey,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.neutralLightGrey,
  },
  stepDotActive: {
    backgroundColor: COLORS.accentOrange,
    borderColor: COLORS.accentOrange,
  },
  stepDotDone: {
    backgroundColor: COLORS.accentOrange,
    borderColor: COLORS.accentOrange,
  },
  stepDotText: {
    color: COLORS.neutralLightGrey,
    fontSize: 11,
    fontWeight: '700',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: COLORS.neutralDarkGrey,
    marginHorizontal: 4,
  },
  stepLineDone: {
    backgroundColor: COLORS.accentOrange,
  },
  // Title
  titleContainer: {
    marginTop: 20,
    marginBottom: 10,
  },
  titleText: {
    color: COLORS.whiteText,
    fontSize: 38,
    fontWeight: '700',
    lineHeight: 44,
  },
  subtitleText: {
    color: COLORS.neutralLightGrey,
    fontSize: 14,
    marginTop: 10,
    lineHeight: 20,
  },
  // Form
  formContainer: {
    marginTop: 20,
    gap: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.neutralDarkGrey,
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 8,
  },
  inputField: {
    flex: 1,
    color: COLORS.whiteText,
    fontSize: 14.5,
  },
  // Primary button
  primaryButton: {
    backgroundColor: COLORS.accentOrange,
    borderRadius: 50,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
    color: COLORS.baseBlack,
    fontSize: 16,
    fontWeight: '700',
  },
  // Email hint
  emailHint: {
    color: COLORS.neutralLightGrey,
    fontSize: 13.5,
    textAlign: 'center',
    marginBottom: -4,
  },
  emailHighlight: {
    color: COLORS.whiteText,
    fontWeight: '600',
  },
  // OTP
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  otpBox: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: COLORS.neutralDarkGrey,
    borderRadius: 12,
    color: COLORS.whiteText,
    fontSize: 22,
    fontWeight: '700',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  otpBoxFilled: {
    borderColor: COLORS.accentOrange,
    backgroundColor: COLORS.neutralMidGrey,
  },
  // Resend
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -4,
  },
  resendLabel: {
    color: COLORS.neutralLightGrey,
    fontSize: 13.5,
  },
  resendLink: {
    color: COLORS.accentOrange,
    fontSize: 13.5,
    fontWeight: '700',
  },
  resendLinkDisabled: {
    color: COLORS.neutralLightGrey,
  },
  // Password strength
  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -4,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.neutralDarkGrey,
  },
  strengthLabel: {
    color: COLORS.neutralLightGrey,
    fontSize: 11,
    width: 50,
  },
});

export default ForgotPasswordScreen;
