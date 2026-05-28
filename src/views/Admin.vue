<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import { supabase } from '../supabase'
import { user, initAuth } from '../stores/auth'

const router = useRouter()

const tab = ref('goods')
const goodsList = ref([])
const usersList = ref([])
const reportsList = ref([])
const loading = ref(false)
const goodsSearch = ref('')
const usersSearch = ref('')

const filteredGoods = computed(() => {
  if (!goodsSearch.value) return goodsList.value
  const kw = goodsSearch.value.toLowerCase()
  return goodsList.value.filter(g => g.title?.toLowerCase().includes(kw))
})

const filteredUsers = computed(() => {
  if (!usersSearch.value) return usersList.value
  const kw = usersSearch.value.toLowerCase()
  return usersList.value.filter(u =>
    u.username?.toLowerCase().includes(kw) ||
    u.name?.toLowerCase().includes(kw) ||
    u.school?.toLowerCase().includes(kw)
  )
})

onMounted(async () => {
  await initAuth()
  if (!user.value || user.value.role !== 'admin') {
    router.push('/')
    return
  }
  fetchGoods()
})

async function fetchGoods() {
  loading.value = true
  const { data } = await supabase.from('goods').select('*').order('created_at', { ascending: false })
  goodsList.value = data || []
  loading.value = false
}

async function fetchUsers() {
  loading.value = true
  const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false })
  usersList.value = data || []
  loading.value = false
}

async function fetchReports() {
  loading.value = true
  const { data } = await supabase
    .from('reports')
    .select('*, reporter:reporter_id(username), reported:reported_user_id(username)')
    .order('created_at', { ascending: false })
  reportsList.value = data || []
  loading.value = false
}

function switchTab(t) {
  tab.value = t
  if (t === 'goods') fetchGoods()
  else if (t === 'users') fetchUsers()
  else if (t === 'reports') fetchReports()
}

async function deleteGoods(id) {
  const { error } = await supabase.from('goods').update({ status: 'cancelled' }).eq('id', id)
  if (!error) {
    MessagePlugin.success('已下架')
    fetchGoods()
  }
}

async function toggleBan(uid, currentBanned) {
  const { error } = await supabase.from('users').update({ banned: !currentBanned }).eq('id', uid)
  if (!error) {
    MessagePlugin.success(currentBanned ? '已解封' : '已封禁')
    fetchUsers()
  }
}

async function resolveReport(r) {
  const { error } = await supabase.from('reports').update({ status: 'resolved' }).eq('id', r.id)
  if (error) return

  // 通知举报人：举报已处理
  await supabase.from('notifications').insert({
    user_id: r.reporter_id,
    type: 'report_resolved',
    title: '举报已处理',
    content: '您提交的举报已被管理员处理。',
  })
  // 通知被举报人
  if (r.reported_user_id) {
    await supabase.from('notifications').insert({
      user_id: r.reported_user_id,
      type: 'reported',
      title: '您收到一条举报提醒',
      content: '您的行为被其他用户举报，请注意交易规范。如有疑问请联系管理员。',
    })
  }

  MessagePlugin.success('已处理')
  fetchReports()
}

function goBack() {
  router.push('/')
}
</script>

