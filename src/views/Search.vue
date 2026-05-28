<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../supabase'
import ProductCard from '../components/ProductCard.vue'

const router = useRouter()

const searchValue = ref('')
const isSearching = ref(false)
const searchResults = ref([])
const historyWords = ref([])
const popularWords = ref(['高等数学', 'iPad', '键盘', '考研', '台灯', '吉他', '篮球', '充电宝'])

async function doSearch(keyword) {
  if (!keyword || !keyword.trim()) return

  const kw = keyword.trim()
  const { data: results } = await supabase
    .from('goods')
    .select('*')
    .or(`title.ilike.%${kw}%,description.ilike.%${kw}%,category.ilike.%${kw}%,seller.ilike.%${kw}%,campus.ilike.%${kw}%`)

  searchValue.value = keyword
  isSearching.value = true
  searchResults.value = results || []
  addHistory(keyword)
}

function addHistory(keyword) {
  const idx = historyWords.value.indexOf(keyword)
  if (idx !== -1) historyWords.value.splice(idx, 1)
  historyWords.value.unshift(keyword)
  if (historyWords.value.length > 10) historyWords.value.pop()
}

function onSearchChange(value) {
  searchValue.value = value
}

function handleSubmit(e) {
  const value = e.detail?.value || searchValue.value
  if (!value || value.length === 0) return
  doSearch(value)
}

function handleTagTap(value) {
  doSearch(value)
}

function onClear() {
  isSearching.value = false
  searchValue.value = ''
  searchResults.value = []
}

function onCancel() {
  router.push('/')
}

function handleClearHistory() {
  historyWords.value = []
}

function onCardClick(id) {
  router.push(`/detail/${id}`)
}
</script>

<template>
  <div class="search-page">
    <!-- 搜索栏 -->
    <div class="search-header">
      <t-input
        v-model="searchValue"
        placeholder="搜商品、分类、描述..."
        clearable
        @enter="handleSubmit"
        @clear="onClear"
      >
        <template #prefix-icon><t-icon name="search" /></template>
      </t-input>
      <t-button variant="text" @click="onCancel">取消</t-button>
    </div>

    <!-- 搜索结果 -->
    <div v-if="isSearching" class="search-results">
      <div v-if="searchResults.length > 0" class="search-card-list">
        <ProductCard
          v-for="item in searchResults"
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
      <div v-else class="search-empty">
        <t-icon name="search" size="80px" style="color: #ddd" />
        <span class="search-empty__text">没有找到相关商品</span>
        <span class="search-empty__hint">换个关键词试试吧~</span>
      </div>
    </div>

    <!-- 搜索发现 & 历史记录 -->
    <div v-else class="search-wrap">
      <div v-if="historyWords.length > 0" class="search-section">
        <div class="search-section__header">
          <span class="search-section__title">历史记录</span>
          <t-icon
            name="delete"
            size="20px"
            style="color: #ccc; cursor: pointer"
            @click="handleClearHistory"
          />
        </div>
        <div class="search-tags">
          <t-tag
            v-for="word in historyWords"
            :key="word"
            variant="light"
            class="search-tag"
            @click="handleTagTap(word)"
          >
            {{ word }}
          </t-tag>
        </div>
      </div>

      <div class="search-section">
        <div class="search-section__header">
          <span class="search-section__title">搜索发现</span>
        </div>
        <div class="search-tags">
          <t-tag
            v-for="word in popularWords"
            :key="word"
            variant="light"
            class="search-tag"
            icon="search"
            @click="handleTagTap(word)"
          >
            {{ word }}
          </t-tag>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-page {
  min-height: 100vh;
  background: #fff;
}

.search-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  position: sticky;
  top: 0;
  background: #fff;
  z-index: 10;
}

.search-header :deep(.t-input) {
  flex: 1;
}

.search-results {
  padding: 12px 16px;
}

.search-card-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px 16px;
}

.search-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 120px;
  gap: 8px;
}

.search-empty__text {
  font-size: 16px;
  color: #999;
}

.search-empty__hint {
  font-size: 13px;
  color: #ccc;
}

.search-wrap {
  padding: 20px 16px;
}

.search-section {
  margin-bottom: 24px;
}

.search-section__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.search-section__title {
  font-size: 15px;
  font-weight: 500;
  color: #333;
}

.search-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.search-tag {
  cursor: pointer;
}
</style>
