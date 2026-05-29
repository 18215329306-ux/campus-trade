<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import { signUp } from '../stores/auth'
import { rulesContent } from '../rules'

const router = useRouter()

const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const phone = ref('')
const school = ref('')
const name = ref('')
const loading = ref(false)
const agreed = ref(false)
const showRules = ref(false)
const showSuccess = ref(false)
const registeredInfo = ref(null)

const phoneValid = computed(() => {
  if (!phone.value) return true
  return /^\d{11}$/.test(phone.value)
})

const schoolOptions = [
  '安徽大学', '安徽工业大学', '安徽理工大学', '安徽农业大学', '安徽师范大学',
  '北京大学', '北京电影学院', '北京工业大学', '北京航空航天大学', '北京化工大学',
  '北京交通大学', '北京科技大学', '北京理工大学', '北京林业大学', '北京师范大学',
  '北京体育大学', '北京外国语大学', '北京邮电大学', '北京中医药大学',
  '重庆大学', '重庆工商大学', '重庆交通大学', '重庆理工大学', '重庆师范大学', '重庆邮电大学',
  '大连海事大学', '大连理工大学', '电子科技大学', '东北财经大学', '东北大学', '东北电力大学',
  '东北林业大学', '东北农业大学', '东北师范大学', '东华大学', '东南大学',
  '福建农林大学', '福建师范大学', '福州大学', '复旦大学',
  '广东工业大学', '广东外语外贸大学', '广西大学', '广西师范大学', '广州大学',
  '贵州大学',
  '哈尔滨工程大学', '哈尔滨工业大学', '哈尔滨理工大学', '哈尔滨师范大学',
  '海南大学', '杭州电子科技大学', '合肥工业大学', '河北大学', '河北工业大学',
  '河北师范大学', '河海大学', '河南大学', '河南科技大学', '河南理工大学',
  '河南农业大学', '河南师范大学', '黑龙江大学', '湖北大学', '湖南大学',
  '湖南科技大学', '湖南农业大学', '湖南师范大学', '华北电力大学', '华东交通大学',
  '华东理工大学', '华东师范大学', '华东政法大学', '华南理工大学', '华南农业大学',
  '华南师范大学', '华侨大学', '华中科技大学', '华中农业大学', '华中师范大学',
  '吉林大学', '吉林农业大学', '吉林师范大学', '济南大学', '暨南大学',
  '江苏大学', '江苏科技大学', '江西财经大学', '江西理工大学', '江西师范大学',
  '昆明理工大学',
  '兰州大学', '兰州交通大学', '辽宁大学', '辽宁工程技术大学', '辽宁师范大学',
  '南昌大学', '南京财经大学', '南京大学', '南京工业大学', '南京航空航天大学',
  '南京理工大学', '南京林业大学', '南京农业大学', '南京师范大学', '南京信息工程大学',
  '南京邮电大学', '南开大学', '内蒙古大学', '宁波大学',
  '青岛大学', '青岛科技大学', '清华大学',
  '厦门大学', '山东大学', '山东工商学院', '山东科技大学', '山东理工大学',
  '山东农业大学', '山东师范大学', '山西大学', '陕西科技大学', '陕西师范大学',
  '汕头大学', '上海财经大学', '上海大学', '上海海事大学', '上海交通大学',
  '上海理工大学', '上海师范大学', '上海外国语大学', '深圳大学',
  '沈阳工业大学', '沈阳航空航天大学', '沈阳建筑大学', '沈阳理工大学',
  '沈阳农业大学', '沈阳师范大学', '石河子大学', '首都经济贸易大学', '首都师范大学',
  '四川大学', '四川农业大学', '四川师范大学', '苏州大学',
  '太原理工大学', '天津财经大学', '天津大学', '天津工业大学', '天津科技大学',
  '天津理工大学', '天津师范大学', '天津医科大学', '同济大学',
  '武汉大学', '武汉工程大学', '武汉科技大学', '武汉理工大学',
  '西安电子科技大学', '西安建筑科技大学', '西安交通大学', '西安科技大学',
  '西安理工大学', '西安石油大学', '西安邮电大学', '西北大学', '西北工业大学',
  '西北农林科技大学', '西南财经大学', '西南大学', '西南交通大学', '西南科技大学',
  '西南民族大学', '西南石油大学',
  '湘潭大学', '新疆大学',
  '延边大学', '燕山大学', '扬州大学', '云南大学',
  '长安大学', '长春理工大学', '长沙理工大学', '浙江大学', '浙江工商大学',
  '浙江工业大学', '浙江理工大学', '浙江师范大学', '郑州大学', '郑州轻工业大学',
  '中北大学', '中国传媒大学', '中国地质大学', '中国海洋大学', '中国科学技术大学',
  '中国矿业大学', '中国农业大学', '中国人民大学', '中国石油大学', '中国药科大学',
  '中国政法大学', '中南财经政法大学', '中南大学', '中山大学', '中央财经大学',
  '中央民族大学',
]

