<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import { supabase } from '../supabase'

const route = useRoute()
const router = useRouter()
const item = ref(null)
const loading = ref(true)
const activeImageIndex = ref(0)
const showFullscreen = ref(false)
let touchStartX = 0

const images = computed(() => {
  if (!item.value?.image) return []
  const img = item.value.image
  return img.includes(',') ? img.split(',') : [img]
})

onMounted(async () => {
  const id = parseInt(route.params.id, 10)
  const { data, error } = await supabase
    .from('goods')
    .select('*')
    .eq('id', id)
    .single()
  if (!error && data) {
    item.value = data
  }
  loading.value = false
})

function prevImage() {
  if (activeImageIndex.value > 0) activeImageIndex.value--
  else activeImageIndex.value = images.value.length - 1
}

function nextImage() {
  if (activeImageIndex.value < images.value.length - 1) activeImageIndex.value++
  else activeImageIndex.value = 0
}

// 触摸滑动
function onTouchStart(e) {
  touchStartX = e.touches[0].clientX
}

function onTouchEnd(e) {
  const dx = e.changedTouches[0].clientX - touchStartX
  if (Math.abs(dx) < 50) return
  if (dx > 0) prevImage()
  else nextImage()
}

function openFullscreen() {
  showFullscreen.value = true
}

function closeFullscreen() {
  showFullscreen.value = false
}

function copyContact() {
  if (!item.value) return
  navigator.clipboard.writeText(item.value.contact).then(() => {
    MessagePlugin.success('联系方式已复制')
  }).catch(() => {
    MessagePlugin.warning('复制失败，请手动复制')
  })
}

function onContact() {
  if (!item.value) return
  copyContact()
}

function goBack() {
  router.push('/')
}
</script>

<template>
  <div v-if="loading" class="loading-page">
    <t-loading size="medium" text="加载中..." />
  </div>
  <div v-else-if="item" class="detail-page">
    <!-- 商品图片 + 切换 -->
    <div class="detail-image-wrap">
      <div
        class="detail-image"
        @touchstart="onTouchStart"
        @touchend="onTouchEnd"
        @click="openFullscreen"
      >
        <img :src="images[activeImageIndex]" :alt="item.title" class="detail-image__img" />
        <div class="detail-image__price">¥{{ item.price }}</div>

        <!-- 桌面端左右箭头 -->
        <div v-if="images.length > 1" class="detail-arrow detail-arrow--left" @click.stop="prevImage">
          <t-icon name="chevron-left" size="28px" />
        </div>
        <div v-if="images.length > 1" class="detail-arrow detail-arrow--right" @click.stop="nextImage">
          <t-icon name="chevron-right" size="28px" />
        </div>

        <!-- 图片计数 -->
        <div v-if="images.length > 1" class="detail-image__count">
          {{ activeImageIndex + 1 }} / {{ images.length }}
        </div>
      </div>

      <!-- 缩略图（图片下方） -->
      <div v-if="images.length > 1" class="detail-thumbnails">
        <div
          v-for="(img, idx) in images"
          :key="idx"
          class="detail-thumb"
          :class="{ 'detail-thumb--active': idx === activeImageIndex }"
          @click="activeImageIndex = idx"
        >
          <img :src="img" class="detail-thumb__img" />
        </div>
      </div>
    </div>

    <!-- 基本信息 -->
    <div class="detail-section">
      <h2 class="detail-title">{{ item.title }}</h2>
      <div class="detail-meta">
        <t-tag size="medium" variant="light" theme="primary">{{ item.category }}</t-tag>
        <t-tag size="medium" variant="light" theme="warning">{{ item.condition }}</t-tag>
        <t-tag size="medium" variant="light" theme="default">{{ item.campus }}</t-tag>
      </div>
      <div class="detail-price-row">
        <span class="detail-price">¥{{ item.price }}</span>
        <span class="detail-date">发布于 {{ item.created_at?.slice(0, 10) }}</span>
      </div>
    </div>

    <!-- 卖家信息 -->
    <div class="detail-section">
      <div class="section-header">
        <t-icon name="user" size="18px" />
        <span class="section-header__title">卖家信息</span>
      </div>
      <div class="seller-info">
        <div class="seller-name">{{ item.seller }}</div>
        <div class="seller-contact">
          <span class="label">联系方式：</span>
          <span class="value">{{ item.contact }}</span>
        </div>
        <div class="seller-campus">
          <t-icon name="location" size="14px" style="color: #999" />
          <span>{{ item.campus }}</span>
        </div>
      </div>
    </div>

    <!-- 商品描述 -->
    <div class="detail-section">
      <div class="section-header">
        <t-icon name="view-list" size="18px" />
        <span class="section-header__title">商品描述</span>
      </div>
      <div class="detail-desc">{{ item.description }}</div>
    </div>

    <!-- 底部操作栏 -->
    <div class="detail-footer">
      <t-button variant="outline" size="large" @click="copyContact">复制联系方式</t-button>
      <t-button theme="primary" size="large" @click="onContact">联系卖家</t-button>
    </div>
  </div>

  <!-- 商品不存在 -->
  <div v-else class="empty-page">
    <t-icon name="error-circle" size="80px" style="color: #ddd" />
    <span class="empty-text">商品不存在或已下架</span>
    <t-button theme="primary" size="large" @click="goBack">返回首页</t-button>
  </div>

  <!-- 全屏看图 -->
  <teleport to="body">
    <div v-if="showFullscreen" class="fullscreen-overlay" @click="closeFullscreen">
      <div class="fullscreen-close" @click="closeFullscreen">×</div>
      <div class="fullscreen-counter" v-if="images.length > 1">
        {{ activeImageIndex + 1 }} / {{ images.length }}
      </div>
      <!-- 全屏左右箭头 -->
      <div v-if="images.length > 1" class="fullscreen-arrow fullscreen-arrow--left" @click.stop="prevImage">
        <t-icon name="chevron-left" size="36px" />
      </div>
      <div v-if="images.length > 1" class="fullscreen-arrow fullscreen-arrow--right" @click.stop="nextImage">
        <t-icon name="chevron-right" size="36px" />
      </div>
      <img :src="images[activeImageIndex]" class="fullscreen-img" @click.stop />
    </div>
  </teleport>
