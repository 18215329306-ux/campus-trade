<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import { supabase } from '../supabase'
import { user, initAuth } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const item = ref(null)
const loading = ref(true)
const pendingDeal = ref(null)
const doneDeal = ref(null)
const activeImageIndex = ref(0)
const showFullscreen = ref(false)
let touchStartX = 0

const contactLines = computed(() => {
  if (!item.value?.contact) return []
  return (item.value.contact || '').split('\n').filter(Boolean).map(line => {
    const m = line.match(/^(.+?)[：:](.+)$/)
    return m ? { label: m[1].trim(), value: m[2].trim() } : { label: '', value: line }
  })
})

const images = computed(() => {
  if (!item.value?.image) return []
  const img = item.value.image
  return img.includes(',') ? img.split(',') : [img]
})

onMounted(async () => {
  await initAuth()
  const id = route.params.id
  const { data } = await supabase
    .from('goods')
    .select('*')
    .eq('id', id)
    .single()
  item.value = data || null

  // 检查当前用户是否有待确认的交易
  if (user.value && data) {
    const { data: deal } = await supabase
      .from('deals')
      .select('*')
      .eq('goods_id', id)
      .eq('buyer_id', user.value.id)
      .eq('status', 'pending')
      .single()
    pendingDeal.value = deal || null
  }

  // 获取已成交的交易信息
  if (data && data.status === 'sold') {
    const { data: deal } = await supabase
      .from('deals')
      .select('*')
      .eq('goods_id', id)
      .eq('status', 'done')
      .single()
    if (deal) {
      const { data: buyer } = await supabase.from('users').select('name').eq('id', deal.buyer_id).single()
      const { data: seller } = await supabase.from('users').select('name').eq('id', deal.seller_id).single()
      doneDeal.value = {
        ...deal,
        buyerName: buyer?.name || '未知',
        sellerName: seller?.name || '未知',
      }
    }
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

const showContactModal = ref(false)
const contactCopied = ref(false)

// 编辑模式（仅商品所有者）
const isOwner = computed(() => user.value?.id === item.value?.user_id)
const editMode = ref(false)
const editTitle = ref('')
const editPrice = ref('')
const editCategory = ref('')
const editCondition = ref('')
const editDesc = ref('')
const editContact = ref('')
const editLoading = ref(false)
const categories = ['书籍', '电子', '生活', '衣物', '其他']
const conditions = ['全新', '九成新', '八成新', '七成新', '六成新及以下']

function enterEdit() {
  editTitle.value = item.value.title
  editPrice.value = String(item.value.price || '')
  editCategory.value = item.value.category
  editCondition.value = item.value.condition
  editDesc.value = item.value.description
  editContact.value = item.value.contact || ''
  editMode.value = true
}

function cancelEdit() {
  editMode.value = false
}

async function saveEdit() {
  if (!editTitle.value.trim()) return MessagePlugin.warning('请输入商品标题')
  if (!editPrice.value || Number(editPrice.value) < 0) return MessagePlugin.warning('请输入有效价格')
  if (!editDesc.value.trim()) return MessagePlugin.warning('请输入商品描述')
  editLoading.value = true
  const { error } = await supabase
    .from('goods')
    .update({
      title: editTitle.value.trim(),
      price: Number(editPrice.value),
      category: editCategory.value,
      condition: editCondition.value,
      description: editDesc.value.trim(),
      contact: editContact.value.trim(),
    })
    .eq('id', item.value.id)
  editLoading.value = false
  if (error) return MessagePlugin.warning('保存失败')
  item.value = { ...item.value, title: editTitle.value.trim(), price: Number(editPrice.value), category: editCategory.value, condition: editCondition.value, description: editDesc.value.trim(), contact: editContact.value.trim() }
  editMode.value = false
  MessagePlugin.success('已保存')
}

function openContact() {
  if (!item.value) return
  showContactModal.value = true
}

async function copySingleContact(text) {
  try {
    await navigator.clipboard.writeText(text)
    contactCopied.value = true
    setTimeout(() => { contactCopied.value = false }, 5000)
  } catch {
    MessagePlugin.warning('复制失败，请手动复制')
  }
}

// 举报
const showReport = ref(false)
const reportReason = ref('')
const reporting = ref(false)

async function submitReport() {
  if (!reportReason.value.trim()) return MessagePlugin.warning('请填写举报原因')
  reporting.value = true
  const { error } = await supabase.from('reports').insert({
    reporter_id: user.value?.id,
    reported_user_id: item.value?.user_id,
    goods_id: item.value?.id,
    reason: reportReason.value.trim(),
  })
  reporting.value = false
  if (error) {
    MessagePlugin.warning('举报失败')
  } else {
    MessagePlugin.success('举报已提交')
    showReport.value = false

    // 检查举报次数，>=3 自动下架
    const { count } = await supabase
      .from('reports')
      .select('*', { count: 'exact', head: true })
      .eq('goods_id', item.value.id)
    if (count >= 3) {
      await supabase.from('goods').update({ status: 'cancelled', cancel_reason: `被举报 ${count} 次，系统自动下架` }).eq('id', item.value.id)
      item.value.status = 'cancelled'
    }

    // 更新被举报用户的信誉分
    const { data: reported } = await supabase.from('users').select('reputation').eq('id', item.value?.user_id).single()
    const oldRep = reported?.reputation ?? 5.0
    const newRep = Math.max(0, Math.round((oldRep - 0.5) * 10) / 10)
    await supabase.from('users').update({ reputation: newRep }).eq('id', item.value?.user_id)
    await supabase.from('reputation_logs').insert({
      user_id: item.value?.user_id,
      change: Math.round((newRep - oldRep) * 10) / 10,
      reason: `被举报：${reportReason.value.trim()} (${oldRep} → ${newRep})`,
    })
    reportReason.value = ''
  }
}

// 管理员操作
const adminLoading = ref(false)

async function adminRemoveGoods() {
  adminLoading.value = true
  const { error } = await supabase.from('goods').update({ status: 'cancelled', cancel_reason: '管理员强制下架' }).eq('id', item.value.id)
  adminLoading.value = false
  if (error) return MessagePlugin.warning('操作失败')
  MessagePlugin.success('商品已下架')
  item.value.status = 'cancelled'
}

async function adminBanUser() {
  if (!item.value.user_id) return
  adminLoading.value = true
  const { error } = await supabase.from('users').update({ banned: true }).eq('id', item.value.user_id)
  adminLoading.value = false
  if (error) return MessagePlugin.warning('操作失败')
  MessagePlugin.success('发布者已被封禁')
}

function toLocalTime(utcStr) {
  if (!utcStr) return ''
  const d = new Date(utcStr.includes('T') ? utcStr : utcStr.replace(' ', 'T') + 'Z')
  if (isNaN(d.getTime())) return utcStr.slice(0, 16).replace('T', ' ')
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
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
    <!-- 顶部返回 -->
    <div class="detail-topbar">
      <t-button variant="text" @click="goBack">
        <t-icon name="chevron-left" size="24px" />
        返回
      </t-button>
    </div>

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


    <!-- 编辑模式 -->
    <template v-if="editMode">
      <div class="detail-section">
        <div class="form-label">商品标题</div>
        <t-input v-model="editTitle" maxlength="30" size="large" />
      </div>
      <div class="detail-section">
        <div class="form-label">价格（元）</div>
        <t-input v-model="editPrice" type="number" size="large" />
      </div>
      <div class="detail-section">
        <div class="form-label">分类</div>
        <div class="tag-row">
          <t-check-tag v-for="cat in categories" :key="cat" :checked="editCategory === cat" size="medium" variant="dark" @click="editCategory = cat">{{ cat }}</t-check-tag>
        </div>
      </div>
      <div class="detail-section">
        <div class="form-label">成色</div>
        <div class="tag-row">
          <t-check-tag v-for="cond in conditions" :key="cond" :checked="editCondition === cond" size="medium" variant="dark" @click="editCondition = cond">{{ cond }}</t-check-tag>
        </div>
      </div>
      <div class="detail-section">
        <div class="form-label">商品描述</div>
        <t-textarea v-model="editDesc" maxlength="500" :autosize="{ minRows: 4, maxRows: 8 }" />
      </div>
      <div class="detail-section">
        <div class="form-label">联系方式</div>
        <t-textarea v-model="editContact" placeholder="微信：xxx&#10;QQ：xxx&#10;电话：xxx" :autosize="{ minRows: 3, maxRows: 6 }" />
      </div>
    </template>

    <!-- 查看模式 -->
    <template v-else>
      <!-- 基本信息 -->
      <div class="detail-section">
        <h2 class="detail-title">{{ item.title }}</h2>
        <div class="detail-meta">
          <t-tag size="medium" variant="light" theme="primary">{{ item.category }}</t-tag>
          <t-tag size="medium" variant="light" theme="warning">{{ item.condition }}</t-tag>
          <t-tag size="medium" variant="light" theme="default">{{ item.campus }}</t-tag>
          <t-tag v-if="item.status === 'sold'" size="medium" variant="light" theme="danger">已成交</t-tag>
          <t-tag v-else-if="item.status === 'dealing'" size="medium" variant="light" theme="warning">交易中</t-tag>
          <t-tag v-else-if="item.status === 'cancelled'" size="medium" variant="light" theme="default">已取消</t-tag>
        </div>
        <div class="detail-price-row">
          <span class="detail-price">¥{{ item.price }}</span>
          <span class="detail-date">发布于 {{ toLocalTime(item.created_at) }}</span>
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

      <!-- 卖家信息 -->
      <div class="detail-section">
        <div class="section-header">
          <t-icon name="user" size="18px" />
          <span class="section-header__title">卖家信息</span>
        </div>
        <div class="seller-info">
          <div class="seller-name">{{ item.seller }}</div>
          <div class="seller-contact">
            <div class="label">联系方式：</div>
            <div class="contact-lines">
              <div v-for="(line, i) in (item.contact || '').split('\n').filter(Boolean)" :key="i" class="value">{{ line }}</div>
            </div>
          </div>
          <div class="seller-campus">
            <t-icon name="location" size="14px" style="color: #999" />
            <span>{{ item.campus }}</span>
          </div>
        </div>
      </div>
    </template>


    <!-- 成交信息 -->
    <div v-if="doneDeal" class="detail-section">
      <div class="section-header">
        <t-icon name="check-circle" size="18px" style="color:#2ba471" />
        <span class="section-header__title">成交信息</span>
      </div>
      <div class="deal-info-list">
        <div class="deal-info-row">
          <span class="deal-info-label">最终成交价</span>
          <span class="deal-info-value deal-info-price">¥{{ doneDeal.final_price }}</span>
        </div>
        <div class="deal-info-row">
          <span class="deal-info-label">买家</span>
          <span class="deal-info-value">{{ doneDeal.buyerName }}</span>
        </div>
        <div class="deal-info-row">
          <span class="deal-info-label">卖家</span>
          <span class="deal-info-value">{{ doneDeal.sellerName }}</span>
        </div>
        <div class="deal-info-row">
          <span class="deal-info-label">成交时间</span>
          <span class="deal-info-value">{{ toLocalTime(doneDeal.updated_at) }}</span>
        </div>
        <div v-if="doneDeal.seller_note" class="deal-info-row">
          <span class="deal-info-label">卖家评价</span>
          <span class="deal-info-value">{{ doneDeal.seller_note }}</span>
        </div>
        <div v-if="doneDeal.buyer_note" class="deal-info-row">
          <span class="deal-info-label">买家评价</span>
          <span class="deal-info-value">{{ doneDeal.buyer_note }}</span>
        </div>
      </div>
    </div>

    <!-- 底部操作栏 -->
    <div class="detail-footer">
      <t-button v-if="pendingDeal" theme="primary" size="large" @click="router.push('/my')">确认交易</t-button>
      <template v-else-if="editMode">
        <t-button theme="primary" size="large" style="flex:1" :loading="editLoading" @click="saveEdit">保存修改</t-button>
        <t-button variant="outline" size="large" style="flex:1" @click="cancelEdit">取消</t-button>
      </template>
      <template v-else-if="isOwner">
        <t-button theme="primary" size="large" style="flex:1" @click="enterEdit">编辑商品</t-button>
      </template>
      <template v-else>
        <t-button theme="primary" size="large" style="flex:2" @click="openContact">联系卖家</t-button>
        <t-button theme="danger" size="large" style="flex:1" @click="showReport = true">举报</t-button>
      </template>
    </div>

    <!-- 管理员操作 -->
    <div v-if="user?.role === 'admin'" class="detail-admin-bar">
      <t-button theme="danger" variant="outline" size="large" block :loading="adminLoading" @click="adminRemoveGoods">下架该商品</t-button>
      <t-button v-if="item.user_id" theme="danger" size="large" block :loading="adminLoading" @click="adminBanUser">封禁发布者</t-button>
    </div>

  
  <!-- 联系卖家弹窗 -->
  <teleport to="body">
    <div v-if="showContactModal" class="modal-overlay" @click.self="showContactModal = false">
      <div class="modal-card">
        <div class="modal-header">
          <span class="modal-title">联系卖家</span>
          <span class="modal-close" @click="showContactModal = false">&times;</span>
        </div>
        <div class="modal-body">
          <div v-if="contactCopied" class="contact-toast">
            <t-icon name="check-circle" size="18px" style="color:#2ba471" />
            <span>已复制！请前往对应渠道联系卖家</span>
          </div>
          <div v-for="(c, i) in contactLines" :key="i" class="contact-line">
            <div class="contact-line__info">
              <span class="contact-line__label">{{ c.label }}</span>
              <span class="contact-line__value">{{ c.value }}</span>
            </div>
            <t-button size="small" variant="outline" @click="copySingleContact(c.value)">复制</t-button>
          </div>
        </div>
      </div>
    </div>
  </teleport>

  <!-- 举报弹窗 -->
    <div v-if="showReport" class="report-overlay" @click.self="showReport = false">
      <div class="report-card">
        <h4>举报此商品</h4>
        <t-textarea v-model="reportReason" placeholder="请描述举报原因..." :autosize="{ minRows: 3 }" />
        <div class="report-btns">
          <t-button variant="outline" @click="showReport = false">取消</t-button>
          <t-button theme="danger" :loading="reporting" @click="submitReport">提交举报</t-button>
        </div>
      </div>
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
      <div v-if="images.length > 1" class="fullscreen-arrow fullscreen-arrow--left" @click.stop="prevImage">
        <t-icon name="chevron-left" size="36px" />
      </div>
      <div v-if="images.length > 1" class="fullscreen-arrow fullscreen-arrow--right" @click.stop="nextImage">
        <t-icon name="chevron-right" size="36px" />
      </div>
      <img :src="images[activeImageIndex]" class="fullscreen-img" @click.stop />
    </div>
  </teleport>

    

    <div class="app-version">版本 1.0</div>
</template>

<style scoped>
.detail-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 80px;
}

.detail-topbar {
  padding: 8px 8px;
  background: #fff;
  position: sticky;
  top: 0;
  z-index: 10;
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
  margin-bottom: 4px;
}

.contact-lines {
  display: flex;
  flex-direction: column;
  gap: 4px;
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

.deal-info-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.deal-info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.deal-info-label {
  font-size: 13px;
  color: #999;
}

.deal-info-value {
  font-size: 14px;
  color: #333;
}

.deal-info-price {
  font-size: 16px;
  font-weight: 700;
  color: #e34d59;
}

.form-label {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  margin-bottom: 8px;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
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
  max-width: 1120px;
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

.detail-admin-bar {
  position: fixed;
  bottom: 68px;
  left: 50%;
  transform: translateX(-50%);
  max-width: 1120px;
  width: 100%;
  display: flex;
  gap: 8px;
  padding: 8px 16px;
  z-index: 50;
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


/* 联系卖家弹窗 */
.contact-toast {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: #e8f8f2;
  border-radius: 8px;
  font-size: 13px;
  color: #2ba471;
  margin-bottom: 4px;
}

.contact-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid #f5f5f5;
  gap: 12px;
}

.contact-line:last-child {
  border-bottom: none;
}

.contact-line__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.contact-line__label {
  font-size: 11px;
  color: #999;
}

.contact-line__value {
  font-size: 14px;
  color: #333;
  word-break: break-all;
}

/* 举报弹窗 */
.report-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.report-card {
  width: 100%;
  max-width: 360px;
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.report-card h4 {
  font-size: 17px;
  color: #333;
}

.report-btns {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.app-version {
  text-align: center;
  padding: 16px;
  font-size: 11px;
  color: #ccc;
}

/* 弹窗 */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal-card {
  width: 100%;
  max-width: 380px;
  background: #fff;
  border-radius: 14px;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px 0;
}

.modal-title {
  font-size: 17px;
  font-weight: 600;
  color: #333;
}

.modal-close {
  font-size: 24px;
  color: #999;
  cursor: pointer;
  line-height: 1;
}

.modal-body {
  padding: 18px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 0;
}
</style>
