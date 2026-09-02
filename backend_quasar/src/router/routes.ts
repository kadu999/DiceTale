import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/map' },
  { path: '/map', component: () => import('pages/MapPage.vue') },
  { path: '/players', component: () => import('pages/PlayersPage.vue') },
  { path: '/items', component: () => import('pages/ItemsPage.vue') },
  { path: '/property', redirect: '/map' },
];

export default routes;
