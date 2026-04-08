module.exports = {
  expo: {
    name: 'Ridr',
    slug: 'ridr',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/ridr-logo.png',
    scheme: 'ridr',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/ridr-logo.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
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
        backgroundColor: '#ffd54a',
      },
      predictiveBackGestureEnabled: false,
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
        },
      },
    },
    web: {
      favicon: './assets/ridr-logo.png',
    },
  },
};