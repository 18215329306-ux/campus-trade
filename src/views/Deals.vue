<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import { supabase } from '../supabase'
import { user, initAuth } from '../stores/auth'

const router = useRouter()

const myGoods = ref([])
const loading = ref(true)
const tab = ref('published')
const pendingDeals = ref([])
const doneDeals = ref([])

// 信誉分日志
const showRepLog = ref(false)
const repLogs = ref([])

onMounted(async () => {
  await initAuth()
  if (!user.value) { router.push('/login'); return }
  await fetchMyGoods()
  await fetchPendingDeals()
  await fetchDoneDeals()
})

async function fetchMyGoods() {
  if (!user.value) return
  loading.value = true
  if (user.value.banned) {
    await supabase.from('goods').update({ status: 'cancelled', cancel_reason: '账号已被封禁' }).eq('user_id', user.value.id).eq('status', 'published')
    await supabase.from('goods').update({ status: 'cancelled', cancel_reason: '账号已被封禁' }).eq('user_id', user.value.id).eq('status', 'dealing')
  }
  const { data } = await supabase.from('goods').select('*').eq('user_id', user.value.id).order('created_at', { ascending: false })
  myGoods.value = data || []
  loading.value = false
}

async function fetchPendingDeals() {
  if (!user.value) return
  const { data } = await supabase.from('deals').select('*, goods(*)').eq('buyer_id', user.value.id).eq('status', 'pending').order('created_at', { ascending: false })
  pendingDeals.value = data || []
}

async function fetchDoneDeals() {
  if (!user.value) return
  const uid = user.value.id
  const { data } = await supabase.from('deals').select('*, goods(*)').eq('status', 'done').or(`seller_id.eq.${uid},buyer_id.eq.${uid}`).order('updated_at', { ascending: false })
  if (!data || data.length === 0) { doneDeals.value = []; return }
  const userIds = [...new Set(data.map(d => d.seller_id === uid ? d.buyer_id : d.seller_id))]
  const { data: users } = await supabase.from('users').select('id, name').in('id', userIds)
  const nameMap = {}
  if (users) users.forEach(u => { nameMap[u.id] = u.name })
  doneDeals.value = data.map(d => ({ ...d, _counterpartyName: nameMap[d.seller_id === uid ? d.buyer_id : d.seller_id] || '未知用户' }))
}

const filteredGoods = computed(() => {
  if (tab.value === 'all') return myGoods.value
  if (tab.value === 'dealing') {
    const sellerDealing = myGoods.value.filter(g => g.status === 'dealing')
    const buyerDealing = pendingDeals.value.map(d => ({ ...d.goods, _dealId: d.id, _dealFinalPrice: d.final_price, _dealSellerNote: d.seller_note, _isBuyerDeal: true }))
    return [...buyerDealing, ...sellerDealing]
  }
  if (tab.value === 'sold') {
    const uid = user.value.id
    const soldGoods = myGoods.value.filter(g => g.status === 'sold').map(g => {
      const deal = doneDeals.value.find(d => d.goods_id === g.id)
      return { ...g, _dealType: 'sold', _dealFinalPrice: deal?.final_price || g.price, _dealCounterparty: deal?._counterpartyName || '', _dealTime: toLocalTime(deal?.updated_at) || toLocalTime(g.created_at) }
    })
    const boughtItems = doneDeals.value.filter(d => d.buyer_id === uid).map(d => ({ ...d.goods, _dealType: 'bought', _dealFinalPrice: d.final_price, _dealCounterparty: d._counterpartyName || d.goods?.seller || '', _dealTime: toLocalTime(d.updated_at) }))
    return [...boughtItems, ...soldGoods]
  }
  return myGoods.value.filter(g => g.status === tab.value)
})

async function cancelGoods(id) {
  const { error } = await supabase.from('goods').update({ status: 'cancelled', cancel_reason: '自行取消发布' }).eq('id', id)
  if (!error) { MessagePlugin.success('已取消发布'); fetchMyGoods() }
}

async function republish(id) {
  const { error } = await supabase.from('goods').update({ status: 'published' }).eq('id', id)
  if (!error) { MessagePlugin.success('已重新发布'); fetchMyGoods() }
}

