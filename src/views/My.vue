<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import { supabase } from '../supabase'
import { user, signOut, initAuth, authReady, verifyPhone, resetPassword } from '../stores/auth'
import ProductCard from '../components/ProductCard.vue'

const router = useRouter()

// 修改密码
const showChangePwd = ref(false)
const changePwdPhone = ref('')
const changePwdNew = ref('')
const changePwdLoading = ref(false)
const changePwdStep = ref(1)

function openChangePwd() {
  changePwdPhone.value = ''
  changePwdNew.value = ''
  changePwdStep.value = 1
  showChangePwd.value = true
}

async function handleVerifyPhoneForChange() {
  if (!changePwdPhone.value.trim()) return MessagePlugin.warning('请输入联系电话')
  changePwdLoading.value = true
  const valid = await verifyPhone(user.value.username, changePwdPhone.value.trim())
  changePwdLoading.value = false
  if (!valid) return MessagePlugin.warning('手机号不匹配')
  changePwdStep.value = 2
}

async function handleChangePwd() {
  if (!changePwdNew.value) return MessagePlugin.warning('请输入新密码')
  if (changePwdNew.value.length < 6) return MessagePlugin.warning('密码至少6位')
  changePwdLoading.value = true
  const { error } = await resetPassword(user.value.username, changePwdPhone.value.trim(), changePwdNew.value)
  changePwdLoading.value = false
  if (error) return MessagePlugin.warning(error.message)
  MessagePlugin.success('密码修改成功')
  showChangePwd.value = false
}

// 系统消息
const showNotifications = ref(false)
const notifications = ref([])
const unreadCount = ref(0)

async function fetchNotifications() {
  if (!user.value) return
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.value.id)
    .order('created_at', { ascending: false })
    .limit(20)
  notifications.value = data || []
  unreadCount.value = notifications.value.filter(n => !n.read).length
}

async function readNotification(n) {
  if (n.read) return
  await supabase.from('notifications').update({ read: true }).eq('id', n.id)
  n.read = true
  unreadCount.value = notifications.value.filter(x => !x.read).length
}

async function clearAllNotifications() {
  await supabase.from('notifications').delete().eq('user_id', user.value.id)
  notifications.value = []
  unreadCount.value = 0
}

const myGoods = ref([])
const loading = ref(true)
const tab = ref('published')

onMounted(async () => {
  await initAuth()
  if (!user.value) {
    router.push('/login')
    return
  }
  await fetchMyGoods()
})

async function fetchMyGoods() {
  if (!user.value) return
  loading.value = true
  const { data } = await supabase
    .from('goods')
    .select('*')
    .eq('user_id', user.value.id)
    .order('created_at', { ascending: false })
  myGoods.value = data || []
  loading.value = false
}

const filteredGoods = computed(() => {
  if (tab.value === 'all') return myGoods.value
  return myGoods.value.filter(g => g.status === tab.value)
})

async function cancelGoods(id) {
  const { error } = await supabase
    .from('goods')
    .update({ status: 'cancelled' })
    .eq('id', id)
  if (!error) {
    MessagePlugin.success('已取消发布')
    fetchMyGoods()
  }
}

async function markSold(id) {
  const { error } = await supabase
    .from('goods')
    .update({ status: 'sold' })
    .eq('id', id)
  if (!error) {
    MessagePlugin.success('已确认成交')
    fetchMyGoods()
  }
}

async function republish(id) {
  const { error } = await supabase
    .from('goods')
    .update({ status: 'published' })
    .eq('id', id)
  if (!error) {
    MessagePlugin.success('已重新发布')
    fetchMyGoods()
  }
}

function handleLogout() {
  signOut()
  router.push('/login')
}

function onCardClick(id) {
  const url = router.resolve(`/detail/${id}`).href
  window.open(url, '_blank')
}

import { computed } from 'vue'
</script>

