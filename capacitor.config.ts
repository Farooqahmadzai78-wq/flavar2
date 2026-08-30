import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.islamnoor.app',
  appName: 'Islam Noor',
  webDir: '.output/public',
  includePlugins: ['@capacitor/local-notifications'],
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#0F766E',
    },
  },
};

export default config;

