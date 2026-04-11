import React from 'react';
import SupportTicketScreen from '../../support/SupportTicketScreen';

type Props = {
  userEmail: string;
  userFirstName: string;
  onBack: () => void;
};

export function SettingsSupportScreen({ userEmail, userFirstName, onBack }: Props) {
  return <SupportTicketScreen userEmail={userEmail} userFirstName={userFirstName} onBack={onBack} />;
}