<template>
  <div v-if="!authReady" class="loading-page">
    <t-loading size="medium" text="加载中..." />
  </div>
  <div v-else-if="!user" class="loading-page">
    <t-loading size="medium" text="请先登录..." />
  </div>
  <div v-else class="my-page">
    <!-- 用户信息 -->
    <div class="my-header">
      <div class="my-avatar">{{ user?.name?.charAt(0) || 'U' }}</div>
      <div class="my-info">
        <div class="my-name">{{ user?.name }}</div>
        <div class="my-school">{{ user?.school }}</div>
      </div>
      <div class="my-header-actions">
        <t-button size="small" variant="text" @click="openChangePwd">修改密码</t-button>
        <t-badge :count="unreadCount" :offset="[-4, 4]">
          <t-button size="small" variant="text" @click="fetchNotifications(); showNotifications = true">系统消息</t-button>
        </t-badge>
        <t-button v-if="user?.role === 'admin'" size="small" variant="text" theme="primary" @click="router.push('/admin')">管理后台</t-button>
        <t-button size="small" variant="outline" @click="handleLogout">退出</t-button>
      </div>
    </div>

    <!-- 状态切换 -->
    <div class="my-tabs">
      <div
        v-for="t in [
          { key: 'published', label: '已发布' },
          { key: 'sold', label: '已成交' },
          { key: 'cancelled', label: '已取消' },
        ]"
        :key="t.key"
        class="my-tab"
        :class="{ 'my-tab--active': tab === t.key }"
        @click="tab = t.key"
      >
        {{ t.label }}
      </div>
    </div>

    <!-- 商品列表 -->
    <div class="my-content">
      <div v-if="loading" class="my-loading">
        <t-loading size="medium" />
      </div>
      <div v-else-if="filteredGoods.length > 0" class="my-list">
        <div v-for="goods in filteredGoods" :key="goods.id" class="my-item">
          <div class="my-item__image" @click="onCardClick(goods.id)">
            <img
              :src="goods.image?.includes(',') ? goods.image.split(',')[0] : goods.image"
              class="my-item__img"
            />
          </div>
          <div class="my-item__info" @click="onCardClick(goods.id)">
            <div class="my-item__title">{{ goods.title }}</div>
            <div class="my-item__price">¥{{ goods.price }}</div>
            <div class="my-item__date">{{ goods.created_at?.slice(0, 10) }}</div>
          </div>
          <div class="my-item__actions">
            <t-button
              v-if="goods.status === 'published'"
              size="small"
              theme="primary"
              variant="text"
              @click="markSold(goods.id)"
            >
              确认成交
            </t-button>
            <t-button
              v-if="goods.status === 'published'"
              size="small"
              theme="danger"
              variant="text"
              @click="cancelGoods(goods.id)"
            >
              取消发布
            </t-button>
            <t-button
              v-if="goods.status === 'cancelled' || goods.status === 'sold'"
              size="small"
              variant="text"
              @click="republish(goods.id)"
            >
              重新发布
            </t-button>
          </div>
        </div>
      </div>
      <div v-else class="my-empty">
        <t-icon name="inbox" size="60px" style="color: #ddd" />
        <span>暂无商品</span>
      </div>
    </div>
  </div>

  <!-- 系统消息弹窗 -->
  <teleport to="body">
    <div v-if="showNotifications" class="modal-overlay" @click.self="showNotifications = false">
      <div class="modal-card modal-card--wide">
        <div class="modal-header">
          <span class="modal-title">系统消息</span>
          <div style="display:flex;gap:8px;align-items:center">
            <t-button v-if="notifications.length > 0" size="small" variant="text" theme="danger" @click="clearAllNotifications">清空</t-button>
            <span class="modal-close" @click="showNotifications = false">&times;</span>
          </div>
        </div>
        <div class="modal-body modal-body--scroll">
          <div v-if="notifications.length === 0" style="text-align:center;color:#999;padding:40px 0">暂无消息</div>
          <div
            v-for="n in notifications"
            :key="n.id"
            class="notif-item"
            :class="{ 'notif-item--unread': !n.read }"
            @click="readNotification(n)"
          >
            <div class="notif-item__dot" v-if="!n.read"></div>
            <div class="notif-item__content">
              <div class="notif-item__title">{{ n.title }}</div>
              <div class="notif-item__text">{{ n.content }}</div>
              <div class="notif-item__time">{{ n.created_at?.slice(0, 16).replace('T', ' ') }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </teleport>

  <!-- 修改密码弹窗 -->
  <teleport to="body">
    <div v-if="showChangePwd" class="modal-overlay" @click.self="showChangePwd = false">
      <div class="modal-card">
        <div class="modal-header">
          <span class="modal-title">修改密码</span>
          <span class="modal-close" @click="showChangePwd = false">&times;</span>
        </div>
        <div class="modal-body">
          <template v-if="changePwdStep === 1">
            <p class="modal-hint">请输入注册时填写的手机号验证身份</p>
            <t-input v-model="changePwdPhone" placeholder="联系电话" clearable size="large" />
            <t-button theme="primary" size="large" block :loading="changePwdLoading" @click="handleVerifyPhoneForChange">验证</t-button>
          </template>
          <template v-else>
            <p class="modal-hint">验证通过，设置新密码</p>
            <t-input v-model="changePwdNew" type="password" placeholder="新密码（至少6位）" clearable size="large" />
            <t-button theme="primary" size="large" block :loading="changePwdLoading" @click="handleChangePwd">确认修改</t-button>
          </template>
        </div>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
.my-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 80px;
}

