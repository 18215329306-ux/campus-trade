<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import { supabase } from '../supabase'
import { user, signOut, initAuth, authReady, verifyPhone, verifyPassword, resetPassword } from '../stores/auth'
import { rulesContent } from '../rules'

const router = useRouter()

onMounted(async () => {
  await initAuth()
  if (!user.value) { router.push('/login'); return }
  const { data: me } = await supabase.from('users').select('reputation').eq('id', user.value.id).single()
  if (me) user.value.reputation = me.reputation
})

// 修改密码
const showChangePwd = ref(false)
const changePwdPhone = ref('')
const changePwdOld = ref('')
const changePwdNew = ref('')
const changePwdLoading = ref(false)
const changePwdStep = ref(1)

function openChangePwd() {
  changePwdPhone.value = ''; changePwdOld.value = ''; changePwdNew.value = ''
  changePwdStep.value = 1; showChangePwd.value = true
}

async function handleVerifyForChange() {
  if (!changePwdOld.value) return MessagePlugin.warning('请输入原密码')
  if (!changePwdPhone.value.trim()) return MessagePlugin.warning('请输入联系电话')
  changePwdLoading.value = true
  const pwdOk = await verifyPassword(user.value.username, changePwdOld.value)
  if (!pwdOk) { changePwdLoading.value = false; return MessagePlugin.warning('原密码错误') }
  const phoneOk = await verifyPhone(user.value.username, changePwdPhone.value.trim())
  changePwdLoading.value = false
  if (!phoneOk) return MessagePlugin.warning('手机号不匹配')
  changePwdStep.value = 2
}

async function handleChangePwd() {
  if (!changePwdNew.value) return MessagePlugin.warning('请输入新密码')
  if (changePwdNew.value.length < 6) return MessagePlugin.warning('密码至少6位')
  changePwdLoading.value = true
  const { error } = await resetPassword(user.value.username, changePwdPhone.value.trim(), changePwdNew.value)
  changePwdLoading.value = false
  if (error) return MessagePlugin.warning(error.message)
  MessagePlugin.success('密码修改成功'); showChangePwd.value = false
}

// 系统消息
const showNotifications = ref(false)
const notifications = ref([])
const unreadCount = ref(0)

async function fetchNotifications() {
  if (!user.value) return
  const { data } = await supabase.from('notifications').select('*').eq('user_id', user.value.id).order('created_at', { ascending: false }).limit(20)
  notifications.value = data || []
  unreadCount.value = notifications.value.filter(n => !n.read).length
}

async function readNotification(n) {
  if (n.read) return
  await supabase.from('notifications').update({ read: true }).eq('id', n.id)
  n.read = true; unreadCount.value = notifications.value.filter(x => !x.read).length
}

async function clearAllNotifications() {
  await supabase.from('notifications').delete().eq('user_id', user.value.id)
  notifications.value = []; unreadCount.value = 0
}

// 注册信息
const showRegInfo = ref(false)

// 意见反馈
const showFeedback = ref(false)
const showAbout = ref(false)
const showRules = ref(false)
const feedbackContent = ref('')
const feedbackLoading = ref(false)

async function submitFeedback() {
  if (!feedbackContent.value.trim()) return MessagePlugin.warning('请输入反馈内容')
  feedbackLoading.value = true
  const { error } = await supabase.from('feedbacks').insert({ user_id: user.value.id, content: feedbackContent.value.trim() })
  feedbackLoading.value = false
  if (error) return MessagePlugin.warning('提交失败')
  MessagePlugin.success('感谢你的反馈！'); showFeedback.value = false; feedbackContent.value = ''
}

// 注销账号
const deletingAccount = ref(false)