async function handleRegister() {
  if (!username.value.trim()) return MessagePlugin.warning('请输入账号')
  if (!password.value) return MessagePlugin.warning('请输入密码')
  if (password.value.length < 6) return MessagePlugin.warning('密码至少6位')
  if (password.value !== confirmPassword.value) return MessagePlugin.warning('两次密码不一致')
  if (!phone.value.trim()) return MessagePlugin.warning('请输入联系电话')
  if (!/^\d{11}$/.test(phone.value.trim())) return MessagePlugin.warning('请输入正确的11位手机号')
  if (!school.value) return MessagePlugin.warning('请选择学校')
  if (!agreed.value) return MessagePlugin.warning('请先阅读并同意校园二手交易信息平台规范')
  if (!name.value.trim()) return MessagePlugin.warning('请输入用户名')

  loading.value = true
  const { error } = await signUp(
    username.value.trim(),
    password.value,
    school.value,
    name.value.trim(),
    phone.value.trim(),
  )
  loading.value = false

  if (error) {
    MessagePlugin.warning(error.message || '注册失败')
    return
  }

  registeredInfo.value = {
    username: username.value.trim(),
    name: name.value.trim(),
    school: school.value,
    phone: phone.value.trim(),
  }
  showSuccess.value = true
}
function closeSuccess() {
  showSuccess.value = false
  router.push('/')
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <h2 class="auth-title">注册账号</h2>

      <div class="auth-form">
        <t-input v-model="username" placeholder="账号（自定义）" clearable size="large" />
        <t-input v-model="password" type="password" placeholder="密码（至少6位）" clearable size="large" />
        <t-input v-model="confirmPassword" type="password" placeholder="确认密码" clearable size="large" />
        <t-input v-model="phone" placeholder="联系电话（11位手机号，用于找回密码）" clearable size="large" maxlength="11"
          :status="phoneValid ? 'default' : 'error'"
          :tips="phoneValid ? '' : '请输入11位手机号'" />
        <t-select
          v-model="school"
          placeholder="请选择学校"
          size="large"
          filterable
          clearable
          :options="schoolOptions.map(s => ({ label: s, value: s }))"
        />
        <t-input v-model="name" placeholder="用户名" clearable size="large" />

        <div class="rules-check"><t-checkbox v-model="agreed">我已阅读并同意<span class="rules-link" @click.stop="showRules = true">《校园二手交易信息平台规范》</span></t-checkbox></div>
        <t-button theme="primary" size="large" block :loading="loading" @click="handleRegister">
          注册
        </t-button>

        <div class="auth-link">
          已有账号？<router-link to="/login">去登录</router-link>
        </div>
      </div>
    </div>
  </div>

  <!-- 注册成功弹窗 -->
  <teleport to="body">
    <div v-if="showSuccess" class="reg-success-overlay">
      <div class="reg-success-card">
        <div class="reg-success-icon">✓</div>
        <div class="reg-success-title">注册成功！</div>
        <div class="reg-success-hint">建议截图保存以下注册信息</div>
        <div class="reg-success-info">
          <div class="reg-info-row">
            <span class="reg-info-label">账号</span>
            <span class="reg-info-value">{{ registeredInfo?.username }}</span>
          </div>
          <div class="reg-info-row">
            <span class="reg-info-label">用户名</span>
            <span class="reg-info-value">{{ registeredInfo?.name }}</span>
          </div>
          <div class="reg-info-row">
            <span class="reg-info-label">学校</span>
            <span class="reg-info-value">{{ registeredInfo?.school }}</span>
          </div>
          <div class="reg-info-row">
            <span class="reg-info-label">手机号</span>
            <span class="reg-info-value">{{ registeredInfo?.phone }}</span>
          </div>
        </div>
        <t-button theme="primary" size="large" block @click="closeSuccess">进入平台</t-button>
      </div>
    </div>
  </teleport>

    

    <div class="app-version">版本 1.0</div>
  <teleport to="body">
    <div v-if="showRules" class="modal-overlay" @click.self="showRules = false">
      <div class="modal-card rules-modal">
        <div class="modal-header"><span class="modal-title">平台规范</span><span class="modal-close" @click="showRules = false">&times;</span></div>
        <div class="modal-body rules-body">{{ rulesContent }}</div>
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

.reg-success-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.reg-success-card {
  width: 100%;
  max-width: 360px;
  background: #fff;
  border-radius: 16px;
  padding: 32px 24px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.reg-success-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #2ba471;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  margin: 0 auto;
}

.reg-success-title {
  font-size: 20px;
  font-weight: 600;
  color: #333;
}

.reg-success-hint {
  font-size: 13px;
  color: #e34d59;
  font-weight: 500;
}

.reg-success-info {
  background: #f9f9f9;
  border-radius: 10px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  text-align: left;
}

.reg-info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.reg-info-label {
  font-size: 13px;
  color: #999;
}

.reg-info-value {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.app-version {
  text-align: center;
  padding: 16px;
  font-size: 11px;
  color: #ccc;
}

.rules-check { padding: 4px 0; }
.rules-link { color: #0052d9; cursor: pointer; text-decoration: underline; }
.rules-modal { max-width: 420px; max-height: 80vh; }
.rules-body { white-space: pre-wrap; font-size: 13px; line-height: 1.8; color: #333; max-height: 60vh; overflow-y: auto; }
</style>
