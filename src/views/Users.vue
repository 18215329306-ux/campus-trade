<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import { supabase } from '../supabase'
import { user, initAuth } from '../stores/auth'

const router = useRouter()
const users = ref([])
const loading = ref(true)
const searchKeyword = ref('')

// 关注信息
const followingIds = ref(new Set())

// 用户详情弹窗
const showProfile = ref(false)
const profileUser = ref(null)
const profileFollowers = ref(0)
const profileFollowing = ref(0)
const profileReviews = ref([])
const profileRating = ref(0)
const profileNote = ref('')

async function fetchUsers() {
  if (!user.value) return
  loading.value = true
  const keyword = searchKeyword.value.trim()
  let query = supabase.from('users').select('id, name, school, username, reputation, banned')
  
  // 排除被封禁用户（除非搜索时）
  if (!keyword) {
    query = query.neq('banned', true)
  }
  
  // 同校过滤（管理员看全部）
  if (user.value?.school && user.value.role !== 'admin') {
    query = query.eq('school', user.value.school)
  }
  
  if (keyword) {
    // 搜索模式：在同校内搜索
    const kw = `%${keyword}%`
    query = query.or(`name.ilike.${kw},username.ilike.${kw}`)
  } else {
    // 默认模式：只看自己和关注的人（且同校）
    const ids = [user.value.id, ...followingIds.value]
    if (ids.length > 0) {
      query = query.in('id', ids)
    }
  }
  const { data } = await query.order('reputation', { ascending: false }).limit(50)
  users.value = data || []
  loading.value = false
}

async function fetchFollowing() {
  if (!user.value) return
  const { data } = await supabase.from('follows').select('following_id').eq('follower_id', user.value.id)
  followingIds.value = new Set((data || []).map(f => f.following_id))
}

onMounted(async () => {
  await initAuth()
  if (!user.value) return
  await fetchFollowing()
  await fetchUsers()
})

function onSearch() {
  fetchUsers()
}

async function toggleFollow(targetId) {
  // 检查目标是否被封禁
  const { data: target } = await supabase.from('users').select('banned').eq('id', targetId).single()
  if (target?.banned) return MessagePlugin.warning('该账号已被封禁，无法关注')
  if (followingIds.value.has(targetId)) {
    await supabase.from('follows').delete().eq('follower_id', user.value.id).eq('following_id', targetId)
    followingIds.value.delete(targetId)
    MessagePlugin.success('已取消关注')
  } else {
    await supabase.from('follows').insert({ follower_id: user.value.id, following_id: targetId })
    followingIds.value.add(targetId)
    MessagePlugin.success('已关注')
  }
  followingIds.value = new Set(followingIds.value)
  if (profileUser.value) {
    await loadProfileStats(profileUser.value.id)
  }
}

async function openProfile(u) {
  profileUser.value = u
  profileRating.value = 0
  profileNote.value = ''
  showProfile.value = true
  await loadProfileStats(u.id)
}

async function loadProfileStats(targetId) {
  const { count: followers } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', targetId)
  const { count: following } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', targetId)
  profileFollowers.value = followers || 0
  profileFollowing.value = following || 0

  const { data: reviews } = await supabase.from('user_reviews').select('*, reviewer:reviewer_id(name)').eq('target_id', targetId).order('created_at', { ascending: false }).limit(10)
  profileReviews.value = reviews || []
}

async function submitReview() {
  if (profileRating.value === 0) return MessagePlugin.warning('请选择评分')
  const { error } = await supabase.from('user_reviews').insert({
    reviewer_id: user.value.id,
    target_id: profileUser.value.id,
    rating: profileRating.value,
    note: profileNote.value.trim(),
  })
  if (error) return MessagePlugin.warning('评价失败')
  MessagePlugin.success('评价已提交')

  // 更新目标用户的信誉分
  const { data: allReviews } = await supabase.from('user_reviews').select('rating').eq('target_id', profileUser.value.id)
  if (allReviews && allReviews.length > 0) {
    const avg = allReviews.reduce((a, b) => a + b.rating, 0) / allReviews.length
    await supabase.from('users').update({ reputation: Math.round(avg * 10) / 10 }).eq('id', profileUser.value.id)
  }

  showProfile.value = false
  fetchUsers()
}

