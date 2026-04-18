import { forwardRef } from 'react';
import { Platform, StyleSheet } from 'react-native';
import MapView, { type MapViewProps, PROVIDER_GOOGLE } from 'react-native-maps';

import { GOOGLE_MAP_STYLE_DARK, GOOGLE_MAP_STYLE_LIGHT } from './googleMapStyles';
import { MAP_INITIAL_3D_CAMERA } from './map3dConstants';

export type RidrMapViewProps = Omit<
  MapViewProps,
  'provider' | 'customMapStyle' | 'mapType' | 'initialCamera' | 'initialRegion'
> & {
  isDark: boolean;
  loadingBackgroundColor: string;
  /**
   * When set, the map boots with this region (e.g. wide driver overview).
   * Otherwise uses {@link MAP_INITIAL_3D_CAMERA} or `initialCamera` override.
   */
  initialRegion?: MapViewProps['initialRegion'];
  /** Optional 3D camera override; ignored if `initialRegion` is set. */
  initialCamera?: MapViewProps['initialCamera'];
};

/**
 * Shared Google Map: 3D pitch, building extrusion (Android), themed JSON style,
 * same defaults as the customer MainScreen map.
 */
export const RidrMapView = forwardRef<MapView, RidrMapViewProps>(function RidrMapView(
  { isDark, loadingBackgroundColor, initialRegion, initialCamera, ...rest },
  ref
) {
  const customMapStyle = isDark ? GOOGLE_MAP_STYLE_DARK : GOOGLE_MAP_STYLE_LIGHT;
  const cameraOrRegion =
    initialRegion != null
      ? { initialRegion }
      : { initialCamera: initialCamera ?? MAP_INITIAL_3D_CAMERA };

  return (
    <MapView
      ref={ref}
      provider={PROVIDER_GOOGLE}
      style={StyleSheet.absoluteFillObject}
      mapType="standard"
      customMapStyle={customMapStyle}
      loadingBackgroundColor={loadingBackgroundColor}
      showsUserLocation={false}
      showsMyLocationButton={false}
      showsCompass={false}
      toolbarEnabled={false}
      rotateEnabled={true}
      pitchEnabled={true}
      {...(Platform.OS === 'android'
        ? { showsBuildings: true, googleRenderer: 'LATEST' as const }
        : {})}
      {...cameraOrRegion}
      {...rest}
    />
  );
});
