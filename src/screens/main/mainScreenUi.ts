/** Theme subset passed from MainScreen to sub-screens (matches `ui` useMemo in MainScreen). */
export type MainScreenUi = {
  screenBg: string;
  panelBg: string;
  cardBg: string;
  softBg: string;
  text: string;
  textMuted: string;
  divider: string;
  placeholder: string;
  headerOverlay: string;
  tabActive: string;
  tabInactive: string;
  /** Brand accent — maps, chips (matches theme `colors.accent`). */
  accent: string;
  ctaBg: string;
  ctaText: string;
  success: string;
  successContainer: string;
  danger: string;
  buttonDisabled: string;
};
