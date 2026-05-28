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
const imageFiles = ref([])
const imagePreviews = ref([])
const publishing = ref(false)

const categories = ['书籍', '电子', '生活', '衣物', '其他']
const categoryIndex = ref(0)

const conditions = ['全新', '九成新', '八成新', '七成新', '六成新及以下']
const conditionIndex = ref(1)

const campuses = ['北校区', '南校区', '东校区', '西校区']
const campusIndex = ref(0)

// 文件选择
function onFileChange(e) {
  const files = Array.from(e.target.files)
  if (files.length === 0) return

  // 最多 4 张
  const newFiles = [...imageFiles.value, ...files].slice(0, 4)
  imageFiles.value = newFiles
  // 生成预览 URL
  imagePreviews.value = newFiles.map(f => URL.createObjectURL(f))
  // 重置 input，确保重复选同一文件也能触发
  e.target.value = ''
}

// 删除某张图片
function removeImage(index) {
  URL.revokeObjectURL(imagePreviews.value[index])
  imageFiles.value.splice(index, 1)
  imagePreviews.value.splice(index, 1)
}

// 上传单张图片到 Supabase Storage
async function uploadImage(file) {
  const ext = file.name.split('.').pop() || 'jpg'
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
  console.log('开始上传:', fileName, '大小:', file.size)
  const { data, error } = await supabase.storage
    .from('goods-images')
    .upload(fileName, file)

  if (error) {
    console.error('上传失败:', error)
    throw error
  }
  console.log('上传成功:', data.path)

  const { data: urlData } = supabase.storage
    .from('goods-images')
    .getPublicUrl(data.path)

  console.log('公开链接:', urlData.publicUrl)
  return urlData.publicUrl
}

async function publish() {
  if (imageFiles.value.length === 0) {
    MessagePlugin.warning('请上传至少一张商品图片')
    return
  }
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
    // 逐张上传图片（避免并发导致卡死）
    const uploadedUrls = []
    for (let i = 0; i < imageFiles.value.length; i++) {
      const url = await uploadImage(imageFiles.value[i])
      uploadedUrls.push(url)
    }

    // 写入数据库（所有图片 URL 用逗号拼接存储）
    const { error } = await supabase.from('goods').insert({
      title: title.value.trim(),
      price: Number(price.value) || null,
      category: categories[categoryIndex.value],
      condition: conditions[conditionIndex.value],
      description: description.value.trim(),
      contact: contact.value.trim(),
      campus: campuses[campusIndex.value],
      image: uploadedUrls.join(','),
    })

    if (error) throw error

    // 清理预览 URL
    imagePreviews.value.forEach(url => URL.revokeObjectURL(url))
    imageFiles.value = []
    imagePreviews.value = []

    MessagePlugin.success('发布成功')
    setTimeout(() => {
      router.push('/')
    }, 1200)
  } catch (e) {
    console.error('发布失败详情:', e)
    MessagePlugin.warning('发布失败：' + (e.message || '请重试'))
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
        <div class="form-label">
          商品图片（至少1张，最多4张）
          <span class="form-required">*</span>
        </div>
        <div class="image-upload-area">
          <!-- 已选图片预览 -->
          <div
            v-for="(preview, index) in imagePreviews"
            :key="index"
            class="image-preview-item"
          >
            <img :src="preview" class="image-preview-img" />
            <div class="image-preview-remove" @click="removeImage(index)">×</div>
          </div>
          <!-- 添加按钮 -->
          <label v-if="imageFiles.length < 4" class="image-add-btn">
            <input
              type="file"
              accept="image/*"
              multiple
              class="image-input-hidden"
              @change="onFileChange"
            />
            <t-icon name="add" size="32px" style="color: #ccc" />
            <span class="image-add-text">{{ imageFiles.length === 0 ? '上传图片' : '' }}</span>
          </label>
        </div>
      </div>

      <!-- 商品标题 -->
      <div class="form-section">
        <div class="form-label">商品标题 <span class="form-required">*</span></div>
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
        <div class="form-label">商品描述 <span class="form-required">*</span></div>
        <t-textarea
          v-model="description"
          placeholder="描述一下商品的具体情况，比如购买时间、使用频率、有无瑕疵等"
          maxlength="500"
          :autosize="{ minRows: 4, maxRows: 8 }"
        />
      </div>

      <!-- 联系方式 -->
      <div class="form-section">
        <div class="form-label">联系方式 <span class="form-required">*</span></div>
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

.form-required {
  color: #e34d59;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.form-submit {
  margin-top: 24px;
}

/* 图片上传区域 */
.image-upload-area {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.image-preview-item {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #eee;
}

.image-preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-preview-remove {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 20px;
  height: 20px;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  cursor: pointer;
  line-height: 1;
}

.image-add-btn {
  width: 80px;
  height: 80px;
  border: 1px dashed #ddd;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  gap: 4px;
  background: #fafafa;
  transition: border-color 0.2s;
}

.image-add-btn:hover {
  border-color: #0052d9;
}

.image-input-hidden {
  display: none;
}

.image-add-text {
  font-size: 12px;
  color: #bbb;
}
</style>
