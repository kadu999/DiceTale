<template>
  <component
    :is="fieldComponent"
    v-if="fieldComponent"
    :object-id="objectId"
    :component-type="componentType"
    :data="block.data"
    :label-text="labelText"
    @open-picker="$emit('open-picker')"
    @open-mask="$emit('open-mask')"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ComponentBlock } from 'src/services/protocol/types';
import OptionValue from './fields/OptionValue.vue';
import IntValue from './fields/IntValue.vue';
import FloatValue from './fields/FloatValue.vue';
import BoolValue from './fields/BoolValue.vue';
import Backpack from './fields/Backpack.vue';
import ItemExchange from './fields/ItemExchange.vue';
import MaskImage from './fields/MaskImage.vue';

const props = defineProps<{ objectId: string; block: ComponentBlock }>();

defineEmits<{ 'open-picker': []; 'open-mask': [] }>();

const fieldComponent = computed(() => {
  switch (props.block.component) {
    case 'OptionValue':
      return OptionValue;
    case 'IntValue':
      return IntValue;
    case 'FloatValue':
      return FloatValue;
    case 'BoolValue':
      return BoolValue;
    case 'Backpack':
      return Backpack;
    case 'ItemExchange':
      return ItemExchange;
    case 'MaskImage':
      return MaskImage;
    default:
      return null;
  }
});

const componentType = computed(() => props.block.component);

const labelText = computed(
  () => (props.block.displayName as string) || (props.block.data.label as string) || '值',
);
</script>
