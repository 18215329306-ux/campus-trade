<script setup>
import { ref, watch, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

const activeTab = ref('home')

const tabs = [
  { key: 'home', label: '首页', icon: 'home', path: '/' },
  { key: 'deals', label: '交易', icon: 'swap', path: '/deals' },
  { key: 'users', label: '用户', icon: 'usergroup', path: '/users' },
  { key: 'my', label: '我的', icon: 'user', path: '/my' },
]

// 这些页面隐藏底部导航
const hideTabbar = computed(() => {
  const path = route.path
  return path === '/login' || path === '/register' || path.startsWith('/detail') || path === '/release'
})

watch(
  () => route.path,
  (path) => {
    if (path === '/') activeTab.value = 'home'
    else if (path === '/deals') activeTab.value = 'deals'
    else if (path === '/users') activeTab.value = 'users'
    else if (path === '/my') activeTab.value = 'my'
    else activeTab.value = ''
  },
  { immediate: true }
)

function switchTab(key, path) {
  activeTab.value = key
  router.push(path)
}
</script>

<template>
  <div class="app-shell" :style="{ paddingBottom: hideTabbar ? '0' : '56px' }">
    <router-view />
    <!-- 底部导航栏（登录/注册页隐藏） -->
    <div v-if="!hideTabbar" class="app-tabbar">
      <div
        v-for="tab in tabs"
        :key="tab.key"
        class="tabbar-item"
        :class="{ 'tabbar-item--active': activeTab === tab.key }"
        @click="switchTab(tab.key, tab.path)"
      >
        <span class="tabbar-item__icon">
                {{ tab.icon === 'home' ? '⌂' : tab.icon === 'swap' ? '⇄' : tab.icon === 'usergroup' ? '☷' : '⚙' }}
              </span>
        <span class="tabbar-item__label">{{ tab.label }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  min-height: 100vh;
  background: #f5f5f5;
  position: relative;
  padding-bottom: 56px;
  overflow: hidden;
}

@media (min-width: 768px) {
  .app-shell {
    max-width: 960px;
    border-radius: 16px;
    margin-top: 16px;
    margin-bottom: 16px;
    min-height: calc(100vh - 32px);
    box-shadow: 0 4px 24px rgba(0,0,0,0.08);
  }
}

@media (min-width: 1200px) {
  .app-shell {
    max-width: 1120px;
  }
}

.app-tabbar {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 480px;
  background: #fff;
  border-top: 1px solid #eee;
  z-index: 100;
  display: flex;
  justify-content: space-around;
  padding: 6px 0 env(safe-area-inset-bottom, 6px);
}

@media (min-width: 768px) {
  .app-tabbar {
    max-width: 960px;
    border-radius: 0 0 16px 16px;
  }
}

@media (min-width: 1200px) {
  .app-tabbar {
    max-width: 1120px;
  }
}

.tabbar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px 12px;
  cursor: pointer;
  color: #999;
  transition: color 0.2s;
  user-select: none;
  -webkit-user-select: none;
}

.tabbar-item--active {
  color: #0052d9;
}

.tabbar-item__icon {
  font-size: 22px;
  line-height: 1;
}

.tabbar-item__label {
  font-size: 11px;
}
</style>
