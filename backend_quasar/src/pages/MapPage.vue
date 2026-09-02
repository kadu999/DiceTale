<template>
  <!-- 地图模块：左 地图列表 | 中 地图视图 | 右 属性面板
       每个面板一张卡片，撑满视口高度（与道具模块布局一致） -->
  <q-page class="map-page">
    <div class="row map-page__row q-col-gutter-xs">
      <div class="col-12 col-sm-2 map-col">
        <q-card flat bordered class="map-panel">
          <div class="map-panel-header">地图</div>
          <q-card-section class="map-panel__body q-pa-none">
            <map-list />
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-6 col-lg-8 map-col">
        <q-card flat bordered class="map-panel">
          <div class="map-panel-header">地图视图</div>
          <q-card-section class="map-panel__body q-pa-none">
            <map-view />
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-4 col-lg-2 map-col">
        <q-card flat bordered class="map-panel">
          <div class="map-panel-header">属性</div>
          <q-card-section class="map-panel__body q-pa-none">
            <map-property-panel />
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import MapView from 'components/map/MapView.vue';
import MapList from 'components/map/MapList.vue';
import MapPropertyPanel from 'components/map/MapPropertyPanel.vue';
</script>

<style scoped>
.map-panel-header {
  font-size: 0.85rem;
  font-weight: 700;
  color: #94a3b8;
  text-align: center;
  padding: 0.4rem 0 0;
}

.map-col {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.map-panel {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.map-panel__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
}
</style>
