import type { CapacitorConfig } from '@capacitor/cli';

// App oficial (substitui o TWA abandonado). Mesmo package do app já
// registrado no Play Console / Firebase — ver
// src/app/.well-known/assetlinks.json/route.ts e google-services.json.
const config: CapacitorConfig = {
  appId: 'com.bellebook.app',
  appName: 'BelleBook',
  webDir: 'www',
  server: {
    // Carrega o painel ao vivo direto do Vercel — sem export estático, sem
    // build do Next embutido no app. www/index.html só existe pq o Capacitor
    // exige um webDir, mas não é ele que é servido normalmente.
    url: 'https://www.bellebook.com.br/painel',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
