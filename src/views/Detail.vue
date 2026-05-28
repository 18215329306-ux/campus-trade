<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import { supabase } from '../supabase'

const route = useRoute()
const router = useRouter()
const item = ref(null)

onMounted(async () => {
  const id = route.params.id
  const { data } = await supabase
    .from('goods')
    .select('*')
    .eq('id', id)
    .single()
  item.value = data || null
})

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
  <div v-if="item" class="detail-page">
    <!-- 商品图片 -->
    <div class="detail-image">
      <img :src="item.image" :alt="item.title" class="detail-image__img" />
      <div class="detail-image__price">¥{{ item.price }}</div>
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
        <span class="detail-date">发布于 {{ item.created_at }}</span>
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
</template>

<style scoped>
.detail-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 80px;
}

.detail-image {
  position: relative;
  width: 100%;
  background: #eee;
}

.detail-image__img {
  width: 100%;
  height: 60vh;
  object-fit: cover;
  display: block;
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

.detail-footer {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 480px;
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  background: #fff;
  border-top: 1px solid #eee;
  z-index: 50;
}

@media (min-width: 768px) {
  .detail-footer {
    max-width: 960px;
  }
}

@media (min-width: 1200px) {
  .detail-footer {
    max-width: 1120px;
  }
}

.detail-footer .t-button {
  flex: 1;
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
</style>