// ===== 卖家发起交易确认 =====
const showDealModal = ref(false)
const dealGoods = ref(null)
const dealFinalPrice = ref('')
const dealBuyerUsername = ref('')
const dealSellerNote = ref('')
const dealSellerRating = ref(0)
const dealLoading = ref(false)

function openDealConfirm(goods) {
  dealGoods.value = goods; dealFinalPrice.value = goods.price || ''; dealBuyerUsername.value = ''; dealSellerNote.value = ''; dealSellerRating.value = 0
  showDealModal.value = true
}

async function submitDeal() {
  if (!dealSellerRating.value) return MessagePlugin.warning('请选择对买家的评分')
  const price = parseFloat(dealFinalPrice.value)
  if (isNaN(price) || price <= 0) return MessagePlugin.warning('请输入有效的成交价格')
  const buyerName = dealBuyerUsername.value.trim()
  if (!buyerName) return MessagePlugin.warning('请输入买家用户名')
  if (buyerName === user.value.name) return MessagePlugin.warning('不能与自己交易')
  const { data: buyer } = await supabase.from('users').select('id, name').eq('name', buyerName).eq('school', user.value.school).single()
  if (!buyer) return MessagePlugin.warning('买家用户不存在')
  const { data: existing } = await supabase.from('deals').select('id').eq('goods_id', dealGoods.value.id).eq('status', 'pending').single()
  if (existing) return MessagePlugin.warning('该商品已有进行中的交易')
  dealLoading.value = true
  const { error: dealError } = await supabase.from('deals').insert({ goods_id: dealGoods.value.id, seller_id: user.value.id, buyer_id: buyer.id, final_price: price, seller_note: dealSellerNote.value.trim(), seller_rating: dealSellerRating.value || null, seller_confirmed: true, buyer_confirmed: false, status: 'pending' })
  if (dealError) { dealLoading.value = false; return MessagePlugin.warning('操作失败，请重试') }
  await supabase.from('goods').update({ status: 'dealing' }).eq('id', dealGoods.value.id)
  await supabase.from('notifications').insert({ user_id: buyer.id, title: '待确认交易', content: `"${dealGoods.value.title}" 的卖家已确认成交，最终价格 ¥${price}，请确认此交易。` })
  dealLoading.value = false; showDealModal.value = false
  MessagePlugin.success('交易确认已发起，等待买家确认')
  fetchMyGoods()
}

// ===== 买家确认/拒绝交易 =====
const showBuyerDealModal = ref(false)
const buyerDeal = ref(null)
const buyerNote = ref('')
const buyerDealRating = ref(0)
const buyerDealLoading = ref(false)

function openBuyerConfirm(deal) { buyerDeal.value = deal; buyerNote.value = ''; buyerDealRating.value = 0; showBuyerDealModal.value = true }

async function confirmBuyerDeal() {
  if (!buyerDealRating.value) return MessagePlugin.warning('请选择对卖家的评分')
  buyerDealLoading.value = true; const deal = buyerDeal.value
  await supabase.from('deals').update({ buyer_note: buyerNote.value.trim(), buyer_rating: buyerDealRating.value || null, buyer_confirmed: true, status: 'done' }).eq('id', deal.id)
  await supabase.from('goods').update({ status: 'sold' }).eq('id', deal.goods_id)
  await supabase.from('notifications').insert({ user_id: deal.seller_id, title: '交易已完成', content: `"${deal.goods?.title || '商品'}" 已被买家确认成交，最终价格 ¥${deal.final_price}。` })
  await updateReputation(deal.seller_id, `交易完成：作为卖家获得评分 ${buyerDealRating.value} 分`)
  await updateReputation(deal.buyer_id, `交易完成：作为买家获得评分 ${deal.seller_rating || '—'} 分`)
  buyerDealLoading.value = false; showBuyerDealModal.value = false
  MessagePlugin.success('交易已确认完成')
  fetchPendingDeals(); fetchDoneDeals(); fetchMyGoods()
}

