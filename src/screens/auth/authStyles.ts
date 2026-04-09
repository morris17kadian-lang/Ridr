import { StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

export const authStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 48,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: colors.text,
    marginBottom: 10,
  },
  welcomeSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    marginBottom: 28,
  },
  /** Login | Sign Up pill */
  modeToggleTrack: {
    flexDirection: 'row',
    backgroundColor: '#f1f1f1',
    borderRadius: 999,
    padding: 4,
    marginBottom: 32,
  },
  modeToggleHalf: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  modeToggleHalfActive: {
    backgroundColor: colors.primaryDark,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  modeToggleText: {
    fontSize: 15,
    fontWeight: '700',
  },
  modeToggleTextActive: {
    color: '#ffffff',
  },
  modeToggleTextIdle: {
    color: colors.text,
    opacity: 0.75,
  },
  fieldBlock: {
    marginBottom: 20,
  },
  /** Use inside `nameRow` so paired fields don’t stack double margin. */
  fieldBlockInRow: {
    marginBottom: 0,
  },
  nameRow: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  nameRowHalf: {
    flex: 1,
    minWidth: 0,
    marginRight: 10,
  },
  nameRowHalfLast: {
    marginRight: 0,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 8,
    marginLeft: 4,
  },
  fieldShell: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#e6e6e6',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 4,
    minHeight: 54,
  },
  fieldIconLeft: {
    marginRight: 12,
    opacity: 0.85,
  },
  fieldShellFocused: {
    borderColor: colors.accent,
    backgroundColor: '#fffef7',
  },
  fieldInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    paddingVertical: 12,
  },
  eyeBtn: {
    padding: 8,
    marginRight: -4,
  },
  primaryBtn: {
    backgroundColor: colors.primaryDark,
    borderRadius: 999,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 56,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  socialDivider: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 12,
  },
  socialBtn: {
    minHeight: 52,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e4e4e4',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginBottom: 10,
  },
  socialBtnDisabled: {
    backgroundColor: '#f5f5f5',
    borderColor: '#ececec',
  },
  socialBtnText: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '700',
    marginLeft: 10,
  },
  socialBtnTextDisabled: {
    fontSize: 15,
    color: '#9c9c9c',
    fontWeight: '700',
    marginLeft: 10,
  },
  forgotRow: {
    alignSelf: 'flex-end',
    marginTop: 8,
    marginBottom: 8,
    paddingVertical: 4,
  },
  forgotText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  footerNote: {
    marginTop: 28,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textMuted,
    textAlign: 'center',
  },
  footerLink: {
    fontWeight: '700',
    color: colors.text,
  },
  /** Forgot / reset headers */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginBottom: 8,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginRight: 40,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    marginBottom: 28,
    lineHeight: 22,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: '500',
    color: '#4a4a4a',
    marginBottom: 16,
  },
  linkRow: {
    marginTop: 20,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
  },
  linkAccent: {
    color: colors.text,
    fontWeight: '700',
  },
});
