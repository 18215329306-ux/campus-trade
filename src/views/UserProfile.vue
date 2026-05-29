<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import { supabase } from '../supabase'
import { user, initAuth } from '../stores/auth'
import ProductCard from '../components/ProductCard.vue'

const route = useRoute()
const router = useRouter()

const profile = ref(null)
const loading = ref(true)
const isFollowing = ref(false)
const followers = ref(0)
const following = ref(0)
const reviews = ref([])
const goods = ref([])
const soldGoods = ref([])
const reviewRating = ref(0)
const reviewNote = ref('')

onMounted(async () => {
  await initAuth()
  if (!user.value) { router.push('/login'); return }
  await loadProfile()
  await loadGoods()
  await loadSoldGoods()
})

async function loadProfile() {
  const id = route.params.id
  const { data } = await supabase.from('users').select('id, name, school, username, reputation, created_at').eq('id', id).single()
  if (!data) { loading.value = false; return }
  profile.value = data
  loading.value = false

  const { data: f } = await supabase.from('follows').select('id').eq('follower_id', user.value.id).eq('following_id', id).single()
  isFollowing.value = !!f

  const { count: fc } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', id)
  const { count: fg } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', id)
  followers.value = fc || 0
  following.value = fg || 0

  const { data: rv } = await supabase.from('user_reviews').select('*, reviewer:reviewer_id(name)').eq('target_id', id).order('created_at', { ascending: false }).limit(20)
  reviews.value = rv || []
}

async function loadSoldGoods() {
  const id = route.params.id
  const { data: deals } = await supabase
    .from('deals')
    .select('goods_id, final_price')
    .eq('seller_id', id)
    .eq('status', 'done')
  if (!deals || deals.length === 0) { soldGoods.value = []; return }

  const goodsIds = [...new Set(deals.map(d => d.goods_id))]
  const priceMap = {}
  deals.forEach(d => { priceMap[d.goods_id] = d.final_price })

  const { data: gs } = await supabase
    .from('goods')
    .select('*')
    .in('id', goodsIds)
    .eq('status', 'sold')
    .order('created_at', { ascending: false })
  soldGoods.value = (gs || []).map(g => ({ ...g, _finalPrice: priceMap[g.id] }))
}

async function loadGoods() {
  const id = route.params.id
  const { data } = await supabase.from('goods').select('*').eq('user_id', id).eq('status', 'published').order('created_at', { ascending: false })
  goods.value = data || []
}

async function toggleFollow() {
  if (isFollowing.value) {
    await supabase.from('follows').delete().eq('follower_id', user.value.id).eq('following_id', profile.value.id)
    isFollowing.value = false
    followers.value = Math.max(0, followers.value - 1)
  } else {
    await supabase.from('follows').insert({ follower_id: user.value.id, following_id: profile.value.id })
    isFollowing.value = true
    followers.value++
  }
}

async function submitReview() {
  if (reviewRating.value === 0) return MessagePlugin.warning('请选择评分')
  const { error } = await supabase.from('user_reviews').insert({
    reviewer_id: user.value.id,
    target_id: profile.value.id,
    rating: reviewRating.value,
    note: reviewNote.value.trim(),
  })
  if (error) return MessagePlugin.warning('评价失败')
  MessagePlugin.success('评价已提交')
  reviewRating.value = 0
  reviewNote.value = ''
  loadProfile()
}

function onCardClick(id) {
  window.open(router.resolve(`/detail/${id}`).href, '_blank')
}

