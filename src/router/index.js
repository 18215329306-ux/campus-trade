import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/Home.vue'),
  },
  {
    path: '/search',
    name: 'Search',
    component: () => import('../views/Search.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/detail/:id',
    name: 'Detail',
    component: () => import('../views/Detail.vue'),
    props: true,
    meta: { requiresAuth: true },
  },
  {
    path: '/release',
    name: 'Release',
    component: () => import('../views/Release.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('../views/Register.vue'),
  },
  {
    path: '/my',
    name: 'My',
    component: () => import('../views/My.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/admin',
    name: 'Admin',
    component: () => import('../views/Admin.vue'),
    meta: { requiresAuth: true },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to, from, next) => {
  const { user, skipped, initAuth, authReady } = await import('../stores/auth')
  if (!authReady.value) await initAuth()

  // 需要登录的页面 → 未登录就跳登录
  if (to.meta.requiresAuth && !user.value) {
    next({ path: '/login', query: { redirect: to.fullPath } })
    return
  }

  // 首次访问首页 → 没登录也没跳过 → 跳登录
  if (to.path === '/' && !user.value && !skipped.value) {
    next('/login')
    return
  }

  next()
})

export default router
