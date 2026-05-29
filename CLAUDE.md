# campus-trade-web

校园二手物品信息平台 — 网页版

## 技术栈

- **框架**: Vue 3 (Composition API, `<script setup>`)
- **构建工具**: Vite 8
- **UI 组件库**: TDesign Vue Next
- **后端服务**: Supabase (数据库 + Storage)
- **路由**: Vue Router 4 (history 模式)
- **认证**: 自定义账号密码 + SHA-256 加盐哈希，localStorage 持久化

## 项目结构

```
src/
├── main.js              # 入口：挂载 TDesign、Router
├── App.vue              # 根组件：底部导航栏 + 响应式外壳
├── style.css            # 全局样式
├── supabase.js          # Supabase 客户端初始化
├── router/index.js      # 路由配置 + 全局守卫
├── stores/auth.js       # 认证状态 + 登录/注册/找回密码逻辑
├── components/
│   └── ProductCard.vue  # 商品卡片组件
├── views/
│   ├── Home.vue         # 首页：商品列表 + 下拉刷新
│   ├── Search.vue       # 搜索页：模糊匹配 + 多字段筛选
│   ├── Detail.vue       # 详情页：图片滑动/全屏、举报、管理操作
│   ├── Release.vue      # 发布页：多图上传、全字段必填
│   ├── Login.vue        # 登录页：跳过登录、找回密码入口
│   ├── Register.vue     # 注册页：账号/密码/学校/姓名/手机号
│   ├── My.vue           # 我的页面：商品管理、成交确认、系统消息
│   └── Admin.vue        # 管理员后台：商品/用户管理、封禁、举报处理
└── mock/
    └── cardsData.js     # 静态 mock 数据
```

## 路由表

| 路径 | 页面 | 需登录 |
|------|------|--------|
| `/` | Home | 否（未登录可跳过） |
| `/search` | Search | 是 |
| `/detail/:id` | Detail | 是 |
| `/release` | Release | 是 |
| `/login` | Login | 否 |
| `/register` | Register | 否 |
| `/my` | My | 是 |
| `/admin` | Admin | 是 |

## 路由守卫逻辑

1. 首次访问首页 `/` → 未登录且没跳过 → 跳转 `/login`
2. `requiresAuth` 页面未登录 → 跳转 `/login`（带 redirect 参数）
3. 登录/注册后自动恢复原始跳转路径

## 响应式布局

- `< 768px`：最大宽度 480px（手机）
- `768px ~ 1200px`：最大宽度 960px（平板）
- `≥ 1200px`：最大宽度 1120px（桌面）

## Supabase

- **项目 URL**: `https://dgdoyadynfemnjurwvzx.supabase.co`
- **表**: `users` (id, username, password_hash, school, name, phone, role, banned)
- **Storage**: 商品图片上传到 Supabase Storage

## 认证流程

- 密码存储：SHA-256(password + 'campus_salt') 哈希
- 用户数据存 localStorage key: `campus_user`
- 跳过登录标记 key: `campus_skipped`
- 支持多标签页同步登录状态 (`storage` 事件监听)

## 运行命令

```bash
npm run dev      # 启动开发服务器
npm run build    # 生产构建
npm run preview  # 预览构建产物
```
