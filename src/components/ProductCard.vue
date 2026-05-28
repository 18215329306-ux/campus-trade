<script setup>
import { computed } from 'vue'

const props = defineProps({
  id: Number,
  image: String,
  title: String,
  price: Number,
  category: String,
  condition: String,
  seller: String,
})

// 取第一张图片（多张图用逗号分隔时只显示第一张）
const firstImage = computed(() => {
  if (!props.image) return ''
  return props.image.includes(',') ? props.image.split(',')[0] : props.image
})

const emit = defineEmits(['click'])
</script>

<template>
  <div class="product-card" @click="emit('click', id)">
    <div class="product-card__image-wrap">
      <img :src="firstImage" :alt="title" class="product-card__image" />
      <div class="product-card__price">¥{{ price }}</div>
    </div>
    <div class="product-card__info">
      <div class="product-card__title">{{ title }}</div>
      <div class="product-card__meta">
        <t-tag size="small" variant="light" theme="primary">{{ category }}</t-tag>
        <t-tag size="small" variant="outline" theme="warning">{{ condition }}</t-tag>
      </div>
      <div class="product-card__seller">{{ seller }}</div>
    </div>
  </div>
</template>

<style scoped>
.product-card {
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  transition: transform 0.2s;
  cursor: pointer;
}

.product-card:active {
  transform: scale(0.97);
}

.product-card__image-wrap {
  position: relative;
  width: 100%;
  padding-top: 100%;
  background: #f0f0f0;
}

.product-card__image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #fff;
}

.product-card__price {
  position: absolute;
  bottom: 8px;
  left: 8px;
  padding: 2px 12px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  border-radius: 6px;
}

.product-card__info {
  padding: 12px;
}

.product-card__title {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  line-height: 20px;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  margin-bottom: 8px;
  min-height: 40px;
}

.product-card__meta {
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
}

.product-card__seller {
  font-size: 12px;
  color: #999;
}
</style>
