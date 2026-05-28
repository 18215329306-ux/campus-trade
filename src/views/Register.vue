<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import { signUp } from '../stores/auth'

const router = useRouter()

const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const phone = ref('')
const school = ref('')
const name = ref('')
const loading = ref(false)

const phoneValid = computed(() => {
  if (!phone.value) return true // 未输入时不报错
  return /^\d{11}$/.test(phone.value)
})

async function handleRegister() {
  if (!username.value.trim()) return MessagePlugin.warning('请输入账号名')
  if (!password.value) return MessagePlugin.warning('请输入密码')
  if (password.value.length < 6) return MessagePlugin.warning('密码至少6位')
  if (password.value !== confirmPassword.value) return MessagePlugin.warning('两次密码不一致')
  if (!phone.value.trim()) return MessagePlugin.warning('请输入联系电话')
  if (!/^\d{11}$/.test(phone.value.trim())) return MessagePlugin.warning('请输入正确的11位手机号')
  if (!school.value.trim()) return MessagePlugin.warning('请输入学校')
  if (!name.value.trim()) return MessagePlugin.warning('请输入姓名')

  loading.value = true
  const { error } = await signUp(
    username.value.trim(),
    password.value,
    school.value.trim(),
    name.value.trim(),
    phone.value.trim(),
  )
  loading.value = false

  if (error) {
    MessagePlugin.warning(error.message || '注册失败')
    return
  }

  MessagePlugin.success('注册成功')
  router.push('/')
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <h2 class="auth-title">注册账号</h2>

      <div class="auth-form">
        <t-input v-model="username" placeholder="账号名（自定义）" clearable size="large" />
        <t-input v-model="password" type="password" placeholder="密码（至少6位）" clearable size="large" />
        <t-input v-model="confirmPassword" type="password" placeholder="确认密码" clearable size="large" />
        <t-input v-model="phone" placeholder="联系电话（11位手机号，用于找回密码）" clearable size="large" maxlength="11"
          :status="phoneValid ? 'default' : 'error'"
          :tips="phoneValid ? '' : '请输入11位手机号'" />
        <t-input v-model="school" placeholder="学校" clearable size="large" />
        <t-input v-model="name" placeholder="姓名" clearable size="large" />

        <t-button theme="primary" size="large" block :loading="loading" @click="handleRegister">
          注册
        </t-button>

        <div class="auth-link">
          已有账号？<router-link to="/login">去登录</router-link>
        </div>
      </div>
    </div>
  </div>
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
</style>
