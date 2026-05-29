<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import { supabase } from '../supabase'
import { user, initAuth } from '../stores/auth'

const router = useRouter()

const tab = ref('goods')

async function fetchStats() {
  statsLoading.value = true
  
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }

  const [visitRes, goodsRes, dealsRes, usersRes, detailDeals] = await Promise.all([
    supabase.from('visit_logs').select('created_at'),
    supabase.from('goods').select('created_at'),
    supabase.from('deals').select('final_price, status, created_at, goods_id, seller_id, buyer_id'),
    supabase.from('users').select('created_at'),
    supabase.from('deals').select('*, goods:goods_id(*), seller:seller_id(name,school), buyer:buyer_id(name,school)').eq('status', 'done').order('updated_at', { ascending: false }),
  ])

  const allVisits = visitRes.data || []
  const allGoods = goodsRes.data || []
  const allUsers = usersRes.data || []
  const doneDeals = (dealsRes.data || []).filter(d => d.status === 'done')
  
  // 7天每日数据
  const dailyData = days.map(day => {
    const dayVisits = allVisits.filter(v => (v.created_at || '').startsWith(day)).length
    const dayGoods = allGoods.filter(g => (g.created_at || '').startsWith(day)).length
    const dayUsers = allUsers.filter(u => (u.created_at || '').startsWith(day)).length
    const dayDeals = doneDeals.filter(d => (d.created_at || '').startsWith(day))
    return {
      date: day.slice(5),
      visits: dayVisits,
      goods: dayGoods,
      users: dayUsers,
      deals: dayDeals.length,
      amount: dayDeals.reduce((s, d) => s + Number(d.final_price || 0), 0),
    }
  })

  const maxV = (arr, key) => Math.max(1, ...dailyData.map(d => d[key]))
  
  stats.value = {
    totalVisits: allVisits.length,
    totalGoods: allGoods.length,
    totalUsers: allUsers.length,
    totalDeals: doneDeals.length,
    totalAmount: doneDeals.reduce((s, d) => s + Number(d.final_price || 0), 0),
    avgAmount: doneDeals.length > 0 ? (doneDeals.reduce((s, d) => s + Number(d.final_price || 0), 0) / doneDeals.length).toFixed(2) : 0,
    dailyData,
    maxVisits: maxV(dailyData, 'visits'),
    maxGoods: maxV(dailyData, 'goods'),
    maxUsers: maxV(dailyData, 'users'),
    maxDeals: maxV(dailyData, 'deals'),
    maxAmount: maxV(dailyData, 'amount'),
    dealDetails: detailDeals.data || [],
  }
  statsLoading.value = false
}