async function rejectBuyerDeal() {
  buyerDealLoading.value = true; const deal = buyerDeal.value
  await supabase.from('deals').update({ buyer_note: buyerNote.value.trim(), status: 'rejected' }).eq('id', deal.id)
  await supabase.from('goods').update({ status: 'published' }).eq('id', deal.goods_id)
  await supabase.from('notifications').insert({ user_id: deal.seller_id, title: '交易被拒绝', content: `"${deal.goods?.title || '商品'}" 的买家拒绝了此交易。` })
  buyerDealLoading.value = false; showBuyerDealModal.value = false
  MessagePlugin.warning('已拒绝该交易')
  fetchPendingDeals(); fetchMyGoods()
}

// ===== 信誉分 =====
async function logReputationChange(userId, newRep, reason) {
  const { data: old } = await supabase.from('users').select('reputation').eq('id', userId).single()
  const oldRep = old?.reputation ?? 5.0
  const change = Math.round((newRep - oldRep) * 10) / 10
  if (change !== 0) { await supabase.from('reputation_logs').insert({ user_id: userId, change, reason: reason + ` (${oldRep} \u2192 ${newRep})` }) }
}

async function updateReputation(userId, reason) {
  const { data: asSeller } = await supabase.from('deals').select('buyer_rating').eq('seller_id', userId).eq('status', 'done').not('buyer_rating', 'is', null)
  const { data: asBuyer } = await supabase.from('deals').select('seller_rating').eq('buyer_id', userId).eq('status', 'done').not('seller_rating', 'is', null)
  const { count: reportCount } = await supabase.from('reports').select('*', { count: 'exact', head: true }).eq('reported_user_id', userId)
  const allRatings = [...(asSeller || []).map(d => d.buyer_rating), ...(asBuyer || []).map(d => d.seller_rating)]
  const avg = allRatings.length > 0 ? allRatings.reduce((a, b) => a + b, 0) / allRatings.length : 5.0
  const penalty = (reportCount || 0) * 0.5
  const reputation = Math.max(0, Math.round((avg - penalty) * 10) / 10)
  await logReputationChange(userId, reputation, reason || '交易评价更新')
  await supabase.from('users').update({ reputation }).eq('id', userId)
  if (userId === user.value?.id) user.value.reputation = reputation
}

async function openRepLog() {
  if (!user.value) return
  const { data } = await supabase.from('reputation_logs').select('*').eq('user_id', user.value.id).order('created_at', { ascending: false }).limit(30)
  repLogs.value = data || []; showRepLog.value = true
}

function starFill(rating, starIndex) {
  if (rating >= starIndex) return '100%'
  if (rating >= starIndex - 0.5) return '50%'
  return '0%'
}

function setDealRating(starIndex, event) {
  const rect = event.target.getBoundingClientRect()
  dealSellerRating.value = event.clientX - rect.left < rect.width / 2 ? starIndex - 0.5 : starIndex
}

function setBuyerRating(starIndex, event) {
  const rect = event.target.getBoundingClientRect()
  buyerDealRating.value = event.clientX - rect.left < rect.width / 2 ? starIndex - 0.5 : starIndex
}