function roundReputation(r) {
  return r ? Math.round(r * 10) / 10 : '5.0'
}
</script>

<template>
  <div v-if="!user" class="loading-page">
    <t-loading size="medium" text="请先登录..." />
  </div>
  <div v-else class="users-page">
    <!-- 搜索 -->
    <div class="users-search">
      <t-input v-model="searchKeyword" placeholder="搜索用户名..." size="large" clearable @enter="onSearch">
        <template #suffix-icon>
          <t-icon name="search" @click="onSearch" style="cursor:pointer" />
        
    
</template>
      </t-input>
    </div>

    <!-- 用户列表 -->
    <div class="users-content">
      <div v-if="loading" class="users-loading">
        <t-loading size="medium" />
      </div>
      <div v-else-if="users.length > 0" class="users-list">
        <div v-for="u in users" :key="u.id" class="user-item" @click="router.push(`/user/${u.id}`)">
          <div class="user-item__avatar">{{ u.name?.charAt(0) || 'U' }}</div>
          <div class="user-item__info">
            <div class="user-item__name">{{ u.name }}</div>
            <div class="user-item__school">{{ u.school }}</div>
            <div class="user-item__rep">
              <span v-for="s in 5" :key="s" class="star-xs" :class="{ active: s <= Math.round(u.reputation || 5) }">★</span>
              <span class="rep-num">{{ roundReputation(u.reputation) }}</span>
            </div>
          </div>
          <t-button
            size="small"
            :theme="followingIds.has(u.id) ? 'default' : 'primary'"
            :variant="followingIds.has(u.id) ? 'outline' : 'base'"
            @click.stop="toggleFollow(u.id)"
          >
            {{ followingIds.has(u.id) ? '已关注' : '关注' }}
          </t-button>
        </div>
      </div>
      <div v-else class="users-empty">
        <t-icon name="usergroup" size="60px" style="color: #ddd" />
        <span v-if="searchKeyword">没有找到匹配的用户</span>
        <span v-else>还没有关注任何人，去搜索发现用户吧</span>
      </div>
    </div>
  </div>

  <!-- 用户详情弹窗 -->
  <teleport to="body">
    <div v-if="showProfile" class="modal-overlay" @click.self="showProfile = false">
      <div class="modal-card">
        <div class="modal-header">
          <span class="modal-title">用户详情</span>
          <span class="modal-close" @click="showProfile = false">&times;</span>
        </div>
        <div class="modal-body">
          <div class="profile-header">
            <div class="profile-avatar">{{ profileUser?.name?.charAt(0) || 'U' }}</div>
            <div class="profile-info">
              <div class="profile-name">{{ profileUser?.name }}</div>
              <div class="profile-school">{{ profileUser?.school }}</div>
              <div class="profile-rep">
                <span v-for="s in 5" :key="s" class="star-sm" :class="{ active: s <= Math.round(profileUser?.reputation || 5) }">★</span>
                <span class="rep-num">{{ roundReputation(profileUser?.reputation) }}</span>
              </div>
            </div>
          </div>
          <div class="profile-stats">
            <span>{{ profileFollowers }} 粉丝</span>
            <span class="stat-divider">|</span>
            <span>{{ profileFollowing }} 关注</span>
          </div>
          <t-button
            block
            :theme="followingIds.has(profileUser?.id) ? 'default' : 'primary'"
            :variant="followingIds.has(profileUser?.id) ? 'outline' : 'base'"
            @click="toggleFollow(profileUser?.id)"
          >
            {{ followingIds.has(profileUser?.id) ? '取消关注' : '关注 TA' }}
          </t-button>

          <!-- 给 TA 评分 -->
          <div class="profile-rate">
            <div class="rate-title">给 {{ profileUser?.name }} 评分</div>
            <div class="rating-row">
              <div class="star-rating">
                <span v-for="s in 5" :key="s" class="star" :class="{ active: s <= profileRating }" @click="profileRating = s">★</span>
              </div>
              <span v-if="profileRating > 0" class="rating-text">{{ profileRating }} 分</span>
            </div>
            <t-textarea v-model="profileNote" placeholder="评价（选填）" :autosize="{ minRows: 2 }" />
            <t-button theme="primary" block @click="submitReview">提交评价</t-button>
          </div>

          <!-- 历史评价 -->
          <div v-if="profileReviews.length > 0" class="profile-reviews">
            <div class="rate-title">收到的评价</div>
            <div v-for="r in profileReviews" :key="r.id" class="review-item">
              <div class="review-top">
                <span class="review-stars">
                  <span v-for="s in 5" :key="s" class="star-xs" :class="{ active: s <= r.rating }">★</span>
                </span>
                <span class="review-author">{{ r.reviewer?.name || '匿名' }}</span>
              </div>
              <div v-if="r.note" class="review-note">{{ r.note }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </teleport>

    

    <div class="app-version">版本 1.0</div>
</template>

<style scoped>
.users-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 80px;
}

