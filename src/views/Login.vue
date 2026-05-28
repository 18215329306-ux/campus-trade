<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import { signIn, skipLogin, verifyPhone, resetPassword } from '../stores/auth'

const router = useRouter()
const route = useRoute()

const username = ref('')
const password = ref('')
const loading = ref(false)

// 忘记密码弹窗
const showReset = ref(false)
const resetUsername = ref('')
const resetPhone = ref('')
const resetNewPassword = ref('')
const resetLoading = ref(false)
const resetStep = ref(1) // 1=验证身份, 2=设置新密码

async function handleLogin() {
  if (!username.value.trim()) return MessagePlugin.warning('请输入账号名')
  if (!password.value) return MessagePlugin.warning('请输入密码')

  loading.value = true
  const { error } = await signIn(username.value.trim(), password.value)
  loading.value = false

  if (error) {
    MessagePlugin.warning(error.message)
    if (error.code === 'not_found') {
      // 账号不存在，1秒后跳注册
      setTimeout(() => router.push('/register'), 1000)
    }
    return
  }

  MessagePlugin.success('登录成功')
  const redirect = route.query.redirect || '/'
  router.push(redirect)
}

function handleSkip() {
  skipLogin()
  router.push('/')
}

// 忘记密码流程
function openReset() {
  resetUsername.value = ''
  resetPhone.value = ''
  resetNewPassword.value = ''
  resetStep.value = 1
  showReset.value = true
}

async function handleVerifyPhone() {
  if (!resetUsername.value.trim()) return MessagePlugin.warning('请输入账号名')
  if (!resetPhone.value.trim()) return MessagePlugin.warning('请输入注册时填写的手机号')

  resetLoading.value = true
  const valid = await verifyPhone(resetUsername.value.trim(), resetPhone.value.trim())
  resetLoading.value = false

  if (!valid) {
    MessagePlugin.warning('账号与手机号不匹配')
    return
  }
  resetStep.value = 2
}

async function handleResetPassword() {
  if (!resetNewPassword.value) return MessagePlugin.warning('请输入新密码')
  if (resetNewPassword.value.length < 6) return MessagePlugin.warning('密码至少6位')

  resetLoading.value = true
  const { error } = await resetPassword(
    resetUsername.value.trim(),
    resetPhone.value.trim(),
    resetNewPassword.value,
  )
  resetLoading.value = false

  if (error) {
    MessagePlugin.warning(error.message)
    return
  }

  MessagePlugin.success('密码重置成功，请登录')
  showReset.value = false
  username.value = resetUsername.value
  password.value = ''
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <h2 class="auth-title">登录</h2>

      <div class="auth-form">
        <t-input v-model="username" placeholder="账号名" clearable size="large" />
        <t-input v-model="password" type="password" placeholder="密码" clearable size="large"
          @enter="handleLogin" />

        <t-button theme="primary" size="large" block :loading="loading" @click="handleLogin">
          登录
        </t-button>

        <div class="auth-link">
          <span @click="openReset" class="forgot-link">忘记密码？</span>
        </div>

        <div class="auth-link">
          没有账号？<router-link to="/register">去注册</router-link>
        </div>

        <t-divider />

        <t-button theme="default" size="large" block @click="handleSkip">
          暂不登录，先看看
        </t-button>
      </div>
    </div>
  </div>

  <!-- 忘记密码弹窗 -->
  <teleport to="body">
    <div v-if="showReset" class="modal-overlay" @click.self="showReset = false">
      <div class="modal-card">
        <div class="modal-header">
          <span class="modal-title">找回密码</span>
          <span class="modal-close" @click="showReset = false">&times;</span>
        </div>

        <div class="modal-body">
          <!-- 第一步：验证身份 -->
          <template v-if="resetStep === 1">
            <t-input v-model="resetUsername" placeholder="账号名" clearable size="large" />
            <t-input v-model="resetPhone" placeholder="注册时填写的手机号" clearable size="large" />
            <t-button theme="primary" size="large" block :loading="resetLoading" @click="handleVerifyPhone">
              验证身份
            </t-button>
          </template>

          <!-- 第二步：设置新密码 -->
          <template v-else>
            <p class="reset-hint">验证通过，请设置新密码</p>
            <t-input v-model="resetNewPassword" type="password" placeholder="新密码（至少6位）" clearable size="large" />
            <t-button theme="primary" size="large" block :loading="resetLoading" @click="handleResetPassword">
              重置密码
            </t-button>
          </template>
        </div>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  padding: 20px;
}

.auth-card {
  width: 100%;
  max-width: 400px;
  background: #fff;
  border-radius: 16px;
  padding: 32px 24px;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.06);
}

.auth-title {
  text-align: center;
  font-size: 22px;
  margin-bottom: 24px;
  color: #333;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.auth-link {
  text-align: center;
  font-size: 14px;
  color: #999;
}

.auth-link a {
  color: #0052d9;
  text-decoration: none;
}

.forgot-link {
  color: #0052d9;
  cursor: pointer;
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

.reset-hint {
  font-size: 14px;
  color: #666;
  text-align: center;
}
</style>
