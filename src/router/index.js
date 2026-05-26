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
  },
  {
    path: '/detail/:id',
    name: 'Detail',
    component: () => import('../views/Detail.vue'),
    props: true,
  },
  {
    path: '/release',
    name: 'Release',
    component: () => import('../views/Release.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
