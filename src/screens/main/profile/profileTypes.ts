export type ProfileCard = {
  id: string;
  type: 'visa' | 'mastercard';
  last4: string;
  label: string;
};

export const DEFAULT_PROFILE_CARDS: ProfileCard[] = [
  { id: '1', type: 'visa', last4: '4242', label: 'Prepaid Visa' },
  { id: '2', type: 'mastercard', last4: '8888', label: 'Ridr Mastercard' },
];