<template>
  <div class="admin-page">
    <div class="admin-header">
      <t-button variant="text" @click="goBack">← 返回</t-button>
      <span class="admin-title">管理后台</span>
      <div style="width: 60px"></div>
    </div>

    <div class="admin-tabs">
      <div class="admin-tab" :class="{ 'admin-tab--active': tab === 'goods' }" @click="switchTab('goods')">商品管理</div>
      <div class="admin-tab" :class="{ 'admin-tab--active': tab === 'users' }" @click="switchTab('users')">用户管理</div>
      <div class="admin-tab" :class="{ 'admin-tab--active': tab === 'reports' }" @click="switchTab('reports')">举报处理</div>
    </div>

    <div class="admin-content">
      <t-loading v-if="loading" size="medium" class="admin-loading" />

      <!-- 商品管理 -->
      <div v-else-if="tab === 'goods'">
        <div class="admin-search-bar">
          <t-input v-model="goodsSearch" placeholder="搜索商品标题..." clearable size="small" />
        </div>
        <div class="admin-list">
        <div v-for="g in filteredGoods" :key="g.id" class="admin-item">
          <div class="admin-item__info">
            <span class="admin-item__title">{{ g.title }}</span>
            <span class="admin-item__meta">¥{{ g.price }} · {{ g.status || 'published' }}</span>
          </div>
          <t-button v-if="g.status === 'published' || !g.status" size="small" theme="danger" variant="text" @click="deleteGoods(g.id)">下架</t-button>
        </div>
        <div v-if="filteredGoods.length === 0" class="admin-empty">暂无商品</div>
        </div>
      </div>

      <!-- 用户管理 -->
      <div v-else-if="tab === 'users'">
        <div class="admin-search-bar">
          <t-input v-model="usersSearch" placeholder="搜索用户名、姓名、学校..." clearable size="small" />
        </div>
        <div class="admin-list">
        <div v-for="u in filteredUsers" :key="u.id" class="admin-item">
          <div class="admin-item__info">
            <span class="admin-item__title">{{ u.name }}</span>
            <span class="admin-item__meta">{{ u.username }} · {{ u.school }} {{ u.role === 'admin' ? '· 管理员' : '' }} {{ u.banned ? '· 已封禁' : '' }}</span>
          </div>
          <t-button
            v-if="u.role !== 'admin'"
            size="small"
            :theme="u.banned ? 'success' : 'danger'"
            variant="text"
            @click="toggleBan(u.id, u.banned)"
          >
            {{ u.banned ? '解封' : '封禁' }}
          </t-button>
        </div>
        <div v-if="filteredUsers.length === 0" class="admin-empty">暂无用户</div>
        </div>
      </div>

      <!-- 举报处理 -->
      <div v-else-if="tab === 'reports'" class="admin-list">
        <div v-for="r in reportsList" :key="r.id" class="admin-item admin-item--column">
          <div class="admin-item__info">
            <span class="admin-item__title">举报人：{{ r.reporter?.username || '未知' }} → 被举报人：{{ r.reported?.username || '未知' }}</span>
            <span class="admin-item__meta">原因：{{ r.reason }}</span>
            <span class="admin-item__meta">状态：{{ r.status === 'pending' ? '待处理' : '已处理' }}</span>
          </div>
          <t-button v-if="r.status === 'pending'" size="small" theme="primary" variant="text" @click="resolveReport(r)">标记已处理</t-button>
        </div>
        <div v-if="reportsList.length === 0" class="admin-empty">暂无举报</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 40px;
}

.admin-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #fff;
  position: sticky;
  top: 0;
  z-index: 10;
}

.admin-title {
  font-size: 17px;
  font-weight: 600;
}

.admin-tabs {
  display: flex;
  gap: 0;
  background: #fff;
  padding: 0 16px;
  border-bottom: 1px solid #f0f0f0;
}

.admin-tab {
  padding: 12px 16px;
  font-size: 14px;
  color: #666;
  cursor: pointer;
  border-bottom: 2px solid transparent;
}

.admin-tab--active {
  color: #0052d9;
  border-bottom-color: #0052d9;
}

.admin-content {
  padding: 12px 16px;
}

.admin-search-bar {
  margin-bottom: 12px;
}

.admin-loading {
  display: flex;
  justify-content: center;
  padding-top: 80px;
}

.admin-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.admin-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-radius: 10px;
  padding: 12px;
}

.admin-item--column {
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.admin-item__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.admin-item__title {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.admin-item__meta {
  font-size: 12px;
  color: #999;
}

.admin-empty {
  text-align: center;
  color: #999;
  padding-top: 60px;
  font-size: 14px;
}
</style>
