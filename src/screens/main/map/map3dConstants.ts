/** Default centre: Kingston, Jamaica (customer + driver maps). */
export const JAMAICA_KINGSTON_CENTER = { latitude: 17.997, longitude: -76.7936 };

/**
 * Pitched camera so 3D extruded buildings show (tilt with two fingers to adjust).
 * Uses Google Maps on both platforms via {@link RidrMapView}.
 */
export const MAP_INITIAL_3D_CAMERA = {
  center: JAMAICA_KINGSTON_CENTER,
  heading: 0,
  pitch: 52,
  zoom: 17,
};
