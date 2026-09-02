<template>
  <q-layout view="hHh LpR fFf">
    <q-header elevated>
      <q-toolbar>
        <q-toolbar-title>DiceTale GM</q-toolbar-title>
        <q-btn
          flat
          round
          dense
          :icon="$q.dark.isActive ? 'light_mode' : 'dark_mode'"
          :title="$q.dark.isActive ? '切换浅色' : '切换深色'"
          @click="toggleDark"
        />
        <connection-status />
      </q-toolbar>
    </q-header>

    <q-page-container>
      <router-view />
    </q-page-container>

    <q-footer v-if="$q.screen.lt.md" bordered>
      <q-tabs
        dense
        align="justify"
        :model-value="$route.path"
        @update:model-value="$router.push"
      >
        <q-tab name="/map" icon="map" label="地图" />
        <q-tab name="/players" icon="people" label="玩家" />
        <q-tab name="/items" icon="backpack" label="道具" />
      </q-tabs>
    </q-footer>

    <q-drawer v-else show-if-above side="left" bordered :width="120">
      <q-list>
        <q-item clickable :to="'/map'" exact>
          <q-item-section avatar>
            <q-icon name="map" />
          </q-item-section>
          <q-item-section>地图</q-item-section>
        </q-item>
        <q-item clickable :to="'/players'" exact>
          <q-item-section avatar>
            <q-icon name="people" />
          </q-item-section>
          <q-item-section>玩家</q-item-section>
        </q-item>
        <q-item clickable :to="'/items'" exact>
          <q-item-section avatar>
            <q-icon name="backpack" />
          </q-item-section>
          <q-item-section>道具</q-item-section>
        </q-item>
      </q-list>
    </q-drawer>
  </q-layout>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useQuasar } from 'quasar';
import { useWsStore } from 'src/stores/wsStore';
import { useItemsStore } from 'src/stores/itemsStore';
import { useGameStateStore } from 'src/stores/gameStateStore';
import { fetchItemCatalog } from 'src/services/itemsApi';
import { fetchMapList } from 'src/services/mapsApi';
import ConnectionStatus from 'components/common/ConnectionStatus.vue';

const $q = useQuasar();

const ws = useWsStore();
const items = useItemsStore();
const gameState = useGameStateStore();

// Quasar Dark 插件只做内存切换、不持久化，这里自己存 localStorage。
// 在模块顶层先恢复主题，避免页面先渲染浅色再跳变。
const THEME_KEY = 'dicetale-theme';

function applySavedTheme(): void {
  try {
    if (localStorage.getItem(THEME_KEY) === 'dark') {
      $q.dark.set(true);
    }
  } catch {
    // localStorage 不可用（隐私模式等）时忽略
  }
}

applySavedTheme();

function toggleDark(): void {
  $q.dark.toggle();
  try {
    localStorage.setItem(THEME_KEY, $q.dark.isActive ? 'dark' : 'light');
  } catch {
    // 同上
  }
}

onMounted(async () => {
  ws.connect();
  try {
    items.setCatalog(await fetchItemCatalog());
  } catch (e) {
    console.error('加载道具目录失败', e);
  }
  try {
    gameState.setApiMaps(await fetchMapList());
  } catch (e) {
    console.error('加载地图列表失败', e);
  }
});
</script>
