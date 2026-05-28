<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import { supabase } from '../supabase'
import { user, initAuth } from '../stores/auth'

const router = useRouter()

const title = ref('')
const price = ref('')
const description = ref('')
const imageFiles = ref([])
const imagePreviews = ref([])
const publishing = ref(false)

// 联系方式子项
const contactWechat = ref('')
const contactQQ = ref('')
const contactPhone = ref('')
const contactOtherType = ref('')
const contactOtherValue = ref('')

const categories = ['书籍', '电子', '生活', '衣物', '其他']
const categoryIndex = ref(0)

const conditions = ['全新', '九成新', '八成新', '七成新', '六成新及以下']
const conditionIndex = ref(1)

const campuses = ['北校区', '南校区', '东校区', '西校区']
const campusIndex = ref(0)

// 价格输入校验：>=0，最多两位小数
function onPriceChange(val) {
  // 移除非数字和小数点
  let v = val.replace(/[^\d.]/g, '')
  // 去掉多余小数点
  const parts = v.split('.')
  if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('')
  // 限制两位小数
  if (parts.length === 2 && parts[1].length > 2) {
    v = parts[0] + '.' + parts[1].slice(0, 2)
  }
  price.value = v
}

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
  await initAuth()
  if (!user.value) {
    MessagePlugin.warning('请先登录后再发布')
    router.push('/login')
    return
  }
  if (imageFiles.value.length === 0) {
    MessagePlugin.warning('请上传至少一张商品图片')
    return
  }
  if (!title.value.trim()) {
    MessagePlugin.warning('请输入商品标题')
    return
  }
  if (!price.value.trim()) {
    MessagePlugin.warning('请输入价格')
    return
  }
  if (Number(price.value) < 0) {
    MessagePlugin.warning('价格不能为负数')
    return
  }
  if (!description.value.trim()) {
    MessagePlugin.warning('请输入商品描述')
    return
  }
  // 联系方式至少填一项
  if (!contactWechat.value.trim() && !contactQQ.value.trim() && !contactPhone.value.trim() && !contactOtherValue.value.trim()) {
    MessagePlugin.warning('请至少填写一种联系方式')
    return
  }
  // 其他方式如果填了值，类型也必须填
  if (contactOtherValue.value.trim() && !contactOtherType.value.trim()) {
    MessagePlugin.warning('请填写"其他"联系方式的类型（如：微博、钉钉等）')
    return
  }

  // 拼接联系方式
  const contacts = []
  if (contactWechat.value.trim()) contacts.push('微信：' + contactWechat.value.trim())
  if (contactQQ.value.trim()) contacts.push('QQ：' + contactQQ.value.trim())
  if (contactPhone.value.trim()) contacts.push('电话：' + contactPhone.value.trim())
  if (contactOtherValue.value.trim()) contacts.push(contactOtherType.value.trim() + '：' + contactOtherValue.value.trim())
  const contactStr = contacts.join('\n')

  publishing.value = true

  try {
    // 逐张上传图片（避免并发导致卡死）
    const uploadedUrls = []
    for (let i = 0; i < imageFiles.value.length; i++) {
      const url = await uploadImage(imageFiles.value[i])
      uploadedUrls.push(url)
    }

    // 写入数据库
    const { error } = await supabase.from('goods').insert({
      title: title.value.trim(),
      price: price.value ? Number(price.value) : null,
      category: categories[categoryIndex.value],
      condition: conditions[conditionIndex.value],
      description: description.value.trim(),
      contact: contactStr,
      campus: campuses[campusIndex.value],
      seller: user.value.name,
      image: uploadedUrls.join(','),
      user_id: user.value.id,
      status: 'published',
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
        <div class="form-label">价格（元） <span class="form-required">*</span></div>
        <t-input
          :value="price"
          placeholder="输入价格（>=0，最多两位小数）"
          clearable
          @change="onPriceChange"
        />
      </div>

      <!-- 分类 -->
      <div class="form-section">
        <div class="form-label">商品分类 <span class="form-required">*</span></div>
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
        <div class="form-label">成色 <span class="form-required">*</span></div>
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
        <div class="form-label">联系方式（至少填一项） <span class="form-required">*</span></div>
        <div class="contact-grid">
          <t-input v-model="contactWechat" placeholder="微信号" maxlength="50" clearable>
            <template #prefix-icon><span class="contact-prefix">微信</span></template>
          </t-input>
          <t-input v-model="contactQQ" placeholder="QQ号" maxlength="50" clearable>
            <template #prefix-icon><span class="contact-prefix">QQ</span></template>
          </t-input>
          <t-input v-model="contactPhone" placeholder="手机号" maxlength="50" clearable>
            <template #prefix-icon><span class="contact-prefix">电话</span></template>
          </t-input>
          <div class="contact-other-row">
            <t-input v-model="contactOtherType" placeholder="类型（如微博、钉钉）" maxlength="20" class="contact-other-type" />
            <t-input v-model="contactOtherValue" placeholder="账号" maxlength="50" class="contact-other-value" />
          </div>
        </div>
      </div>

      <!-- 所在校区 -->
      <div class="form-section">
        <div class="form-label">所在校区 <span class="form-required">*</span></div>
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

.contact-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.contact-prefix {
  font-size: 13px;
  color: #999;
  margin-right: 4px;
}

.contact-other-row {
  display: flex;
  gap: 8px;
}

.contact-other-type {
  width: 130px;
  flex-shrink: 0;
}

.contact-other-value {
  flex: 1;
}
</style>