</template>

<style scoped>
.detail-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 80px;
}

/* 图片区域 */
.detail-image-wrap {
  background: #f5f5f5;
}

.detail-image {
  position: relative;
  width: 100%;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
}

.detail-image__img {
  width: 100%;
  max-height: 50vh;
  object-fit: contain;
  display: block;
  background: #f5f5f5;
}

.detail-image__price {
  position: absolute;
  bottom: 12px;
  left: 16px;
  padding: 4px 16px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 22px;
  font-weight: 700;
  border-radius: 8px;
}

.detail-image__count {
  position: absolute;
  bottom: 12px;
  right: 16px;
  padding: 4px 12px;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  font-size: 13px;
  border-radius: 12px;
}

/* 桌面端左右箭头 */
.detail-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  display: none;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 5;
}

.detail-arrow--left {
  left: 12px;
}

.detail-arrow--right {
  right: 12px;
}

/* 鼠标设备才显示箭头 */
@media (hover: hover) and (pointer: fine) {
  .detail-arrow {
    display: flex;
  }
}

/* 缩略图（图片下方） */
.detail-thumbnails {
  display: flex;
  gap: 6px;
  padding: 10px 16px;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.detail-thumb {
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  border-radius: 6px;
  overflow: hidden;
  border: 2px solid transparent;
  cursor: pointer;
  transition: border-color 0.2s;
}

.detail-thumb--active {
  border-color: #0052d9;
}

.detail-thumb__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 信息区块 */
.detail-section {
  background: #fff;
  margin: 12px 16px;
  border-radius: 12px;
  padding: 16px;
}

.detail-title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  line-height: 26px;
  margin-bottom: 12px;
}

.detail-meta {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.detail-price-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-price {
  font-size: 24px;
  font-weight: 700;
  color: #e34d59;
}

.detail-date {
  font-size: 12px;
  color: #999;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
}

.section-header__title {
  font-size: 15px;
  font-weight: 500;
  color: #333;
}

.seller-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.seller-name {
  font-size: 16px;
  font-weight: 500;
  color: #333;
}

.seller-contact {
  font-size: 14px;
  color: #666;
}

.seller-contact .label {
  color: #999;
}

.seller-contact .value {
  color: #0052d9;
}

.seller-campus {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #999;
}

.detail-desc {
  font-size: 14px;
  line-height: 24px;
  color: #666;
  white-space: pre-wrap;
}

/* 底部操作栏 */
.detail-footer {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  max-width: 1200px;
  width: 100%;
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  background: #fff;
  border-top: 1px solid #eee;
  z-index: 50;
}

.detail-footer .t-button {
  flex: 1;
}

.loading-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
}

.empty-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  gap: 16px;
}

.empty-text {
  font-size: 16px;
  color: #999;
}

/* 全屏看图 */
.fullscreen-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.95);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fullscreen-img {
  max-width: 95vw;
  max-height: 95vh;
  object-fit: contain;
  cursor: default;
}

.fullscreen-close {
  position: absolute;
  top: 16px;
  right: 20px;
  color: #fff;
  font-size: 36px;
  cursor: pointer;
  z-index: 10;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fullscreen-counter {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  color: #fff;
  font-size: 14px;
  background: rgba(255, 255, 255, 0.2);
  padding: 4px 16px;
  border-radius: 12px;
}

.fullscreen-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 48px;
  height: 48px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #fff;
  z-index: 10;
}

.fullscreen-arrow--left {
  left: 16px;
}

.fullscreen-arrow--right {
  right: 16px;
}
</style>