function toLocalTime(utcStr) {
  if (!utcStr) return ''
  const d = new Date(utcStr.includes('T') ? utcStr : utcStr.replace(' ', 'T') + 'Z')
  if (isNaN(d.getTime())) return utcStr.slice(0, 16).replace('T', ' ')
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function onCardClick(id) { window.open(router.resolve(`/detail/${id}`).href, '_blank') }
</script>

<template>
  <div v-if="!user" class="loading-page">
    <t-loading size="medium" text="请先登录..." />
  </div>
  <div v-else class="deals-page">
    <!-- 标签切换 -->
    <div class="deals-tabs">
      <div
        v-for="t in [
          { key: 'published', label: '已发布' },
          { key: 'dealing', label: '交易中', badge: pendingDeals.length },
          { key: 'sold', label: '已成交' },
          { key: 'cancelled', label: '已取消' },
        ]"
        :key="t.key"
        class="deals-tab"
        :class="{ 'deals-tab--active': tab === t.key }"
        @click="tab = t.key"
      >
        {{ t.label }}
        <span v-if="t.badge" class="deals-tab__badge">{{ t.badge }}</span>
      </div>
    </div>

    <!-- 商品列表 -->
    <div class="deals-content">
      <div v-if="loading" class="deals-loading">
        <t-loading size="medium" />
      </div>
      <div v-else-if="filteredGoods.length > 0" class="deals-list">
        <div v-for="goods in filteredGoods" :key="goods._dealId || goods.id" class="deals-item">
          <div class="deals-item__image" @click="onCardClick(goods.id)">
            <img :src="goods.image?.includes(',') ? goods.image.split(',')[0] : goods.image" class="deals-item__img" />
          </div>
          <div class="deals-item__info" @click="onCardClick(goods.id)">
            <div class="deals-item__title">
              {{ goods.title }}
              <t-tag v-if="goods._dealType === 'bought'" size="small" theme="success" variant="light" class="deal-type-tag">买入</t-tag>
              <t-tag v-if="goods._dealType === 'sold'" size="small" theme="primary" variant="light" class="deal-type-tag">卖出</t-tag>
            </div>
            <div v-if="goods._dealCounterparty" class="deals-item__counterparty">
              <template v-if="goods._dealType === 'bought'">卖家：{{ goods._dealCounterparty }}</template>
              <template v-else>买家：{{ goods._dealCounterparty }}</template>
            </div>
            <div class="deals-item__price">
              <template v-if="goods._isBuyerDeal || goods._dealType">成交价 ¥{{ goods._dealFinalPrice }}</template>
              <template v-else>¥{{ goods.price }}</template>
            </div>
            <div class="deals-item__date">
              <template v-if="goods._dealTime">{{ goods._dealTime }}</template>
              <template v-else>{{ toLocalTime(goods.created_at) }}</template>
            </div>
            <div v-if="goods.cancel_reason" class="deals-item__cancel-reason">{{ goods.cancel_reason }}</div>
          </div>
          <div class="deals-item__actions">
            <t-button v-if="goods.status === 'published'" size="small" theme="primary" variant="text" @click="openDealConfirm(goods)">确认成交</t-button>
            <t-button v-if="goods.status === 'published'" size="small" theme="danger" variant="text" @click="cancelGoods(goods.id)">取消发布</t-button>
            <t-button v-if="goods.status === 'dealing' && !goods._isBuyerDeal" size="small" variant="text" disabled>等待买家确认...</t-button>
            <t-button v-if="goods._isBuyerDeal" size="small" theme="primary" variant="text" @click.stop="openBuyerConfirm(pendingDeals.find(d => d.id === goods._dealId))">确认交易</t-button>
            <t-button v-if="goods._isBuyerDeal" size="small" theme="danger" variant="text" @click.stop="openBuyerConfirm(pendingDeals.find(d => d.id === goods._dealId)); buyerNote = ''">拒绝</t-button>
            <t-button v-if="goods.status === 'cancelled'" size="small" variant="text" @click="republish(goods.id)">重新发布</t-button>
          </div>
        </div>
      </div>
      <div v-else class="deals-empty">
        <t-icon name="inbox" size="60px" style="color: #ddd" />
        <span>暂无商品</span>
      </div>
    </div>

    <!-- 信誉分日志弹窗 -->
    <teleport to="body">
      <div v-if="showRepLog" class="modal-overlay" @click.self="showRepLog = false">
        <div class="modal-card">
          <div class="modal-header">
            <span class="modal-title">信誉分变化记录</span>
            <span class="modal-close" @click="showRepLog = false">&times;</span>
          </div>
          <div class="modal-body modal-body--scroll">
            <div v-if="repLogs.length === 0" style="text-align:center;color:#999;padding:30px 0">暂无记录</div>
            <div v-for="log in repLogs" :key="log.id" class="rep-log-item">
              <div class="rep-log-change" :class="{ 'rep-log--up': log.change > 0, 'rep-log--down': log.change < 0 }">{{ log.change > 0 ? '+' : '' }}{{ log.change }}</div>
              <div class="rep-log-info">
                <div class="rep-log-reason">{{ log.reason }}</div>
                <div class="rep-log-time">{{ toLocalTime(log.created_at) }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </teleport>

    <!-- 卖家发起交易确认弹窗 -->
    <teleport to="body">
      <div v-if="showDealModal" class="modal-overlay" @click.self="showDealModal = false">
        <div class="modal-card">
          <div class="modal-header"><span class="modal-title">确认成交</span><span class="modal-close" @click="showDealModal = false">&times;</span></div>
          <div class="modal-body">
            <p class="modal-hint">请填写交易信息，买家确认后即完成成交</p>
            <t-input v-model="dealFinalPrice" placeholder="最终成交价格" type="number" size="large" clearable><template #prefix-icon><span style="font-size:16px">¥</span></template></t-input>
            <t-input v-model="dealBuyerUsername" placeholder="买家用户名" size="large" clearable><template #prefix-icon><t-icon name="user" /></template></t-input>
            <div class="rating-row">
              <span class="rating-label">对买家印象 <span style="color:#e34d59">*</span></span>
              <div class="star-rating">
                <span v-for="s in 5" :key="s" class="star-cell" @click="setDealRating(s, $event)">
                  <span class="star-fill" :style="{ width: starFill(dealSellerRating, s) }">★</span>
                  <span class="star-bg">★</span>
                </span>
              </div>
              <span v-if="dealSellerRating > 0" class="rating-text">{{ dealSellerRating }} 分</span>
            </div>
            <t-textarea v-model="dealSellerNote" placeholder="评价（选填）" :autosize="{ minRows: 2, maxRows: 4 }" />
            <t-button theme="primary" size="large" block :loading="dealLoading" @click="submitDeal">确认发起</t-button>
          </div>
        </div>
      </div>
    </teleport>

    <!-- 买家确认交易弹窗 -->
    <teleport to="body">
      <div v-if="showBuyerDealModal" class="modal-overlay" @click.self="showBuyerDealModal = false">
        <div class="modal-card">
          <div class="modal-header"><span class="modal-title">确认交易</span><span class="modal-close" @click="showBuyerDealModal = false">&times;</span></div>
          <div class="modal-body">
            <div class="buyer-deal-summary">
              <div class="summary-row"><span class="summary-label">商品</span><span>{{ buyerDeal?.goods?.title || '未知' }}</span></div>
              <div class="summary-row"><span class="summary-label">最终价格</span><span class="price-highlight">¥{{ buyerDeal?.final_price }}</span></div>
              <div v-if="buyerDeal?.seller_note" class="summary-row"><span class="summary-label">卖家评价</span><span>{{ buyerDeal.seller_note }}</span></div>
            </div>
            <div class="rating-row">
              <span class="rating-label">对卖家印象 <span style="color:#e34d59">*</span></span>
              <div class="star-rating">
                <span v-for="s in 5" :key="s" class="star-cell" @click="setBuyerRating(s, $event)">
                  <span class="star-fill" :style="{ width: starFill(buyerDealRating, s) }">★</span>
                  <span class="star-bg">★</span>
                </span>
              </div>
              <span v-if="buyerDealRating > 0" class="rating-text">{{ buyerDealRating }} 分</span>
            </div>
            <t-textarea v-model="buyerNote" placeholder="评价（选填）" :autosize="{ minRows: 2, maxRows: 4 }" />
            <div class="buyer-deal-btns">
              <t-button theme="primary" size="large" :loading="buyerDealLoading" @click="confirmBuyerDeal">确认成交</t-button>
              <t-button theme="danger" variant="outline" size="large" :loading="buyerDealLoading" @click="rejectBuyerDeal">拒绝</t-button>
            </div>
          </div>
        </div>
      </div>
    </teleport>

    <div class="app-version">版本 1.0</div>
  </div>
</template>

<style scoped>
.deals-page { min-height: 100vh; background: #f5f5f5; padding-bottom: 80px; }
.deals-tabs { display: flex; justify-content: space-around; background: #fff; border-bottom: 1px solid #f0f0f0; position: sticky; top: 0; z-index: 10; }
.deals-tab { padding: 12px 16px; font-size: 14px; color: #666; cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.2s; position: relative; }
.deals-tab--active { color: #0052d9; border-bottom-color: #0052d9; }
.deals-tab__badge { position: absolute; top: 6px; right: 2px; min-width: 16px; height: 16px; font-size: 10px; color: #fff; background: #e34d59; border-radius: 8px; display: flex; align-items: center; justify-content: center; padding: 0 4px; }
.deals-content { padding: 12px 16px; }
.deals-loading { display: flex; justify-content: center; padding-top: 80px; }
.deals-list { display: flex; flex-direction: column; gap: 12px; }
.deals-item { display: flex; gap: 12px; background: #fff; border-radius: 12px; padding: 12px; }
.deals-item__image { width: 80px; height: 80px; flex-shrink: 0; border-radius: 8px; overflow: hidden; cursor: pointer; }
.deals-item__img { width: 100%; height: 100%; object-fit: cover; }
.deals-item__info { flex: 1; cursor: pointer; min-width: 0; }
.deals-item__title { font-size: 14px; font-weight: 500; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.deal-type-tag { margin-left: 6px; vertical-align: middle; }
.deals-item__counterparty { font-size: 12px; color: #666; margin-top: 2px; }
.deals-item__price { font-size: 16px; font-weight: 600; color: #e34d59; margin-top: 4px; }
.deals-item__date { font-size: 12px; color: #999; margin-top: 4px; }
.deals-item__cancel-reason { font-size: 11px; color: #e34d59; margin-top: 2px; }
.deals-item__actions { display: flex; flex-direction: column; gap: 2px; justify-content: center; flex-shrink: 0; }
.deals-empty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding-top: 80px; color: #999; font-size: 14px; }
.loading-page { display: flex; justify-content: center; align-items: center; min-height: 100vh; }

.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px; }
.modal-card { width: 100%; max-width: 380px; background: #fff; border-radius: 12px; overflow: hidden; }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px 0; }
.modal-title { font-size: 17px; font-weight: 600; }
.modal-close { font-size: 24px; color: #999; cursor: pointer; }
.modal-body { padding: 20px; display: flex; flex-direction: column; gap: 12px; }
.modal-body--scroll { max-height: 60vh; overflow-y: auto; }
.modal-hint { font-size: 14px; color: #666; text-align: center; }

.star-rating { display: inline-flex; gap: 4px; }
.star-cell { position: relative; font-size: 28px; cursor: pointer; user-select: none; width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center; }
.star-bg { color: #ddd; position: absolute; left: 0; top: 0; }
.star-fill { color: #f5a623; position: absolute; left: 0; top: 0; overflow: hidden; white-space: nowrap; z-index: 1; }
.rating-row { display: flex; align-items: center; gap: 10px; }
.rating-label { font-size: 14px; color: #666; flex-shrink: 0; }
.rating-text { font-size: 13px; color: #f5a623; font-weight: 600; }
.price-highlight { color: #e34d59; font-weight: 600; font-size: 15px; }

.buyer-deal-summary { background: #f9f9f9; border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.summary-row { display: flex; gap: 8px; font-size: 14px; color: #333; }
.summary-label { color: #999; flex-shrink: 0; width: 60px; }
.buyer-deal-btns { display: flex; gap: 8px; }
.buyer-deal-btns .t-button { flex: 1; }

.rep-log-item { display: flex; align-items: flex-start; gap: 10px; padding: 10px 0; border-bottom: 1px solid #f5f5f5; }
.rep-log-item:last-child { border-bottom: none; }
.rep-log-change { font-size: 15px; font-weight: 700; min-width: 48px; text-align: center; padding: 2px 0; border-radius: 6px; flex-shrink: 0; }
.rep-log--up { color: #2ba471; background: #e8f8f2; }
.rep-log--down { color: #e34d59; background: #fdecee; }
.rep-log-info { flex: 1; min-width: 0; }
.rep-log-reason { font-size: 13px; color: #333; line-height: 1.4; }
.rep-log-time { font-size: 11px; color: #bbb; margin-top: 4px; }
.app-version { text-align: center; padding: 16px; font-size: 11px; color: #ccc; }
</style>
