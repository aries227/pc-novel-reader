import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.local.jianyue',
  appName: '简阅',
  webDir: 'out/renderer',
  android: {
    allowMixedContent: true
  }
}

export default config
