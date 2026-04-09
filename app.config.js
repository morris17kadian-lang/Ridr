module.exports = {
  expo: {
    name: 'Ridr',
    slug: 'ridr',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/ridr-logo.png',
    scheme: 'ridr',
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/ridr-logo.png',
      imageWidth: 240,
      resizeMode: 'contain',
      backgroundColor: '#000000',
    },
    ios: {
      supportsTablet: true,
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/ridr-logo.png',
        backgroundColor: '#000000',
      },
      predictiveBackGestureEnabled: false,
      permissions: ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION'],
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
        },
      },
    },
    web: {
      favicon: './assets/ridr-logo.png',
    },
    extra: {
      googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      baseUrl: process.env.EXPO_PUBLIC_BASE_URL,
    },
    plugins: ['expo-web-browser'],
  },
};