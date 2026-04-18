import { Text, View } from 'react-native';

type CompletedTrip = {
  id: string;
  route: string;
  fare: string;
  riderName: string;
  when: string;
};

type DriverUi = {
  text: string;
  textMuted: string;
  border: string;
  card: string;
};

type DriverTripsTabContentProps = {
  styles: any;
  ui: DriverUi;
  completedTrips: CompletedTrip[];
};

export function DriverTripsTabContent({ styles, ui, completedTrips }: DriverTripsTabContentProps) {
  return (
    <>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: ui.text }]}>Recent trips</Text>
        <Text style={[styles.sectionSub, { color: ui.textMuted }]}>Latest completed work</Text>
      </View>
      {completedTrips.map((trip) => (
        <View key={trip.id} style={[styles.tripHistoryCard, { borderColor: ui.border, backgroundColor: ui.card }]}>
          <View style={styles.tripHistoryTopRow}>
            <Text style={[styles.tripHistoryRoute, { color: ui.text }]}>{trip.route}</Text>
            <Text style={[styles.tripHistoryFare, { color: ui.text }]}>{trip.fare}</Text>
          </View>
          <Text style={[styles.tripHistoryMeta, { color: ui.textMuted }]}>Rider {trip.riderName} • {trip.when}</Text>
        </View>
      ))}
    </>
  );
}
