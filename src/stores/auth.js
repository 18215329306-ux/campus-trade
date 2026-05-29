import { ref } from 'vue'
import { supabase } from '../supabase'

export const user = ref(null)
export const skipped = ref(false)
export const authReady = ref(false)

export async function initAuth() {
  const saved = localStorage.getItem('campus_user')
  if (saved) {
    try { user.value = JSON.parse(saved) } catch {}
  }
  skipped.value = localStorage.getItem('campus_skipped') === '1'
  // 从数据库获取最新信誉分
  if (user.value) {
    try {
      const { supabase } = await import('../supabase')
      const { data } = await supabase.from('users').select('reputation').eq('id', user.value.id).single()
      if (data) user.value.reputation = data.reputation
    } catch {}
  }
  authReady.value = true
}

export function skipLogin() {
  skipped.value = true
  localStorage.setItem('campus_skipped', '1')
}

async function hashPassword(password) {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + 'campus_salt')
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// 注册
export async function signUp(username, password, school, name, phone) {
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .single()

  if (existing) return { error: { message: '账号已存在' } }

  const { data: existingName } = await supabase
    .from('users')
    .select('id')
    .eq('name', name)
    .single()

  if (existingName) return { error: { message: '用户名已被使用' } }

  const { count: phoneCount } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('phone', phone)

  if (phoneCount >= 3) return { error: { message: '该手机号已注册超过3个账号' } }

  const passwordHash = await hashPassword(password)
  const { data, error } = await supabase
    .from('users')
    .insert({ username, password_hash: passwordHash, school, name, phone })
    .select('id, username, school, name, phone, role, banned, created_at')
    .single()

  if (error) return { error }

  user.value = data
  skipped.value = false
  localStorage.setItem('campus_user', JSON.stringify(data))
  localStorage.removeItem('campus_skipped')
  // 默认关注自己
  await supabase.from('follows').insert({ follower_id: data.id, following_id: data.id })
  return { data }
}

// 登录（区分不存在、被封禁、密码错误）
export async function signIn(username, password) {
  // 先查用户是否存在
  const { data: existUser } = await supabase
    .from('users')
    .select('id, username, school, name, phone, role, banned, created_at')
    .eq('username', username)
    .single()

  if (!existUser) return { error: { message: '账号不存在，请先注册', code: 'not_found' } }
  if (existUser.banned) return { error: { message: '账号因违规已被封禁', code: 'banned' } }

  // 再验证密码
  const passwordHash = await hashPassword(password)
  if (passwordHash !== await getStoredHash(username)) {
    return { error: { message: '密码错误', code: 'wrong_password' } }
  }

  user.value = existUser
  skipped.value = false
  localStorage.setItem('campus_user', JSON.stringify(existUser))
  localStorage.removeItem('campus_skipped')
  return { data: existUser }
}

// 获取存储的密码哈希
async function getStoredHash(username) {
  const { data } = await supabase
    .from('users')
    .select('password_hash')
    .eq('username', username)
    .single()
  return data?.password_hash || ''
}

// 验证手机号（用于找回密码）
export async function verifyPhone(username, phone) {
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .eq('phone', phone)
    .single()
  return !!data
}

// 验证当前密码
export async function verifyPassword(username, password) {
  const passwordHash = await hashPassword(password)
  const storedHash = await getStoredHash(username)
  return passwordHash === storedHash
}

// 验证用户名
export async function verifyName(username, name) {
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .eq('name', name)
    .single()
  return !!data
}

// 重置密码
export async function resetPassword(username, phone, newPassword) {
  const valid = await verifyPhone(username, phone)
  if (!valid) return { error: { message: '账号与手机号不匹配' } }

  const passwordHash = await hashPassword(newPassword)
  const { error } = await supabase
    .from('users')
    .update({ password_hash: passwordHash })
    .eq('username', username)

  if (error) return { error }
  return { success: true }
}

window.addEventListener('storage', (e) => {
  if (e.key === 'campus_user') {
    if (e.newValue) {
      try { user.value = JSON.parse(e.newValue) } catch {}
    } else {
      user.value = null
    }
  }
})

export function signOut() {
  user.value = null
  skipped.value = false
  localStorage.removeItem('campus_user')
  localStorage.removeItem('campus_skipped')
}
