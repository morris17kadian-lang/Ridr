export type ActivityItem = {
  id: string;
  type: 'ride' | 'payment' | 'profile' | 'settings' | 'promo';
  title: string;
  subtitle: string;
  time: string;
  daysAgo: number;
  icon: string;
  emoji?: string;
  iconBg: string;
  rideData?: { id: string; from: string; to: string; date: string; price: string; driver: string; rating: number };
};

export const ACTIVITY_FILTERS = [
  { key: 'all' as const, label: 'All' },
  { key: 'today' as const, label: 'Today' },
  { key: 'yesterday' as const, label: 'Yesterday' },
  { key: '7days' as const, label: 'Last 7 Days' },
  { key: 'month' as const, label: 'Last Month' },
];

export const mockActivityFeed: ActivityItem[] = [
  { id: 'a1', type: 'ride', title: 'Half-Way Tree → Norman Manley Airport', subtitle: 'Marcus W. · $12.40', time: 'Today, 9:14 AM', daysAgo: 0, icon: 'car', iconBg: '#4a90e2', rideData: { id: 'r1', from: 'Half-Way Tree', to: 'Norman Manley Airport', date: 'Today, 9:14 AM', price: '$12.40', driver: 'Marcus W.', rating: 5 } },
  { id: 'a2', type: 'payment', title: 'Visa card added', subtitle: '····4242 · Payment method', time: 'Today, 8:30 AM', daysAgo: 0, icon: 'card-outline', emoji: '💳', iconBg: '#52b788' },
  { id: 'a3', type: 'ride', title: 'New Kingston → Portmore Mall', subtitle: 'Diana R. · $8.20', time: 'Yesterday, 3:45 PM', daysAgo: 1, icon: 'car', iconBg: '#e2844a', rideData: { id: 'r2', from: 'New Kingston', to: 'Portmore Mall', date: 'Yesterday, 3:45 PM', price: '$8.20', driver: 'Diana R.', rating: 4 } },
  { id: 'a4', type: 'settings', title: 'Notifications updated', subtitle: 'Email alerts enabled', time: 'Yesterday, 1:00 PM', daysAgo: 1, icon: 'notifications-outline', emoji: '🔔', iconBg: '#9b72cf' },
  { id: 'a5', type: 'profile', title: 'Profile photo updated', subtitle: 'Display name changed', time: 'Yesterday, 10:15 AM', daysAgo: 1, icon: 'person-outline', emoji: '👤', iconBg: '#e25c6a' },
  { id: 'a6', type: 'ride', title: 'Liguanea → Half-Way Tree', subtitle: 'Trevor A. · $5.10', time: 'Apr 7, 11:30 AM', daysAgo: 2, icon: 'car', iconBg: '#4a90e2', rideData: { id: 'r3', from: 'Liguanea', to: 'Half-Way Tree', date: 'Apr 7, 11:30 AM', price: '$5.10', driver: 'Trevor A.', rating: 5 } },
  { id: 'a7', type: 'promo', title: 'Promo code applied', subtitle: 'RIDR20 · 20% off your next ride', time: 'Apr 7, 11:28 AM', daysAgo: 2, icon: 'pricetag-outline', emoji: '🏷️', iconBg: '#FFB800' },
  { id: 'a8', type: 'ride', title: 'Downtown Kingston → New Kingston', subtitle: 'Sandra M. · $6.80', time: 'Apr 6, 8:00 AM', daysAgo: 3, icon: 'car', iconBg: '#e2844a', rideData: { id: 'r4', from: 'Downtown Kingston', to: 'New Kingston', date: 'Apr 6, 8:00 AM', price: '$6.80', driver: 'Sandra M.', rating: 4 } },
  { id: 'a9', type: 'settings', title: 'Dark mode enabled', subtitle: 'Appearance settings changed', time: 'Apr 5, 9:45 PM', daysAgo: 4, icon: 'settings-outline', emoji: '⚙️', iconBg: '#3bbfa3' },
  { id: 'a10', type: 'ride', title: 'Constant Spring → Liguanea', subtitle: 'Devon P. · $4.90', time: 'Apr 5, 7:20 PM', daysAgo: 4, icon: 'car', iconBg: '#52b788', rideData: { id: 'r5', from: 'Constant Spring', to: 'Liguanea', date: 'Apr 5, 7:20 PM', price: '$4.90', driver: 'Devon P.', rating: 5 } },
  { id: 'a11', type: 'payment', title: 'Mastercard removed', subtitle: '····7890 · Payment method', time: 'Apr 2, 2:00 PM', daysAgo: 7, icon: 'card-outline', emoji: '💳', iconBg: '#e25c6a' },
  { id: 'a12', type: 'profile', title: 'Email address updated', subtitle: 'Account security changed', time: 'Mar 30, 11:00 AM', daysAgo: 10, icon: 'mail-outline', emoji: '📧', iconBg: '#4a90e2' },
  { id: 'a13', type: 'ride', title: 'Portmore → Liguanea', subtitle: 'Marcus W. · $9.50', time: 'Mar 28, 6:15 PM', daysAgo: 12, icon: 'car', iconBg: '#4a90e2', rideData: { id: 'r6', from: 'Portmore', to: 'Liguanea', date: 'Mar 28, 6:15 PM', price: '$9.50', driver: 'Marcus W.', rating: 5 } },
];

export const mockFavouritePlaces = [
  { id: 'f1', title: 'Norman Manley Airport', subtitle: 'Palisadoes, Kingston', icon: 'airplane' as const },
  { id: 'f2', title: 'Sovereign Centre', subtitle: 'Hope Road, Kingston', icon: 'storefront' as const },
  { id: 'f3', title: 'University of the West Indies', subtitle: 'Mona, Kingston', icon: 'business' as const },
];