function toLocalTime(utcStr) {
  if (!utcStr) return ''
  const d = new Date(utcStr.includes('T') ? utcStr : utcStr.replace(' ', 'T') + 'Z')
  if (isNaN(d.getTime())) return utcStr.slice(0, 16).replace('T', ' ')
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function goBack() {
  router.back()
}
</script>

<template>
  <div v-if="loading" class="loading-page">
    <t-loading size="medium" text="加载中..." />
  </div>
  <div v-else-if="!profile" class="empty-page">
    <t-icon name="error-circle" size="60px" style="color: #ddd" />
    <span>用户不存在</span>
  </div>
  <div v-else class="profile-page">
    <!-- 顶部 -->
    <div class="profile-topbar">
      <t-button variant="text" @click="goBack">
        <t-icon name="chevron-left" size="24px" />返回
      </t-button>
    </div>

    <!-- 用户信息 -->
    <div class="profile-card">
      <div class="profile-avatar">{{ profile.name?.charAt(0) || 'U' }}</div>
      <div class="profile-name">{{ profile.name }}</div>
      <div class="profile-school">{{ profile.school }}</div>
      <div class="profile-created">注册于 {{ toLocalTime(profile.created_at) }}</div>
      <div class="profile-rep">
        <span v-for="s in 5" :key="s" class="star-sm" :class="{ active: s <= Math.round(Number(profile.reputation) || 5) }">★</span>
        <span class="rep-num">{{ profile.reputation ? Math.round(profile.reputation * 10) / 10 : '5.0' }}</span>
      </div>
      <div class="profile-stats">
        <span>{{ followers }} 粉丝</span>
        <span class="stat-divider">|</span>
        <span>{{ following }} 关注</span>
      </div>
      <t-button
        :theme="isFollowing ? 'default' : 'primary'"
        :variant="isFollowing ? 'outline' : 'base'"
        @click="toggleFollow"
      >
        {{ isFollowing ? '已关注' : '关注 TA' }}
      </t-button>
    </div>

    <!-- 给 TA 评分 -->
    <div class="review-section">
      <div class="section-title">给 {{ profile.name }} 评分</div>
      <div class="rating-row">
        <span v-for="s in 5" :key="s" class="star" :class="{ active: s <= reviewRating }" @click="reviewRating = s">★</span>
        <span v-if="reviewRating > 0" class="rating-text">{{ reviewRating }} 分</span>
      </div>
      <t-textarea v-model="reviewNote" placeholder="评价（选填）" :autosize="{ minRows: 2 }" />
      <t-button theme="primary" block @click="submitReview">提交评价</t-button>
    </div>

    <!-- TA 在售的商品 -->
    <div class="goods-section">
      <div class="section-title">TA 在售的商品（{{ goods.length }}）</div>
      <div v-if="goods.length > 0" class="goods-grid">
        <ProductCard
          v-for="g in goods" :key="g.id"
          :id="g.id"
          :image="g.image"
          :title="g.title"
          :price="g.price"
          :category="g.category"
          :condition="g.condition"
          :seller="g.seller"
          @click="onCardClick(g.id)"
        />
      </div>
      <div v-else class="no-goods">
        <t-icon name="inbox" size="40px" style="color: #ddd" />
        <span>暂无在售商品</span>
      </div>
    </div>

    <!-- TA 已售出的商品 -->
    <div v-if="soldGoods.length > 0" class="goods-section">
      <div class="section-title">TA 已售出的商品（{{ soldGoods.length }}）</div>
      <div class="goods-grid sold-grid">
        <div v-for="g in soldGoods" :key="g.id" class="sold-item" @click="onCardClick(g.id)">
          <div class="sold-item__img-wrap">
            <img :src="g.image?.includes(',') ? g.image.split(',')[0] : g.image" class="sold-item__img" />
            <div class="sold-item__price">成交 ¥{{ g._finalPrice || g.price }}</div>
          </div>
          <div class="sold-item__title">{{ g.title }}</div>
        </div>
      </div>
    </div>

    <!-- 收到的评价 -->
    <div v-if="reviews.length > 0" class="review-section">
      <div class="section-title">收到的评价</div>
      <div v-for="r in reviews" :key="r.id" class="review-item">
        <div class="review-top">
          <span class="review-stars">
            <span v-for="s in 5" :key="s" class="star-xs" :class="{ active: s <= r.rating }">★</span>
          </span>
          <span class="review-author">{{ r.reviewer?.name || '匿名' }}</span>
          <span class="review-time">{{ r.created_at?.slice(0, 10) }}</span>
        </div>
        <div v-if="r.note" class="review-note">{{ r.note }}</div>
      </div>
    </div>
  </div>

    

    <div class="app-version">版本 1.0</div>
</template>

<style scoped>
.profile-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 30px;
}

.profile-topbar {
  padding: 8px;
  background: #fff;
  position: sticky;
  top: 0;
  z-index: 10;
}

.profile-card {
  background: #fff;
  margin: 0 16px 12px;
  border-radius: 12px;
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.profile-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #0052d9;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 600;
}

.profile-name {
  font-size: 20px;
  font-weight: 600;
  color: #333;
}

.profile-school {
  font-size: 13px;
  color: #999;
}

.profile-created {
  font-size: 11px;
  color: #bbb;
  margin-top: 2px;
}

.profile-rep {
  display: flex;
  align-items: center;
  gap: 2px;
}

.star-sm {
  font-size: 14px;
  color: #ddd;
}

.star-sm.active {
  color: #f5a623;
}

.rep-num {
  font-size: 13px;
  color: #f5a623;
  font-weight: 600;
  margin-left: 4px;
}

.profile-stats {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #666;
}

.stat-divider {
  color: #ddd;
}

/* 评价区 */
.review-section, .goods-section {
  background: #fff;
  margin: 0 16px 12px;
  border-radius: 12px;
  padding: 16px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
}

.rating-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.star {
  font-size: 28px;
  color: #ddd;
  cursor: pointer;
  transition: color 0.15s;
  user-select: none;
}

.star:hover, .star.active {
  color: #f5a623;
}

.rating-text {
  font-size: 14px;
  color: #f5a623;
  font-weight: 600;
}

/* 商品网格 */
.goods-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

@media (min-width: 768px) {
  .goods-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (min-width: 1200px) {
  .goods-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.no-goods {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #999;
  font-size: 13px;
  padding: 20px 0;
}

/* 评价列表 */
.review-item {
  padding: 10px 0;
  border-bottom: 1px solid #f5f5f5;
}

.review-item:last-child {
  border-bottom: none;
}

.review-top {
  display: flex;
  align-items: center;
  gap: 8px;
}

.review-stars {
  display: inline-flex;
  gap: 1px;
}

.star-xs {
  font-size: 13px;
  color: #ddd;
}

.star-xs.active {
  color: #f5a623;
}

.review-author {
  font-size: 12px;
  color: #333;
  font-weight: 500;
}

.review-time {
  font-size: 11px;
  color: #bbb;
  margin-left: auto;
}

/* 已售商品 */
.sold-item {
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;
  background: #f9f9f9;
}

.sold-item__img-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
}

.sold-item__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.7;
}

.sold-item__price {
  position: absolute;
  bottom: 6px;
  left: 6px;
  padding: 2px 10px;
  background: rgba(0,0,0,0.6);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  border-radius: 4px;
}

.sold-item__title {
  padding: 6px 8px;
  font-size: 12px;
  color: #666;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.review-note {
  font-size: 13px;
  color: #666;
  margin-top: 4px;
}

.loading-page, .empty-page {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  gap: 12px;
  color: #999;
}

.app-version {
  text-align: center;
  padding: 16px;
  font-size: 11px;
  color: #ccc;
}
</style>
