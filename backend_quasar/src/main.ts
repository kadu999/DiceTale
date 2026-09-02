import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { Quasar, Notify } from 'quasar';
import quasarLang from 'quasar/lang/zh-CN';
import '@quasar/extras/material-icons/material-icons.css';
import 'quasar/src/css/index.sass';
import App from './App.vue';
import router from './router';

const app = createApp(App);

app.use(Quasar, {
  plugins: { Notify },
  lang: quasarLang,
});
app.use(createPinia());
app.use(router);

app.mount('#q-app');
