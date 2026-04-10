import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StatusBar, Text, View } from 'react-native';
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
  const [selectedNotif, setSelectedNotif] = useState<Notification | null>(null);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const hasUnread = notifications.some((n) => !n.read);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setNotifications(INITIAL_NOTIFICATIONS);
      setRefreshing(false);
    }, 800);
  };

  const openNotif = (n: Notification) => {
    markRead(n.id);
    setSelectedNotif(n);
  };

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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={ui.textMuted}
          />
        }
      >
        {notifications.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Ionicons name="notifications-off-outline" size={48} color={ui.textMuted} />
            <Text style={{ color: ui.textMuted, marginTop: 12, fontSize: 15 }}>No notifications yet</Text>
          </View>
        ) : (
          notifications.map((n) => (
            <View
              key={n.id}
              style={{
                marginBottom: 8,
                borderRadius: 18,
                opacity: n.read ? 0.45 : 1,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: n.read ? 1 : 10 },
                shadowOpacity: n.read ? 0.04 : 0.28,
                shadowRadius: n.read ? 4 : 18,
                elevation: n.read ? 1 : 16,
                ...(n.read ? {} : { transform: [{ scale: 1.03 }] }),
              }}
            >
              <Pressable
                style={[
                  mainTabStyles.tabCard,
                  {
                    backgroundColor: n.read
                      ? ui.cardBg
                      : isDark ? '#24221c' : '#ffffff',
                    flexDirection: 'row',
                    alignItems: 'center',
                    height: 68,
                    marginBottom: 0,
                    shadowOpacity: 0,
                    elevation: 0,
                    borderTopWidth: n.read ? 0 : 1,
                    borderTopColor: isDark
                      ? 'rgba(255,255,255,0.13)'
                      : 'rgba(255,255,255,0.95)',
                    borderLeftWidth: n.read ? 0 : 1,
                    borderLeftColor: isDark
                      ? 'rgba(255,255,255,0.08)'
                      : 'rgba(255,255,255,0.80)',
                  },
                ]}
                onPress={() => openNotif(n)}
              >
                <View style={[mainTabStyles.activityCardContent, { flex: 1 }]}>
                  <View style={mainTabStyles.activityCardRow}>
                    <Text
                      style={[
                        mainTabStyles.activityCardTitle,
                        { color: ui.text, flex: 1, fontWeight: n.read ? '400' : '700' },
                      ]}
                      numberOfLines={1}
                    >
                      {n.title}
                    </Text>
                    <Text style={{ color: ui.textMuted, fontSize: 11, marginLeft: 8, flexShrink: 0 }}>
                      {n.time}
                    </Text>
                  </View>
                  <Text
                    style={[mainTabStyles.activityCardSub, { color: ui.textMuted, marginTop: 2 }]}
                    numberOfLines={1}
                  >
                    {n.body}
                  </Text>
                </View>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>

      {/* Notification detail modal */}
      <Modal
        visible={selectedNotif !== null}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={() => setSelectedNotif(null)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', paddingHorizontal: 24 }}
          onPress={() => setSelectedNotif(null)}
        >
          <Pressable
            style={{
              backgroundColor: ui.panelBg,
              borderRadius: 28,
              paddingHorizontal: 24,
              paddingTop: 28,
              paddingBottom: 28,
            }}
            onPress={() => {}}
          >

            {/* Icon */}
            <View style={{
              width: 48, height: 48, borderRadius: 24,
              backgroundColor: isDark ? '#2b2b31' : '#f0f0f0',
              alignItems: 'center', justifyContent: 'center',
              marginBottom: 16, alignSelf: 'center',
            }}>
              <Ionicons name="notifications-outline" size={24} color={ui.text} />
            </View>

            {/* Title + time */}
            <Text style={{ color: ui.text, fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 4 }}>
              {selectedNotif?.title}
            </Text>
            <Text style={{ color: ui.textMuted, fontSize: 12, textAlign: 'center', marginBottom: 20 }}>
              {selectedNotif?.time}
            </Text>

            {/* Divider */}
            <View style={{ height: 1, backgroundColor: ui.divider, marginBottom: 20 }} />

            {/* Body */}
            <Text style={{ color: ui.text, fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 28 }}>
              {selectedNotif?.body}
            </Text>

            {/* Dismiss button */}
            <Pressable
              style={{
                backgroundColor: ui.ctaBg,
                borderRadius: 14,
                paddingVertical: 14,
                alignItems: 'center',
              }}
              onPress={() => setSelectedNotif(null)}
            >
              <Text style={{ color: ui.ctaText, fontWeight: '700', fontSize: 15 }}>Dismiss</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
