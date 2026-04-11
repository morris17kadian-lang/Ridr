import type { Dispatch, SetStateAction } from 'react';
import type { ThemeOverride } from '../../../theme/ThemeProvider';
import type { MainScreenUi } from '../mainScreenUi';
import type { ProfileCard } from '../profile/profileTypes';
import type { ActiveTripState } from '../ride/activeTripTypes';

export type MainStackSubScreen =
  | 'home'
  | 'activeRide'
  | 'profile'
  | 'profileEdit'
  | 'notifications'
  | 'settingsNotifications'
  | 'settingsPassword'
  | 'settingsPayment'
  | 'settingsLanguage'
  | 'settingsAppearance'
  | 'settingsHelp'
  | 'settingsTerms'
  | 'settingsSupport';

export type MainSubScreenRouterProps = {
  screen: MainStackSubScreen;
  setScreen: Dispatch<SetStateAction<MainStackSubScreen>>;
  ui: MainScreenUi;
  isDark: boolean;
  themeOverride: ThemeOverride;
  setThemeOverride: (o: ThemeOverride) => void;
  openProfileEdit: () => void;
  userFirstName: string;
  userLastName: string;
  userEmail: string;
  userPhoneE164: string | null;
  cards: ProfileCard[];
  defaultCard: string | null;
  selectDefaultCard: (id: string) => void;
  addCardVisible: boolean;
  setAddCardVisible: (v: boolean) => void;
  newCardNumber: string;
  setNewCardNumber: (v: string) => void;
  newCardName: string;
  setNewCardName: (v: string) => void;
  newCardExpiry: string;
  setNewCardExpiry: (v: string) => void;
  newCardCvv: string;
  setNewCardCvv: (v: string) => void;
  closeAddCardSheet: () => void;
  saveNewCard: () => Promise<void>;
  /** Long-press on a card — show update/delete actions */
  onPaymentMethodLongPress: (card: ProfileCard) => void;
  editExpiryVisible: boolean;
  editExpiryLast4: string;
  editExpiryMonth: string;
  setEditExpiryMonth: (v: string) => void;
  editExpiryYear: string;
  setEditExpiryYear: (v: string) => void;
  closeEditCardExpiry: () => void;
  saveEditCardExpiry: () => Promise<void>;
  onConfirmSignOut: () => void;
  saveProfile: () => Promise<void>;
  profileDirty: boolean;
  editingFirstName: string;
  setEditingFirstName: (v: string) => void;
  editingLastName: string;
  setEditingLastName: (v: string) => void;
  editingEmail: string;
  setEditingEmail: (v: string) => void;
  editingUsername: string;
  setEditingUsername: (v: string) => void;
  editingPassword: string;
  setEditingPassword: (v: string) => void;
  showPassword: boolean;
  setShowPassword: Dispatch<SetStateAction<boolean>>;
  editingPhone: string;
  setEditingPhone: (v: string) => void;
  countryCode: string;
  setCountryCode: (v: string) => void;
  countryPickerVisible: boolean;
  setCountryPickerVisible: (v: boolean) => void;
  addressModal: 'home' | 'work' | null;
  addressInput: string;
  setAddressInput: (v: string) => void;
  saveAddress: () => void;
  closeAddressModal: () => void;
  notifRideUpdates: boolean;
  setNotifRideUpdates: (v: boolean) => void;
  notifDriverArrival: boolean;
  setNotifDriverArrival: (v: boolean) => void;
  notifTripReceipt: boolean;
  setNotifTripReceipt: (v: boolean) => void;
  notifPromos: boolean;
  setNotifPromos: (v: boolean) => void;
  notifNewFeatures: boolean;
  setNotifNewFeatures: (v: boolean) => void;
  notifSurveys: boolean;
  setNotifSurveys: (v: boolean) => void;
  notifSecurity: boolean;
  setNotifSecurity: (v: boolean) => void;
  notifPayments: boolean;
  setNotifPayments: (v: boolean) => void;
  selectedLang: string;
  setSelectedLang: (v: string) => void;
  presentRide: ActiveTripState | null;
  leaveActiveRideScreen: () => void;
};
