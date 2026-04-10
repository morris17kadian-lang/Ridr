import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, ScrollView, StatusBar, Text, View } from 'react-native';
import type { MainScreenUi } from '../mainScreenUi';
import { mainTabStyles } from '../styles/mainTabStyles';
import { styles } from '../styles/mainScreenStyles';

type Props = {
  ui: MainScreenUi;
  isDark: boolean;
  onBack: () => void;
};

type Notification = {
  id: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
};

const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    title: 'Trip completed',
    body: 'Your trip to New Kingston has been completed. Tap to view the receipt.',
    time: '2 hours ago',
    read: false,
  },
  {
    id: '2',
    title: 'Driver on the way',
    body: 'Marcus W. is 3 minutes away in a Silver Toyota Corolla.',
    time: 'Yesterday',
    read: false,
  },
  {
    id: '3',
    title: 'Weekend promo',
    body: 'Get 15% off all rides this weekend. Use code WEEKEND15 at checkout.',
    time: '2 days ago',
    read: false,
  },
  {
    id: '4',
    title: 'Rate your last trip',
    body: 'How was your ride with Marcus W.? Let us know.',
    time: '2 days ago',
    read: true,
  },
  {
    id: '5',
    title: 'App updated',
    body: 'Ridr v2.1 is now available with improved maps and faster booking.',
    time: '5 days ago',
    read: true,
  },
];

export function NotificationsScreen({ ui, isDark, onBack }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const hasUnread = notifications.some((n) => !n.read);

  return (
    <View style={[styles.editProfileRoot, { backgroundColor: ui.screenBg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View
        style={[
          styles.editProfileHeader,
          { backgroundColor: ui.panelBg, borderBottomWidth: 1, borderBottomColor: ui.divider },
        ]}
      >
        <Pressable style={styles.editProfileHeaderSide} onPress={onBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={ui.text} />
        </Pressable>
        <Text style={[styles.editProfileHeaderTitle, { color: ui.text }]}>Notifications</Text>
        <Pressable
          style={[styles.editProfileHeaderSide, { alignItems: 'flex-end' }]}
          onPress={markAllRead}
          hitSlop={8}
          disabled={!hasUnread}
        >
          <Ionicons
            name="checkmark-done-outline"
            size={22}
            color={hasUnread ? ui.text : ui.textMuted}
          />
        </Pressable>
      </View>

      <ScrollView
        style={styles.editProfileScroll}
        contentContainerStyle={[styles.editProfileScrollContent, { paddingBottom: 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {notifications.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Ionicons name="notifications-off-outline" size={48} color={ui.textMuted} />
            <Text style={{ color: ui.textMuted, marginTop: 12, fontSize: 15 }}>No notifications yet</Text>
          </View>
        ) : (
          notifications.map((n) => (
            <Pressable
              key={n.id}
              style={[
                mainTabStyles.tabCard,
                {
                  backgroundColor: ui.cardBg,
                  flexDirection: 'row',
                  alignItems: 'stretch',
                  ...(n.read ? {} : {
                    shadowColor: '#FFD000',
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.7,
                    shadowRadius: 10,
                    elevation: 8,
                    transform: [{ translateX: 3 }],
                  }),
                },
              ]}
              onPress={() => markRead(n.id)}
            >
              <View style={{
                width: 4,
                backgroundColor: n.read ? 'transparent' : ui.text,
                borderTopLeftRadius: 18,
                borderBottomLeftRadius: 18,
                overflow: 'hidden',
              }} />
              <View style={[mainTabStyles.activityCardContent, { flex: 1 }]}>
                <View style={mainTabStyles.activityCardRow}>
                  <Text
                    style={[mainTabStyles.activityCardTitle, { color: ui.text, flex: 1 }]}
                    numberOfLines={1}
                  >
                    {n.title}
                  </Text>
                  <Text style={{ color: ui.textMuted, fontSize: 11, marginLeft: 8, flexShrink: 0 }}>
                    {n.time}
                  </Text>
                </View>
                <Text style={[mainTabStyles.activityCardSub, { color: ui.textMuted, marginTop: 2 }]}>
                  {n.body}
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}