.my-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 16px;
  background: #fff;
  margin-bottom: 12px;
}

.my-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #0052d9;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 600;
}

.my-info {
  flex: 1;
}

.my-name {
  font-size: 17px;
  font-weight: 600;
  color: #333;
}

.my-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.my-school {
  font-size: 13px;
  color: #999;
  margin-top: 2px;
}

.my-tabs {
  display: flex;
  gap: 0;
  background: #fff;
  padding: 0 16px;
  border-bottom: 1px solid #f0f0f0;
}

.my-tab {
  padding: 12px 20px;
  font-size: 14px;
  color: #666;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.my-tab--active {
  color: #0052d9;
  border-bottom-color: #0052d9;
}

.my-content {
  padding: 12px 16px;
}

.my-loading {
  display: flex;
  justify-content: center;
  padding-top: 80px;
}

.my-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.my-item {
  display: flex;
  gap: 12px;
  background: #fff;
  border-radius: 12px;
  padding: 12px;
}

.my-item__image {
  width: 80px;
  height: 80px;
  flex-shrink: 0;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
}

.my-item__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.my-item__info {
  flex: 1;
  cursor: pointer;
  min-width: 0;
}

.my-item__title {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.my-item__price {
  font-size: 16px;
  font-weight: 600;
  color: #e34d59;
  margin-top: 4px;
}

.my-item__date {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.my-item__actions {
  display: flex;
  flex-direction: column;
  gap: 2px;
  justify-content: center;
  flex-shrink: 0;
}

.my-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding-top: 80px;
  color: #999;
  font-size: 14px;
}

.loading-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
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
  border-radius: 12px;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 0;
}

.modal-title {
  font-size: 17px;
  font-weight: 600;
}

.modal-close {
  font-size: 24px;
  color: #999;
  cursor: pointer;
}

.modal-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.modal-hint {
  font-size: 14px;
  color: #666;
  text-align: center;
}

.modal-card--wide {
  max-width: 420px;
}

.modal-body--scroll {
  max-height: 60vh;
  overflow-y: auto;
}

.notif-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  border-radius: 8px;
  background: #f9f9f9;
  cursor: pointer;
}

.notif-item--unread {
  background: #e8f0fe;
}

.notif-item__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #e34d59;
  flex-shrink: 0;
  margin-top: 6px;
}

.notif-item__content {
  flex: 1;
  min-width: 0;
}

.notif-item__title {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.notif-item__text {
  font-size: 13px;
  color: #666;
  margin-top: 2px;
}

.notif-item__time {
  font-size: 11px;
  color: #bbb;
  margin-top: 4px;
}
</style>
