<template>
  <!-- 道具模块：左 类别 | 中 道具 | 右 上属性 + 下分配面板
       （布局参考旧项目 itemPickerModal 的三列结构，每个面板一张卡片；
         桌面端面板撑满视口高度，内容在面板内部滚动） -->
  <q-page padding class="items-page">
    <div class="row q-col-gutter-md items-row">
      <!-- 左：类别 -->
      <div class="col-12 col-md-2 items-col">
        <q-card flat bordered class="items-panel">
          <div class="items-panel-header">类型</div>
          <q-card-section class="q-pt-sm items-panel__body">
            <item-category-list />
          </q-card-section>
        </q-card>
      </div>

      <!-- 中：道具 -->
      <div class="col-12 col-md-5 items-col">
        <q-card flat bordered class="items-panel">
          <div class="items-panel-header">道具</div>
          <q-card-section class="q-pt-sm items-panel__body">
            <item-catalog :selected-item="selectedItem" @select="selectedItem = $event" />
          </q-card-section>
        </q-card>
      </div>

      <!-- 右：上 属性 / 下 分配面板 -->
      <div class="col-12 col-md-5 items-col">
        <q-card flat bordered class="items-panel">
          <div class="items-panel-header">道具属性</div>
          <q-card-section class="q-pt-sm items-panel__body">
            <item-property-panel :item-name="selectedItem" />
          </q-card-section>
        </q-card>
        <q-card flat bordered class="items-panel">
          <div class="items-panel-header">分配面板</div>
          <q-card-section class="q-pt-sm items-panel__body">
            <item-allocation-panel />
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import ItemCategoryList from 'src/components/items/ItemCategoryList.vue';
import ItemCatalog from 'src/components/items/ItemCatalog.vue';
import ItemPropertyPanel from 'src/components/items/ItemPropertyPanel.vue';
import ItemAllocationPanel from 'src/components/items/ItemAllocationPanel.vue';

const selectedItem = ref<string | undefined>(undefined);
</script>

<style scoped>
.items-panel-header {
  font-size: 0.85rem;
  font-weight: 700;
  color: #94a3b8;
  text-align: center;
  padding: 0.4rem 0 0;
}

/* 桌面端：整页撑满视口高度（50px 为顶栏高度，与地图页一致），
   卡片拉到底部，内容超出时在面板内部滚动。移动端保持自然高度。 */
@media (min-width: 1024px) {
  .items-page {
    height: calc(100vh - 50px);
  }

  .items-row {
    height: 100%;
  }

  .items-col {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .items-panel {
    flex: 1 1 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .items-panel__body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }
}
</style>
