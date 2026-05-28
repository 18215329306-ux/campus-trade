<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import { supabase } from '../supabase'

const router = useRouter()

const title = ref('')
const price = ref('')
const description = ref('')
const contact = ref('')
const uploadFiles = ref([])
const publishing = ref(false)

const categories = ['书籍', '电子', '生活', '衣物', '其他']
const categoryIndex = ref(0)

const conditions = ['全新', '九成新', '八成新', '七成新', '六成新及以下']
const conditionIndex = ref(1)

const campuses = ['北校区', '南校区', '东校区', '西校区']
const campusIndex = ref(0)

function handleUploadChange(files) {
  uploadFiles.value = files
}

async function uploadImage(file) {
  // file.raw 是 TDesign Upload 组件的原始 File 对象
  const rawFile = file.raw || file
  const fileName = `${Date.now()}_${rawFile.name || 'image.jpg'}`
  const { data, error } = await supabase.storage
    .from('goods-images')
    .upload(fileName, rawFile)

  if (error) throw error

  const { data: urlData } = supabase.storage
    .from('goods-images')
    .getPublicUrl(data.path)

  return urlData.publicUrl
}

async function publish() {
  if (!title.value.trim()) {
    MessagePlugin.warning('请输入商品标题')
    return
  }
  if (!description.value.trim()) {
    MessagePlugin.warning('请输入商品描述')
    return
  }
  if (!contact.value.trim()) {
    MessagePlugin.warning('请填写联系方式')
    return
  }

  publishing.value = true

  try {
    // 先上传图片
    let imageUrl = '/images/card0.png' // 默认图
    if (uploadFiles.value.length > 0) {
      imageUrl = await uploadImage(uploadFiles.value[0])
    }

    // 写入数据库
    const { error } = await supabase.from('goods').insert({
      title: title.value.trim(),
      price: Number(price.value) || null,
      category: categories[categoryIndex.value],
      condition: conditions[conditionIndex.value],
      description: description.value.trim(),
      contact: contact.value.trim(),
      campus: campuses[campusIndex.value],
      image: imageUrl,
    })

    if (error) throw error

    MessagePlugin.success('发布成功')
    setTimeout(() => {
      router.push('/')
    }, 1200)
  } catch (e) {
    MessagePlugin.warning('发布失败，请重试')
    console.error(e)
  } finally {
    publishing.value = false
  }
}

function onCancel() {
  router.back()
}
</script>

<template>
  <div class="release-page">
    <!-- 顶部导航 -->
    <div class="release-header">
      <t-button variant="text" @click="onCancel">取消</t-button>
      <span class="release-header__title">发布二手商品</span>
      <div style="width: 60px"></div>
    </div>

    <div class="release-form">
      <!-- 商品图片 -->
      <div class="form-section">
        <div class="form-label">商品图片（最多4张）</div>
        <t-upload
          v-model="uploadFiles"
          accept="image/*"
          :max="4"
          multiple
          theme="image"
          @change="handleUploadChange"
        />
      </div>

      <!-- 商品标题 -->
      <div class="form-section">
        <div class="form-label">商品标题</div>
        <t-input
          v-model="title"
          placeholder="如：高等数学第七版 上下册"
          maxlength="30"
          clearable
        />
      </div>

      <!-- 价格 -->
      <div class="form-section">
        <div class="form-label">价格（元）</div>
        <t-input
          v-model="price"
          type="number"
          placeholder="输入价格，可面议可不填"
          clearable
        />
      </div>

      <!-- 分类 -->
      <div class="form-section">
        <div class="form-label">商品分类</div>
        <div class="tag-row">
          <t-check-tag
            v-for="(cat, index) in categories"
            :key="cat"
            :checked="categoryIndex === index"
            size="medium"
            variant="dark"
            @click="categoryIndex = index"
          >
            {{ cat }}
          </t-check-tag>
        </div>
      </div>

      <!-- 成色 -->
      <div class="form-section">
        <div class="form-label">成色</div>
        <div class="tag-row">
          <t-check-tag
            v-for="(cond, index) in conditions"
            :key="cond"
            :checked="conditionIndex === index"
            size="medium"
            variant="dark"
            @click="conditionIndex = index"
          >
            {{ cond }}
          </t-check-tag>
        </div>
      </div>

      <!-- 商品描述 -->
      <div class="form-section">
        <div class="form-label">商品描述</div>
        <t-textarea
          v-model="description"
          placeholder="描述一下商品的具体情况，比如购买时间、使用频率、有无瑕疵等"
          maxlength="500"
          :autosize="{ minRows: 4, maxRows: 8 }"
        />
      </div>

      <!-- 联系方式 -->
      <div class="form-section">
        <div class="form-label">联系方式</div>
        <t-input
          v-model="contact"
          placeholder="QQ号或微信号，方便买家联系你"
          maxlength="50"
          clearable
        />
      </div>

      <!-- 所在校区 -->
      <div class="form-section">
        <div class="form-label">所在校区</div>
        <div class="tag-row">
          <t-check-tag
            v-for="(camp, index) in campuses"
            :key="camp"
            :checked="campusIndex === index"
            size="medium"
            variant="dark"
            @click="campusIndex = index"
          >
            {{ camp }}
          </t-check-tag>
        </div>
      </div>

      <!-- 发布按钮 -->
      <div class="form-submit">
        <t-button theme="primary" size="large" block :loading="publishing" @click="publish">发布商品</t-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.release-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 80px;
}

.release-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #fff;
  position: sticky;
  top: 0;
  z-index: 10;
  border-bottom: 1px solid #f0f0f0;
}

.release-header__title {
  font-size: 17px;
  font-weight: 600;
  color: #333;
}

.release-form {
  padding: 16px;
}

.form-section {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
}

.form-label {
  font-size: 15px;
  font-weight: 500;
  color: #333;
  margin-bottom: 12px;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.form-submit {
  margin-top: 24px;
}
</style>
