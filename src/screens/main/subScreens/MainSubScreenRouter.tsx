import React from 'react';

import { SwipeBackScreen } from '../components/SwipeBackScreen';
import { NotificationsScreen } from '../notifications/NotificationsScreen';
import { ProfileEditScreen, ProfileScreen } from '../profile/Profile';
import { ActiveRideScreen } from '../ride/ActiveRideScreen';
import {
  SettingsAppearanceScreen,
  SettingsHelpScreen,
  SettingsLanguageScreen,
  SettingsNotificationsScreen,
  SettingsPasswordScreen,
  SettingsPaymentScreen,
  SettingsSupportScreen,
  SettingsTermsScreen,
} from '../settings/Settings';
import type { MainSubScreenRouterProps } from './types';

/**
 * Renders profile, settings, notifications, and active-ride full-screen flows with edge swipe-back.
 * Returns `null` when the main map/home UI should show instead.
 */
export function MainSubScreenRouter(p: MainSubScreenRouterProps): React.ReactElement | null {
  const { screen, presentRide, setScreen } = p;

  if (screen === 'activeRide' && !presentRide) return null;

  if (screen === 'profile') {
    return (
      <SwipeBackScreen onBack={() => setScreen('home')}>
        <ProfileScreen
          ui={p.ui}
          isDark={p.isDark}
          onBack={() => setScreen('home')}
          onEdit={p.openProfileEdit}
          userFirstName={p.userFirstName}
          userLastName={p.userLastName}
          userEmail={p.userEmail}
          userPhoneE164={p.userPhoneE164}
          cards={p.cards}
          defaultCard={p.defaultCard}
          selectDefaultCard={p.selectDefaultCard}
          addCardVisible={p.addCardVisible}
          setAddCardVisible={p.setAddCardVisible}
          newCardNumber={p.newCardNumber}
          setNewCardNumber={p.setNewCardNumber}
          newCardName={p.newCardName}
          setNewCardName={p.setNewCardName}
          newCardExpiry={p.newCardExpiry}
          setNewCardExpiry={p.setNewCardExpiry}
          newCardCvv={p.newCardCvv}
          setNewCardCvv={p.setNewCardCvv}
          closeAddCardSheet={p.closeAddCardSheet}
          saveNewCard={p.saveNewCard}
          onPaymentMethodLongPress={p.onPaymentMethodLongPress}
          editExpiryVisible={p.editExpiryVisible}
          editExpiryLast4={p.editExpiryLast4}
          editExpiryMonth={p.editExpiryMonth}
          setEditExpiryMonth={p.setEditExpiryMonth}
          editExpiryYear={p.editExpiryYear}
          setEditExpiryYear={p.setEditExpiryYear}
          closeEditCardExpiry={p.closeEditCardExpiry}
          saveEditCardExpiry={p.saveEditCardExpiry}
          onConfirmSignOut={p.onConfirmSignOut}
        />
      </SwipeBackScreen>
    );
  }

  if (screen === 'settingsPayment') {
    return (
      <SwipeBackScreen onBack={() => setScreen('home')}>
        <SettingsPaymentScreen
          ui={p.ui}
          isDark={p.isDark}
          onBack={() => setScreen('home')}
          cards={p.cards}
          defaultCard={p.defaultCard}
          selectDefaultCard={p.selectDefaultCard}
          addCardVisible={p.addCardVisible}
          setAddCardVisible={p.setAddCardVisible}
          newCardNumber={p.newCardNumber}
          setNewCardNumber={p.setNewCardNumber}
          newCardName={p.newCardName}
          setNewCardName={p.setNewCardName}
          newCardExpiry={p.newCardExpiry}
          setNewCardExpiry={p.setNewCardExpiry}
          newCardCvv={p.newCardCvv}
          setNewCardCvv={p.setNewCardCvv}
          closeAddCardSheet={p.closeAddCardSheet}
          saveNewCard={p.saveNewCard}
          onPaymentMethodLongPress={p.onPaymentMethodLongPress}
          editExpiryVisible={p.editExpiryVisible}
          editExpiryLast4={p.editExpiryLast4}
          editExpiryMonth={p.editExpiryMonth}
          setEditExpiryMonth={p.setEditExpiryMonth}
          editExpiryYear={p.editExpiryYear}
          setEditExpiryYear={p.setEditExpiryYear}
          closeEditCardExpiry={p.closeEditCardExpiry}
          saveEditCardExpiry={p.saveEditCardExpiry}
        />
      </SwipeBackScreen>
    );
  }

  if (screen === 'profileEdit') {
    return (
      <SwipeBackScreen onBack={() => setScreen('profile')}>
        <ProfileEditScreen
          ui={p.ui}
          isDark={p.isDark}
          onBack={() => setScreen('profile')}
          onSave={p.saveProfile}
          profileDirty={p.profileDirty}
          editingFirstName={p.editingFirstName}
          setEditingFirstName={p.setEditingFirstName}
          editingLastName={p.editingLastName}
          setEditingLastName={p.setEditingLastName}
          editingEmail={p.editingEmail}
          setEditingEmail={p.setEditingEmail}
          editingUsername={p.editingUsername}
          setEditingUsername={p.setEditingUsername}
          editingPassword={p.editingPassword}
          setEditingPassword={p.setEditingPassword}
          showPassword={p.showPassword}
          setShowPassword={p.setShowPassword}
          editingPhone={p.editingPhone}
          setEditingPhone={p.setEditingPhone}
          countryCode={p.countryCode}
          setCountryCode={p.setCountryCode}
          countryPickerVisible={p.countryPickerVisible}
          setCountryPickerVisible={p.setCountryPickerVisible}
          addressModal={p.addressModal}
          addressInput={p.addressInput}
          setAddressInput={p.setAddressInput}
          saveAddress={p.saveAddress}
          closeAddressModal={p.closeAddressModal}
        />
      </SwipeBackScreen>
    );
  }

  if (screen === 'settingsNotifications') {
    return (
      <SwipeBackScreen onBack={() => setScreen('home')}>
        <SettingsNotificationsScreen
          ui={p.ui}
          isDark={p.isDark}
          onBack={() => setScreen('home')}
          notifRideUpdates={p.notifRideUpdates}
          setNotifRideUpdates={p.setNotifRideUpdates}
          notifDriverArrival={p.notifDriverArrival}
          setNotifDriverArrival={p.setNotifDriverArrival}
          notifTripReceipt={p.notifTripReceipt}
          setNotifTripReceipt={p.setNotifTripReceipt}
          notifPromos={p.notifPromos}
          setNotifPromos={p.setNotifPromos}
          notifNewFeatures={p.notifNewFeatures}
          setNotifNewFeatures={p.setNotifNewFeatures}
          notifSurveys={p.notifSurveys}
          setNotifSurveys={p.setNotifSurveys}
          notifSecurity={p.notifSecurity}
          setNotifSecurity={p.setNotifSecurity}
          notifPayments={p.notifPayments}
          setNotifPayments={p.setNotifPayments}
        />
      </SwipeBackScreen>
    );
  }

  if (screen === 'settingsPassword') {
    return (
      <SwipeBackScreen onBack={() => setScreen('home')}>
        <SettingsPasswordScreen ui={p.ui} isDark={p.isDark} onBack={() => setScreen('home')} />
      </SwipeBackScreen>
    );
  }

  if (screen === 'settingsLanguage') {
    return (
      <SwipeBackScreen onBack={() => setScreen('home')}>
        <SettingsLanguageScreen
          ui={p.ui}
          isDark={p.isDark}
          onBack={() => setScreen('home')}
          selectedLang={p.selectedLang}
          onSelectLang={(lang) => {
            p.setSelectedLang(lang);
            setScreen('home');
          }}
        />
      </SwipeBackScreen>
    );
  }

  if (screen === 'settingsAppearance') {
    return (
      <SwipeBackScreen onBack={() => setScreen('home')}>
        <SettingsAppearanceScreen
          ui={p.ui}
          isDark={p.isDark}
          onBack={() => setScreen('home')}
          themeOverride={p.themeOverride}
          setThemeOverride={p.setThemeOverride}
        />
      </SwipeBackScreen>
    );
  }

  if (screen === 'settingsHelp') {
    return (
      <SwipeBackScreen onBack={() => setScreen('home')}>
        <SettingsHelpScreen
          ui={p.ui}
          isDark={p.isDark}
          onBack={() => setScreen('home')}
          onContactSupport={() => setScreen('settingsSupport')}
        />
      </SwipeBackScreen>
    );
  }

  if (screen === 'settingsSupport') {
    return (
      <SwipeBackScreen onBack={() => setScreen('home')}>
        <SettingsSupportScreen
          userEmail={p.userEmail}
          userFirstName={p.userFirstName}
          onBack={() => setScreen('home')}
        />
      </SwipeBackScreen>
    );
  }

  if (screen === 'notifications') {
    return (
      <SwipeBackScreen onBack={() => setScreen('home')}>
        <NotificationsScreen ui={p.ui} isDark={p.isDark} onBack={() => setScreen('home')} />
      </SwipeBackScreen>
    );
  }

  if (screen === 'settingsTerms') {
    return (
      <SwipeBackScreen onBack={() => setScreen('home')}>
        <SettingsTermsScreen ui={p.ui} isDark={p.isDark} onBack={() => setScreen('home')} />
      </SwipeBackScreen>
    );
  }

  if (screen === 'activeRide' && presentRide) {
    return (
      <ActiveRideScreen trip={presentRide} ui={p.ui} isDark={p.isDark} onEndTrip={p.leaveActiveRideScreen} />
    );
  }

  return null;
}