function exportCSV() {
  if (!stats.value) return
  const s = stats.value
  let csv = '\uFEFF指标,数值\n'
  csv += `总访问量,${s.totalVisits}\n总注册用户数,${s.totalUsers}\n商品总数,${s.totalGoods}\n`
  csv += `成交总数,${s.totalDeals}\n成交总金额,${s.totalAmount}\n平均成交价,${s.avgAmount}\n\n`
  csv += '日期,访问量,新用户,新商品,成交数,成交金额\n'
  s.dailyData.forEach(d => { csv += `${d.date},${d.visits},${d.users},${d.goods},${d.deals},${d.amount}\n` })
  csv += '\n交易明细\n商品名称,分类,成色,原价,成交价,卖家,卖家学校,买家,买家学校,联系方式,商品描述,发布时间,成交时间\n'
  s.dealDetails.forEach(d => {
    const g = d.goods || {}
    csv += `"${g.title || ''}","${g.category || ''}","${g.condition || ''}",${g.price || ''},${d.final_price},"${d.seller?.name || ''}","${d.seller?.school || ''}","${d.buyer?.name || ''}","${d.buyer?.school || ''}","${(g.contact || '').replace(/"/g, '""')}","${(g.description || '').replace(/"/g, '""')}","${g.created_at?.slice(0,16) || ''}","${d.updated_at?.slice(0,16) || ''}"\n`
  })
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob); const a = document.createElement('a')
  a.href = url; a.download = `统计数据_${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url)
}

async function fetchFeedbacks() {
  const { data } = await supabase
    .from('feedbacks')
    .select('*, user:user_id(name, username)')
    .order('created_at', { ascending: false })
    .limit(50)
  feedbacksList.value = data || []
}
const goodsList = ref([])
const usersList = ref([])
const reportsList = ref([])
const feedbacksList = ref([])
const loading = ref(false)

// 统计数据
const stats = ref(null)
const statsLoading = ref(false)
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
  if (t === 'stats') { fetchStats(); return }
  fetchAll()
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
      <div class="admin-tab" :class="{ 'admin-tab--active': tab === 'feedbacks' }" @click="switchTab('feedbacks')">用户反馈</div>
      <div class="admin-tab" :class="{ 'admin-tab--active': tab === 'stats' }" @click="switchTab('stats')">数据统计</div>
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
          <t-input v-model="usersSearch" placeholder="搜索用户名、学校..." clearable size="small" />
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

    <!-- 用户反馈 -->
    <div v-if="tab === 'feedbacks'" class="admin-section">
      <div v-if="feedbacksList.length === 0" style="text-align:center;color:#999;padding:40px 0">暂无反馈</div>
      <div v-for="fb in feedbacksList" :key="fb.id" class="feedback-item">
        <div class="feedback-header">
          <span class="feedback-user">{{ fb.user?.name || '未知用户' }}（{{ fb.user?.username || '—' }}）</span>
          <span class="feedback-time">{{ toLocalTime(fb.created_at) }}</span>
        </div>
        <div class="feedback-content">{{ fb.content }}</div>
      </div>
    </div>

    <!-- 数据统计 -->
    <div v-if="tab === 'stats'" class="admin-section">
      <t-loading v-if="statsLoading" size="medium" class="admin-loading" />
      <div v-if="stats" class="stats-content">
        <div class="stats-grid">
          <div class="stat-card"><div class="stat-card__num">{{ stats.totalVisits }}</div><div class="stat-card__label">总访问量</div></div>
          <div class="stat-card"><div class="stat-card__num">{{ stats.totalUsers }}</div><div class="stat-card__label">注册用户数</div></div>
          <div class="stat-card"><div class="stat-card__num">{{ stats.totalGoods }}</div><div class="stat-card__label">商品总数</div></div>
          <div class="stat-card"><div class="stat-card__num">{{ stats.totalDeals }}</div><div class="stat-card__label">成交总数</div></div>
          <div class="stat-card stat-card--highlight"><div class="stat-card__num">&yen;{{ stats.totalAmount }}</div><div class="stat-card__label">成交总金额</div></div>
          <div class="stat-card"><div class="stat-card__num">&yen;{{ stats.avgAmount }}</div><div class="stat-card__label">平均成交价</div></div>
        </div>

        <div class="chart-section"><div class="chart-title">最近7天访问量</div><div class="bar-chart"><div v-for="d in stats.dailyData" :key="'v'+d.date" class="bar-row"><span class="bar-label">{{ d.date }}</span><div class="bar-track"><div class="bar-fill" :style="{ width: (d.visits / stats.maxVisits * 100) + '%' }"></div></div><span class="bar-val">{{ d.visits }}</span></div></div></div>
        <div class="chart-section"><div class="chart-title">最近7天新注册用户</div><div class="bar-chart"><div v-for="d in stats.dailyData" :key="'u'+d.date" class="bar-row"><span class="bar-label">{{ d.date }}</span><div class="bar-track"><div class="bar-fill bar-fill--u" :style="{ width: (d.users / stats.maxUsers * 100) + '%' }"></div></div><span class="bar-val">{{ d.users }}</span></div></div></div>
        <div class="chart-section"><div class="chart-title">最近7天新发布商品</div><div class="bar-chart"><div v-for="d in stats.dailyData" :key="'g'+d.date" class="bar-row"><span class="bar-label">{{ d.date }}</span><div class="bar-track"><div class="bar-fill bar-fill--g" :style="{ width: (d.goods / stats.maxGoods * 100) + '%' }"></div></div><span class="bar-val">{{ d.goods }}</span></div></div></div>
        <div class="chart-section"><div class="chart-title">最近7天成交数</div><div class="bar-chart"><div v-for="d in stats.dailyData" :key="'d'+d.date" class="bar-row"><span class="bar-label">{{ d.date }}</span><div class="bar-track"><div class="bar-fill bar-fill--d" :style="{ width: (d.deals / stats.maxDeals * 100) + '%' }"></div></div><span class="bar-val">{{ d.deals }}</span></div></div></div>
        <div class="chart-section"><div class="chart-title">最近7天成交金额（元）</div><div class="bar-chart"><div v-for="d in stats.dailyData" :key="'a'+d.date" class="bar-row"><span class="bar-label">{{ d.date }}</span><div class="bar-track"><div class="bar-fill bar-fill--amount" :style="{ width: (d.amount / stats.maxAmount * 100) + '%' }"></div></div><span class="bar-val">&yen;{{ d.amount }}</span></div></div></div>

        <div class="chart-section">
          <div class="chart-title">交易明细</div>
          <div v-if="stats.dealDetails.length === 0" style="text-align:center;color:#999;padding:20px">暂无成交记录</div>
          <div v-for="d in stats.dealDetails" :key="d.id" class="deal-detail-row">
            <div class="deal-detail-main">
              <span class="deal-detail-title">{{ d.goods?.title || '未知商品' }}</span>
              <span class="deal-detail-price">&yen;{{ d.final_price }}</span>
            </div>
            <div class="deal-detail-sub">
              <span>{{ d.goods?.category || '—' }}</span>
              <span>{{ d.goods?.condition || '—' }}</span>
              <span>原价&yen;{{ d.goods?.price || '—' }}</span>
            </div>
            <div class="deal-detail-sub">
              <span>卖家：{{ d.seller?.name || '—' }}({{ d.seller?.school || '—' }})</span>
              <span>买家：{{ d.buyer?.name || '—' }}({{ d.buyer?.school || '—' }})</span>
            </div>
            <div class="deal-detail-sub">
              <span>发布于 {{ d.goods?.created_at?.slice(0,16).replace('T',' ') }}</span>
              <span>成交于 {{ d.updated_at?.slice(0,16).replace('T',' ') }}</span>
            </div>
          </div>
        </div>

        <t-button variant="outline" block @click="exportCSV">导出统计数据（CSV）</t-button>
      </div>
    </div>
  </div>

    <div class="app-version">版本 1.0</div>
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

.feedback-item {
  background: #fff;
  border-radius: 8px;
  padding: 14px;
  margin-bottom: 10px;
}
.feedback-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.feedback-user {
  font-size: 13px;
  font-weight: 500;
  color: #333;
}
.feedback-time {
  font-size: 11px;
  color: #bbb;
}
.feedback-content {
  font-size: 14px;
  color: #666;
  line-height: 1.6;
  white-space: pre-wrap;
}

.app-version {
  text-align: center;
  padding: 16px;
  font-size: 11px;
  color: #ccc;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-top: 16px;
}

.stat-card {
  background: #fff;
  border-radius: 10px;
  padding: 18px 14px;
  text-align: center;
}

.stat-card--highlight {
  background: #e8f0fe;
}

.stat-card__num {
  font-size: 22px;
  font-weight: 700;
  color: #0052d9;
}

.stat-card--highlight .stat-card__num {
  color: #e34d59;
}

.stat-card__label {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.stats-content { display: flex; flex-direction: column; gap: 16px; margin-top: 16px; }
.chart-section { background: #fff; border-radius: 10px; padding: 16px; }
.chart-title { font-size: 14px; font-weight: 600; color: #333; margin-bottom: 12px; }
.bar-chart { display: flex; flex-direction: column; gap: 6px; }
.bar-row { display: flex; align-items: center; gap: 8px; }
.bar-label { font-size: 11px; color: #999; width: 42px; text-align: right; flex-shrink: 0; }
.bar-track { flex: 1; height: 20px; background: #f0f0f0; border-radius: 4px; overflow: hidden; }
.bar-fill { height: 100%; background: #0052d9; border-radius: 4px; min-width: 2px; transition: width 0.5s; }
.bar-fill--amount { background: #e34d59; }
.bar-fill--u { background: #2ba471; }
.bar-fill--g { background: #f5a623; }
.bar-fill--d { background: #0052d9; }
.deal-detail-row { padding: 10px 0; border-bottom: 1px solid #f5f5f5; }
.deal-detail-row:last-child { border-bottom: none; }
.deal-detail-main { display: flex; justify-content: space-between; align-items: center; }
.deal-detail-title { font-size: 13px; color: #333; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.deal-detail-price { font-size: 14px; font-weight: 600; color: #e34d59; flex-shrink: 0; margin-left: 12px; }
.deal-detail-sub { display: flex; gap: 16px; font-size: 11px; color: #999; margin-top: 4px; }
.bar-val { font-size: 11px; color: #666; width: 56px; flex-shrink: 0; }
</style>
