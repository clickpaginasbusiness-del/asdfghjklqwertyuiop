import type { CapacitorConfig } from '@capacitor/cli';

// appId de TESTE — de propósito diferente do com.bellebook.app usado pelo TWA
// (ver src/app/.well-known/assetlinks.json/route.ts), pra não colidir com o
// app que já está indo pra Play Store. Trocar antes de qualquer publicação.
const config: CapacitorConfig = {
  appId: 'com.bellebook.painel.capacitortest',
  appName: 'BelleBook Painel (teste)',
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
