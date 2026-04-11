import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatCardPreviewDisplay } from './paymentInputFormat';

type Props = {
  number: string;
  name: string;
  expiry: string;
};

export function CardPreview({ number, name, expiry }: Props) {
  const cleanNum = number.replace(/\D/g, '');
  const isVisa = cleanNum.startsWith('4');
  const isMc = cleanNum.startsWith('5') || cleanNum.startsWith('2');

  const displayNum = formatCardPreviewDisplay(cleanNum);

  const displayName = name.trim() ? name.toUpperCase() : 'FULL NAME';
  const displayExpiry = expiry.trim() || 'MM/YY';

  return (
    <LinearGradient
      colors={['#7C3AED', '#4338CA']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={cardPreviewStyles.card}
    >
      <View style={cardPreviewStyles.topRow}>
        <Text style={cardPreviewStyles.bankLabel}>Ridr Pay</Text>
        {isMc ? (
          <View style={cardPreviewStyles.mcWrap}>
            <View style={[cardPreviewStyles.mcCircle, { backgroundColor: '#EB001B' }]} />
            <View style={[cardPreviewStyles.mcCircle, { backgroundColor: '#F79E1B', marginLeft: -12 }]} />
          </View>
        ) : isVisa ? (
          <Text style={cardPreviewStyles.visaText}>VISA</Text>
        ) : (
          <Ionicons name="card-outline" size={26} color="rgba(255,255,255,0.7)" />
        )}
      </View>
      <Text style={cardPreviewStyles.cardNumber}>{displayNum}</Text>
      <View style={cardPreviewStyles.bottomRow}>
        <View style={{ flex: 1 }}>
          <Text style={cardPreviewStyles.metaLabel}>CARDHOLDER</Text>
          <Text style={cardPreviewStyles.metaValue} numberOfLines={1}>
            {displayName}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={cardPreviewStyles.metaLabel}>EXPIRES</Text>
          <Text style={cardPreviewStyles.metaValue}>{displayExpiry}</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const cardPreviewStyles = StyleSheet.create({
  card: {
    width: '100%',
    aspectRatio: 1.586,
    borderRadius: 20,
    padding: 22,
    justifyContent: 'space-between',
    overflow: 'hidden',
    marginBottom: 6,
    shadowColor: '#4338CA',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bankLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  mcWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mcCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    opacity: 0.92,
  },
  visaText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 2,
  },
  cardNumber: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 1.25,
    textAlign: 'center',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  metaLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  metaValue: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
