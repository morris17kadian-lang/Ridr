import { StyleSheet } from 'react-native';
import { useMemo } from 'react';
import type { ThemeColors } from '../../theme/ThemeProvider';
import { useAppTheme } from '../../theme/ThemeProvider';

export function createAuthStyles(colors: ThemeColors) {
  return StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scrollContent: {
    paddingHorizontal: 0,
    paddingTop: 8,
    paddingBottom: 48,
    flexGrow: 1,
    justifyContent: 'center',
  },
  /** Rounded panel: no horizontal padding so inputs can span full card width. */
  formCard: {
    marginHorizontal: 22,
    paddingVertical: 24,
    paddingHorizontal: 0,
    backgroundColor: colors.card,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  /** Inset for toggle, buttons, and secondary rows — not for full-bleed field shells. */
  formCardSection: {
    paddingHorizontal: 22,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: colors.text,
    marginBottom: 10,
  },
  logoWrapper: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 28,
    paddingHorizontal: 22,
  },
  logoImage: {
    width: 80,
    height: 80,
    resizeMode: 'contain',
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
    backgroundColor: colors.inputBg,
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
    backgroundColor: colors.primary,
    shadowColor: colors.text,
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
    color: colors.textOnPrimary,
  },
  modeToggleTextIdle: {
    color: colors.text,
    opacity: 0.75,
  },
  fieldBlock: {
    marginBottom: 20,
    alignSelf: 'stretch',
  },
  /** Use inside `nameRow` so paired fields don’t stack double margin. */
  fieldBlockInRow: {
    marginBottom: 0,
  },
  nameRow: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'flex-start',
    paddingHorizontal: 22,
    gap: 10,
  },
  nameRowHalf: {
    flex: 1,
    minWidth: 0,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 8,
    paddingHorizontal: 22,
  },
  fieldLabelCompact: {
    paddingHorizontal: 0,
    marginLeft: 4,
  },
  fieldShell: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 4,
    minHeight: 54,
    alignSelf: 'stretch',
    width: '100%',
  },
  fieldIconLeft: {
    marginRight: 12,
    opacity: 0.85,
  },
  fieldShellFocused: {
    borderColor: colors.accent,
    backgroundColor: colors.surface,
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
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 56,
  },
  primaryBtnText: {
    color: colors.textOnPrimary,
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
    borderColor: colors.inputBorder,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginBottom: 10,
  },
  socialIconsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    marginBottom: 10,
  },
  socialIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialBtnDisabled: {
    backgroundColor: colors.inputBg,
    borderColor: colors.border,
  },
  socialBtnText: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '700',
    marginLeft: 10,
  },
  socialBtnTextDisabled: {
    fontSize: 15,
    color: colors.textPlaceholder,
    fontWeight: '700',
    marginLeft: 10,
  },
  forgotRow: {
    alignSelf: 'flex-end',
    marginTop: 8,
    marginBottom: 8,
    paddingVertical: 4,
  },
  forgotRememberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  rememberMeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rememberMeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
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
    paddingHorizontal: 22,
  },
  input: {
    backgroundColor: colors.inputBg,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 16,
  },
  /** Full width inside `formCard` (no card horizontal padding). */
  inputCardBleed: {
    alignSelf: 'stretch',
    width: '100%',
    borderRadius: 0,
    marginBottom: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  inputCardBleedLast: {
    borderBottomWidth: 0,
    marginBottom: 8,
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
}

export function useAuthStyles() {
  const { colors } = useAppTheme();
  return useMemo(() => createAuthStyles(colors), [colors]);
}
