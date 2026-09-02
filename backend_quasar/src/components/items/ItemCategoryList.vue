<template>
  <!-- 左列：类别选择（布局参考旧项目 itemPickerModal 的“类型”列） -->
  <q-list dense bordered separator class="rounded-borders">
    <q-item
      clickable
      :active="itemsStore.category === ''"
      active-class="bg-primary text-white"
      @click="select('')"
    >
      <q-item-section>全部</q-item-section>
    </q-item>
    <q-item
      v-for="c in itemsStore.categories"
      :key="c"
      clickable
      :active="itemsStore.category === c"
      active-class="bg-primary text-white"
      @click="select(c)"
    >
      <q-item-section>{{ c }}</q-item-section>
    </q-item>
  </q-list>
</template>

<script setup lang="ts">
import { useItemsStore } from 'src/stores/itemsStore';

const itemsStore = useItemsStore();

function select(category: string): void {
  itemsStore.category = category;
}
</script>