async function deleteAccount() {
  if (!confirm('确定要注销账号吗？\n\n此操作不可撤销。')) return
  if (!confirm('再次确认：真的要注销账号吗？')) return
  deletingAccount.value = true; const uid = user.value.id
  await supabase.from('reputation_logs').delete().eq('user_id', uid)
  await supabase.from('user_reviews').delete().or(`reviewer_id.eq.${uid},target_id.eq.${uid}`)
  await supabase.from('follows').delete().or(`follower_id.eq.${uid},following_id.eq.${uid}`)
  await supabase.from('notifications').delete().eq('user_id', uid)
  await supabase.from('reports').delete().or(`reporter_id.eq.${uid},reported_user_id.eq.${uid}`)
  await supabase.from('deals').delete().or(`seller_id.eq.${uid},buyer_id.eq.${uid}`)
  await supabase.from('goods').delete().eq('user_id', uid)
  await supabase.from('users').delete().eq('id', uid)
  deletingAccount.value = false; signOut(); router.push('/login')
}

function handleLogout() { signOut(); router.push('/login') }

function toLocalTime(utcStr) {
  if (!utcStr) return ''
  const d = new Date(utcStr.includes('T') ? utcStr : utcStr.replace(' ', 'T') + 'Z')
  if (isNaN(d.getTime())) return utcStr.slice(0, 16).replace('T', ' ')
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<template>
  <div v-if="!authReady" class="loading-page"><t-loading size="medium" text="加载中..." /></div>
  <div v-else-if="!user" class="loading-page"><t-loading size="medium" text="请先登录..." /></div>
  <div v-else class="my-page">
    <div class="my-header">
      <div class="my-avatar">{{ user?.name?.charAt(0) || 'U' }}</div>
      <div class="my-info">
        <div class="my-name">{{ user?.name }}</div>
        <div class="my-school">{{ user?.school }}</div>
        <div class="my-reputation">
          <span v-for="s in 5" :key="s" class="star-sm" :class="{ active: s <= Math.round(Number(user?.reputation) || 5) }">★</span>
          <span class="reputation-score">{{ typeof user?.reputation === 'number' ? user.reputation.toFixed(1) : '5.0' }}</span>
        </div>
      </div>
      <t-button v-if="user?.role === 'admin'" size="small" variant="text" theme="primary" @click="router.push('/admin')">管理后台</t-button>
    </div>

    <div class="my-menu">
      <div class="my-menu-group">
        <div class="my-menu-item" @click="openChangePwd">
          <t-icon name="lock-on" size="18px" /><span>修改密码</span><t-icon name="chevron-right" size="16px" class="menu-arrow" />
        </div>
        <div class="my-menu-item" @click="fetchNotifications(); showNotifications = true">
          <t-icon name="notification" size="18px" /><span>系统消息</span>
          <t-badge v-if="unreadCount > 0" :count="unreadCount" size="small" />
          <t-icon name="chevron-right" size="16px" class="menu-arrow" />
        </div>
        <div class="my-menu-item" @click="showRegInfo = true">
          <t-icon name="file-paste" size="18px" /><span>注册信息</span><t-icon name="chevron-right" size="16px" class="menu-arrow" />
        </div>
        <div class="my-menu-item" @click="showFeedback = true">
          <t-icon name="edit" size="18px" /><span>意见反馈</span><t-icon name="chevron-right" size="16px" class="menu-arrow" />
        </div>
        <div class="my-menu-item" @click="showRules = true">
          <t-icon name="file" size="18px" /><span>平台规范</span><t-icon name="chevron-right" size="16px" class="menu-arrow" />
        </div>
        <div class="my-menu-item" @click="showAbout = true">
          <t-icon name="info-circle" size="18px" /><span>关于我们</span><t-icon name="chevron-right" size="16px" class="menu-arrow" />
        </div>
      </div>
      <div class="my-menu-group">
        <div class="my-menu-item" @click="handleLogout">
          <t-icon name="poweroff" size="18px" /><span>退出登录</span>
        </div>
        <div class="my-menu-item my-menu-item--danger" @click="deleteAccount">
          <t-icon name="error-circle" size="18px" /><span>注销账号</span>
        </div>
      </div>
    </div>

    <div class="app-version">版本 1.0</div>
  </div>

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
          <div v-for="n in notifications" :key="n.id" class="notif-item" :class="{ 'notif-item--unread': !n.read }" @click="readNotification(n)">
            <div class="notif-item__dot" v-if="!n.read"></div>
            <div class="notif-item__content">
              <div class="notif-item__title">{{ n.title }}</div>
              <div class="notif-item__text">{{ n.content }}</div>
              <div class="notif-item__time">{{ toLocalTime(n.created_at) }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </teleport>

  <teleport to="body">
    <div v-if="showRegInfo" class="modal-overlay" @click.self="showRegInfo = false">
      <div class="modal-card">
        <div class="modal-header"><span class="modal-title">注册信息</span><span class="modal-close" @click="showRegInfo = false">&times;</span></div>
        <div class="modal-body">
          <div class="reginfo-list">
            <div class="reginfo-row"><span class="reginfo-label">账号</span><span class="reginfo-value">{{ user?.username }}</span></div>
            <div class="reginfo-row"><span class="reginfo-label">用户名</span><span class="reginfo-value">{{ user?.name }}</span></div>
            <div class="reginfo-row"><span class="reginfo-label">学校</span><span class="reginfo-value">{{ user?.school }}</span></div>
            <div class="reginfo-row"><span class="reginfo-label">手机号</span><span class="reginfo-value">{{ user?.phone }}</span></div>
            <div class="reginfo-row"><span class="reginfo-label">信誉评分</span><span class="reginfo-value" style="color:#f5a623">{{ user?.reputation ? user.reputation.toFixed(1) : '5.0' }}</span></div>
            <div class="reginfo-row"><span class="reginfo-label">注册时间</span><span class="reginfo-value">{{ toLocalTime(user?.created_at) }}</span></div>
          </div>
          <div class="reginfo-about"><div class="reginfo-about-ver">版本 1.0</div></div>
        </div>
      </div>
    </div>
  </teleport>

  <teleport to="body">
    <div v-if="showChangePwd" class="modal-overlay" @click.self="showChangePwd = false">
      <div class="modal-card">
        <div class="modal-header"><span class="modal-title">修改密码</span><span class="modal-close" @click="showChangePwd = false">&times;</span></div>
        <div class="modal-body">
          <template v-if="changePwdStep === 1">
            <p class="modal-hint">请输入原密码和手机号验证身份</p>
            <t-input v-model="changePwdOld" type="password" placeholder="原密码" clearable size="large" />
            <t-input v-model="changePwdPhone" placeholder="联系电话" clearable size="large" />
            <t-button theme="primary" size="large" block :loading="changePwdLoading" @click="handleVerifyForChange">验证</t-button>
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

  <teleport to="body">
    <div v-if="showFeedback" class="modal-overlay" @click.self="showFeedback = false">
      <div class="modal-card">
        <div class="modal-header"><span class="modal-title">意见反馈</span><span class="modal-close" @click="showFeedback = false">&times;</span></div>
        <div class="modal-body">
          <t-textarea v-model="feedbackContent" placeholder="请描述你的建议或遇到的问题..." :autosize="{ minRows: 4, maxRows: 8 }" />
          <t-button theme="primary" block :loading="feedbackLoading" @click="submitFeedback">提交反馈</t-button>
        </div>
      </div>
    </div>
  </teleport>

  <teleport to="body">
    <div v-if="showRules" class="modal-overlay" @click.self="showRules = false">
      <div class="modal-card rules-modal">
        <div class="modal-header"><span class="modal-title">平台规范</span><span class="modal-close" @click="showRules = false">&times;</span></div>
        <div class="modal-body rules-body">{{ rulesContent }}</div>
      </div>
    </div>
  </teleport>

  <teleport to="body">
    <div v-if="showAbout" class="modal-overlay" @click.self="showAbout = false">
      <div class="modal-card">
        <div class="modal-header"><span class="modal-title">关于我们</span><span class="modal-close" @click="showAbout = false">&times;</span></div>
        <div class="modal-body about-body">
          <div class="about-title">关于我们</div>
          <div class="about-section">
            <div class="about-section-title">简介</div>
            <p>这是一个由学生开发、服务校园的二手交易平台，用户可自行交易，完成后线上确认。我们的目的是让闲置流动起来，为大家纾困解难。</p>
          </div>
          <div class="about-section">
            <div class="about-section-title">开发者</div>
            <p>@无问西东、@逆风、@QuQ</p>
          </div>
        </div>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
.my-page { min-height: 100vh; background: #f5f5f5; padding-bottom: 80px; }
.loading-page { display: flex; justify-content: center; align-items: center; min-height: 100vh; }

.my-header { display: flex; align-items: center; gap: 12px; padding: 20px 16px; background: #fff; margin-bottom: 12px; }
.my-avatar { width: 48px; height: 48px; border-radius: 50%; background: #0052d9; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 600; }
.my-info { flex: 1; }
.my-name { font-size: 17px; font-weight: 600; color: #333; }
.my-school { font-size: 13px; color: #999; margin-top: 2px; }
.my-reputation { display: flex; align-items: center; gap: 2px; margin-top: 2px; }
.star-sm { font-size: 13px; color: #ddd; }
.star-sm.active { color: #f5a623; }
.reputation-score { font-size: 12px; color: #f5a623; font-weight: 600; margin-left: 4px; }

.my-menu { margin: 0 16px 12px; }
.my-menu-group { background: #fff; border-radius: 12px; overflow: hidden; margin-bottom: 12px; }
.my-menu-item { display: flex; align-items: center; gap: 12px; padding: 14px 16px; font-size: 15px; color: #333; cursor: pointer; border-bottom: 1px solid #f5f5f5; transition: background 0.15s; }
.my-menu-item:last-child { border-bottom: none; }
.my-menu-item:hover { background: #f9f9f9; }
.my-menu-item--danger { color: #e34d59; }
.menu-arrow { margin-left: auto; color: #ccc; }

.reginfo-list { background: #f9f9f9; border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
.reginfo-row { display: flex; justify-content: space-between; align-items: center; }
.reginfo-label { font-size: 13px; color: #999; }
.reginfo-value { font-size: 14px; font-weight: 500; color: #333; }
.reginfo-about { text-align: center; padding-top: 12px; border-top: 1px solid #f0f0f0; }
.reginfo-about-ver { font-size: 12px; color: #999; }

.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px; }
.modal-card { width: 100%; max-width: 380px; background: #fff; border-radius: 12px; overflow: hidden; }
.modal-card--wide { max-width: 420px; }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px 0; }
.modal-title { font-size: 17px; font-weight: 600; }
.modal-close { font-size: 24px; color: #999; cursor: pointer; }
.modal-body { padding: 20px; display: flex; flex-direction: column; gap: 12px; }
.modal-body--scroll { max-height: 60vh; overflow-y: auto; }
.modal-hint { font-size: 14px; color: #666; text-align: center; }

.notif-item { display: flex; align-items: flex-start; gap: 10px; padding: 12px; border-radius: 8px; background: #f9f9f9; cursor: pointer; }
.notif-item--unread { background: #e8f0fe; }
.notif-item__dot { width: 8px; height: 8px; border-radius: 50%; background: #e34d59; flex-shrink: 0; margin-top: 6px; }
.notif-item__content { flex: 1; min-width: 0; }
.notif-item__title { font-size: 14px; font-weight: 500; color: #333; }
.notif-item__text { font-size: 13px; color: #666; margin-top: 2px; }
.notif-item__time { font-size: 11px; color: #bbb; margin-top: 4px; }
.app-version { text-align: center; padding: 16px; font-size: 11px; color: #ccc; }

.rules-modal { max-width: 420px; max-height: 80vh; }
.rules-body { white-space: pre-wrap; font-size: 13px; line-height: 1.8; color: #333; max-height: 60vh; overflow-y: auto; }

.about-body { text-align: left !important; color: #333 !important; padding: 20px !important; }
.about-title { text-align: center; font-size: 18px; font-weight: 600; margin-bottom: 16px; }
.about-section { margin-bottom: 16px; }
.about-section-title { font-size: 14px; font-weight: 600; color: #0052d9; margin-bottom: 6px; }
.about-section p { font-size: 14px; line-height: 1.7; color: #555; margin: 0; }
</style>
