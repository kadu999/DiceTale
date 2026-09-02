import { defineConfig } from '#q-app/wrappers';

export default defineConfig(() => {
  return {
    boot: ['polyfills', 'pinia'],

    css: [
      'app.scss',
      'item-cells.scss',
    ],

    extras: [
      'roboto-font',
      'material-icons',
    ],

    build: {
      target: {
        // MI 8 等老机器的系统 WebView 停在 Chromium 72：不能用 ?. / ?? 等新语法，
        // 否则页面直接白屏（logcat: Uncaught SyntaxError: Unexpected token ?）
        browser: ['es2019', 'chrome72'],
        node: 'node20',
      },
      typescript: {
        strict: true,
        vueShim: true,
      },
    },

    devServer: {
      port: 9000,
      proxy: {
        '/api': { target: 'http://localhost:1420', changeOrigin: true },
        '/maps': { target: 'http://localhost:1420', changeOrigin: true },
        '/gm': { target: 'ws://localhost:1420', ws: true },
      },
    },

    framework: {
      config: {},
      plugins: ['Notify'],
    },

    animations: [],
  };
});
