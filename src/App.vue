<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="app-shell">
    <router-view />
    <!-- 底部导航栏 -->
    <t-tab-bar v-model="activeTab" @change="onTabChange" class="app-tabbar">
      <t-tab-bar-item value="home" icon="home" label="首页" />
      <t-tab-bar-item value="release" icon="add-circle" label="发布" />
      <t-tab-bar-item value="search" icon="search" label="搜索" />
    </t-tab-bar>
  </div>
</template>

<script>
export default {
  data() {
    return {
      activeTab: 'home',
    }
  },
  methods: {
    onTabChange(value) {
      const routeMap = {
        home: '/',
        search: '/search',
        release: '/release',
      }
      this.$router.push(routeMap[value])
    },
  },
  watch: {
    $route(to) {
      if (to.path === '/') this.activeTab = 'home'
      else if (to.path === '/search') this.activeTab = 'search'
      else if (to.path === '/release') this.activeTab = 'release'
      else this.activeTab = ''
    },
  },
}
</script>

<style scoped>
.app-shell {
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  min-height: 100vh;
  background: #f5f5f5;
  position: relative;
  padding-bottom: 56px;
}

@media (min-width: 768px) {
  .app-shell {
    max-width: 960px;
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
}

@media (min-width: 768px) {
  .app-tabbar {
    max-width: 960px;
  }
}

@media (min-width: 1200px) {
  .app-tabbar {
    max-width: 1120px;
  }
}
</style>