.users-search {
  padding: 12px 16px;
  background: #fff;
  position: sticky;
  top: 0;
  z-index: 10;
}

.users-content {
  padding: 12px 16px;
}

.users-loading {
  display: flex;
  justify-content: center;
  padding-top: 80px;
}

.users-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.user-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fff;
  border-radius: 12px;
  padding: 12px;
  cursor: pointer;
}

.user-item__avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #0052d9;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 600;
  flex-shrink: 0;
}

.user-item__info {
  flex: 1;
  min-width: 0;
}

.user-item__name {
  font-size: 15px;
  font-weight: 500;
  color: #333;
}

.user-item__school {
  font-size: 12px;
  color: #999;
  margin-top: 2px;
}

.user-item__rep {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-top: 2px;
}

.star-xs {
  font-size: 13px;
  color: #ddd;
}

.star-xs.active {
  color: #f5a623;
}

.rep-num {
  font-size: 12px;
  color: #f5a623;
  font-weight: 600;
  margin-left: 4px;
}

.users-empty {
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
  max-height: 85vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 0;
  position: sticky;
  top: 0;
  background: #fff;
  z-index: 1;
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
  gap: 14px;
}

.profile-header {
  display: flex;
  align-items: center;
  gap: 14px;
}

.profile-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #0052d9;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 600;
  flex-shrink: 0;
}

.profile-info {
  flex: 1;
}

.profile-name {
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.profile-school {
  font-size: 13px;
  color: #999;
  margin-top: 2px;
}

.profile-rep {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-top: 4px;
}

.profile-stats {
  display: flex;
  justify-content: center;
  gap: 12px;
  font-size: 13px;
  color: #666;
  padding: 8px 0;
  border-top: 1px solid #f0f0f0;
  border-bottom: 1px solid #f0f0f0;
}

.stat-divider {
  color: #ddd;
}

.profile-rate {
  border-top: 1px solid #f0f0f0;
  padding-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.rate-title {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.rating-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.star-rating {
  display: inline-flex;
  gap: 4px;
}

.star {
  font-size: 28px;
  color: #ddd;
  cursor: pointer;
  transition: color 0.15s;
  user-select: none;
}

.star:hover,
.star.active {
  color: #f5a623;
}

.rating-text {
  font-size: 13px;
  color: #f5a623;
  font-weight: 600;
}

.star-sm {
  font-size: 13px;
  color: #ddd;
}

.star-sm.active {
  color: #f5a623;
}

.profile-reviews {
  border-top: 1px solid #f0f0f0;
  padding-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.review-item {
  padding: 8px 0;
  border-bottom: 1px solid #f5f5f5;
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

.review-author {
  font-size: 12px;
  color: #999;
}

.review-note {
  font-size: 13px;
  color: #666;
  margin-top: 4px;
}

.app-version {
  text-align: center;
  padding: 16px;
  font-size: 11px;
  color: #ccc;
}
</style>
