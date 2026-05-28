<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../supabase'
import ProductCard from '../components/ProductCard.vue'

const router = useRouter()

const categories = [
  { label: '全部', value: 'all' },
  { label: '书籍', value: '书籍' },
  { label: '电子', value: '电子' },
  { label: '生活', value: '生活' },
  { label: '衣物', value: '衣物' },
  { label: '其他', value: '其他' },
]

const activeCategory = ref('all')
const allCards = ref([])
const loading = ref(true)

onMounted(async () => {
  const { data, error } = await supabase
    .from('goods')
    .select('*')
    .order('created_at', { ascending: false })
  if (!error && data) {
    allCards.value = data
  }
  loading.value = false
})

const filteredCards = computed(() => {
  if (activeCategory.value === 'all') return allCards.value
  return allCards.value.filter(item => item.category === activeCategory.value)
})

function onCategoryChange(value) {
  activeCategory.value = value
}

function onCardClick(id) {
  const url = router.resolve(`/detail/${id}`).href
  window.open(url, '_blank')
}

function goSearch() {
  router.push('/search')
}

function goRelease() {
  router.push('/release')
}
</script>

<template>
  <div class="home-page">
    <!-- 搜索栏 -->
    <div class="home-search" @click="goSearch">
      <div class="home-search__bar">
        <t-icon name="search" size="18px" />
        <span class="home-search__text">搜点什么...</span>
      </div>
    </div>

    <!-- 分类导航 -->
    <div class="home-categories">
      <div
        v-for="cat in categories"
        :key="cat.value"
        class="home-category"
        :class="{ 'home-category--active': activeCategory === cat.value }"
        @click="onCategoryChange(cat.value)"
      >
        {{ cat.label }}
      </div>
    </div>

    <!-- 商品列表 -->
    <div class="home-content">
      <div v-if="loading" class="home-loading">
        <t-loading size="medium" text="加载中..." />
      </div>
      <div v-else-if="filteredCards.length > 0" class="home-card-list">
        <ProductCard
          v-for="item in filteredCards"
          :key="item.id"
          :id="item.id"
          :image="item.image"
          :title="item.title"
          :price="item.price"
          :category="item.category"
          :condition="item.condition"
          :seller="item.seller"
          @click="onCardClick"
        />
      </div>
      <div v-else class="home-empty">
        <t-icon name="inbox" size="80px" style="color: #ddd" />
        <span class="home-empty__text">这个分类下暂无商品~</span>
      </div>
    </div>

    <!-- 浮动发布按钮 -->
    <div class="home-release">
      <t-button theme="primary" size="large" shape="round" @click="goRelease">
        <template #icon><t-icon name="add" /></template>
        发布
      </t-button>
    </div>
  </div>
</template>

<style scoped>
.home-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: #f5f5f5;
}

.home-search {
  padding: 12px 16px;
  background: #fff;
  position: sticky;
  top: 0;
  z-index: 10;
}

.home-search__bar {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 16px;
  background: #f5f5f5;
  border-radius: 20px;
  cursor: pointer;
}

.home-search__text {
  font-size: 14px;
  color: #999;
}

.home-categories {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  overflow-x: auto;
  white-space: nowrap;
  -webkit-overflow-scrolling: touch;
}

.home-categories::-webkit-scrollbar {
  display: none;
}

.home-category {
  flex-shrink: 0;
  padding: 6px 18px;
  font-size: 13px;
  color: #666;
  background: #f5f5f5;
  border-radius: 20px;
  transition: all 0.2s;
  cursor: pointer;
  user-select: none;
}

.home-category--active {
  color: #fff;
  background: #0052d9;
}

.home-content {
  flex: 1;
  padding: 12px 16px;
}

.home-card-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 16px;
  justify-content: space-between;
}

.home-loading {
  display: flex;
  justify-content: center;
  padding-top: 120px;
}

.home-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 120px;
  gap: 16px;
}

.home-empty__text {
  font-size: 14px;
  color: #bbb;
}

.home-release {
  position: fixed;
  bottom: 80px;
  right: calc(50% - 580px);
  z-index: 50;
}

@media (max-width: 1240px) {
  .home-release {
    right: 20px;
  }
}
</style>
