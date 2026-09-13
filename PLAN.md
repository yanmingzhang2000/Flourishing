# 女生居家局部塑形健身平台

## 项目定位

面向女生新手、居家轻器械，主打「局部塑形目标」。

> 核心价值：输入个人信息 + 装备 + 目标 → 自动生成训练计划 → 训练跟练 → 反馈调整

---

## 一、已完成：本地版本 V1

### 文件位置
`桌面/拜拜肉训练/index.html` - 双击即可使用，无需服务器

### 技术实现
- React + TypeScript + TailwindCSS
- 本地 localStorage 存储
- 单 HTML 文件打包

### 功能清单

| 页面 | 功能 | 状态 |
|------|------|------|
| 信息录入页 | 4步表单：身高体重→经验→器械→训练安排 | ✅ |
| 打卡日历页 | 周视图，训练类型标记，统计卡片 | ✅ |
| 当日训练页 | 三栏布局：热身/训练/拉伸 | ✅ |
| 动作详情页 | 三栏布局，视频/图片切换，计时器 | ✅ |
| 训练反馈 | 太轻松/刚好/太难，关节不适勾选 | ✅ |
| 渐进调整 | 根据反馈自动调整下一周计划 | ✅ |

### 动作库（5个动作）

| 动作 | 目标肌群 | 装备 |
|------|----------|------|
| 颈后哑铃臂屈伸 | 肱三头肌长头 | 哑铃 |
| 俯身哑铃臂屈伸 | 肱三头肌外侧头 | 哑铃 |
| 哑铃侧平举 | 三角肌中束 | 哑铃 |
| 站姿哑铃弯举 | 肱二头肌 | 哑铃 |
| 单臂哑铃划船 | 背阔肌 | 哑铃 |

---

## 二、规划中：网站版本 V2

### 核心差异

| 对比项 | V1 本地版 | V2 网站版 |
|--------|-----------|-----------|
| 数据存储 | 浏览器 localStorage | 服务器数据库 |
| 用户系统 | 无 | 注册/登录/游客 |
| 设备同步 | 不支持 | 支持 |
| 项目数量 | 1个（拜拜肉） | 6个项目 |
| 计划生成 | 硬编码规则 | 规则引擎 + LLM |
| 部署方式 | 单HTML文件 | 前后端分离 |

### 目标用户
- 女生新手
- 居家/办公室场景
- 轻器械（哑铃/弹力带）或自重
- 局部塑形需求（不是全身减脂/增肌）

---

## 三、6个核心项目

### 项目列表

| 项目名称 | 解决问题 | 目标部位 | 难度 | 时长 |
|----------|----------|----------|------|------|
| 拜拜肉收紧 | 瘦大臂 | 手臂 | ⭐ | 15min |
| 假胯宽改善 | 瘦腿提臀 | 臀腿 | ⭐⭐ | 20min |
| 下腹收紧 | 瘦小肚子，缓解久坐 | 腹部 | ⭐ | 15min |
| 斜方肌放松 | 瘦肩颈，缓解酸痛 | 肩颈 | ⭐ | 10min |
| 圆肩改善 | 挺拔体态，显瘦 | 背部 | ⭐ | 15min |
| 居家基础体能 | 入门全身训练 | 全身 | ⭐⭐ | 25min |

### 用户选择逻辑
1. 用户填写信息（身高体重+伤病+装备+目标）
2. 系统推荐匹配的项目
3. 用户可自定义：添加/删除/排序
4. 生成个性化周训练计划

---

## 四、用户系统设计

### 登录注册
- 邮箱 + 密码注册
- 游客模式（数据存本地）
- 后续扩展：微信/手机号登录

### 用户信息页（3个Tab）

#### Tab 1：基础信息（必填）
| 字段 | 类型 | 说明 |
|------|------|------|
| 身高 | number | cm |
| 体重 | number | kg |
| BMI | 自动计算 | |
| 训练经验 | 选择 | 零基础/偶尔练/经常练 |
| 伤病情况 | 多选 | 肩/肘/腕/腰/膝 |

#### Tab 2：详细数据（非必填）
| 字段 | 类型 | 说明 |
|------|------|------|
| 年龄 | number | |
| 体脂率 | number | % |
| 腰围 | number | cm |
| 臂围 | number | cm |
| 每周可训练天数 | 选择 | 2/3/4/5天 |
| 单次最长时长 | 选择 | 20/30/45分钟 |
| 备注 | 文本 | |

#### Tab 3：目标和装备
| 字段 | 类型 | 说明 |
|------|------|------|
| 训练目标 | 多选 | 拜拜肉/假胯宽/下腹等 |
| 可用装备 | 多选 | 自重/哑铃/弹力带等 |

---

## 五、技术架构

### 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React + TypeScript + TailwindCSS + shadcn/ui |
| 后端 | Node.js + Express 或 Hono |
| 数据库 | SQLite（MVP）→ PostgreSQL（生产） |
| 认证 | JWT |
| LLM | OpenAI API |
| 部署 | Vercel（前端）+ Railway（后端） |

### 系统架构图

```
┌─────────────────────────────────────────────────────────┐
│                      前端 (React)                       │
├─────────────────────────────────────────────────────────┤
│  登录注册 │ 用户信息 │ 项目选择 │ 训练计划 │ 跟练打卡  │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                   后端 API (Express)                    │
├─────────────────────────────────────────────────────────┤
│  认证模块 │ 用户模块 │ 项目模块 │ 计划模块 │ 记录模块  │
└─────────────────────────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │  SQLite  │    │  动作库  │    │ OpenAI   │
    │ 数据库   │    │  JSON    │    │   API    │
    └──────────┘    └──────────┘    └──────────┘
```

---

## 六、数据库设计

### 表结构

```sql
-- 用户表
users (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)

-- 用户档案（基础信息）
user_profiles (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  height REAL,
  weight REAL,
  bmi REAL,
  experience TEXT,  -- zero/occasional/regular
  injuries TEXT,    -- JSON数组: ["shoulder", "elbow"]
  created_at DATETIME,
  updated_at DATETIME
)

-- 用户详细数据
user_details (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  age INTEGER,
  body_fat REAL,
  waist REAL,
  arm_circumference REAL,
  max_days_per_week INTEGER,
  max_session_minutes INTEGER,
  notes TEXT,
  created_at DATETIME
)

-- 目标和装备
user_goals (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  goals TEXT,       -- JSON数组: ["tricep_tone", "hip_width"]
  equipment TEXT,   -- JSON数组: ["dumbbell_1.5kg", "resistance_band"]
  created_at DATETIME
)

-- 项目库
projects (
  id TEXT PRIMARY KEY,  -- tricep_tone, hip_width, etc.
  name TEXT NOT NULL,
  subtitle TEXT,        -- 瘦大臂、瘦腿提臀等
  target_area TEXT,
  description TEXT,
  difficulty TEXT,      -- beginner/intermediate
  duration_minutes INTEGER,
  equipment_needed TEXT, -- JSON数组
  created_at DATETIME
)

-- 动作库
exercises (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  name TEXT NOT NULL,
  category TEXT,        -- warmup/strength/cooldown
  primary_muscle TEXT,
  equipment TEXT,       -- JSON数组
  difficulty TEXT,
  sets INTEGER,
  reps INTEGER,
  rest_seconds INTEGER,
  rhythm TEXT,
  description TEXT,
  steps TEXT,           -- JSON数组
  tips TEXT,
  warning TEXT,
  video_url TEXT,
  image_url TEXT
)

-- 用户选定的项目
user_projects (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  project_id TEXT REFERENCES projects(id),
  status TEXT DEFAULT 'active',  -- active/paused/completed
  start_date DATE,
  created_at DATETIME
)

-- 周训练计划
weekly_plans (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  project_id TEXT REFERENCES projects(id),
  week_number INTEGER,
  start_date DATE,
  days TEXT,  -- JSON: 完整的周计划结构
  created_at DATETIME
)

-- 训练打卡记录
training_records (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  plan_id INTEGER REFERENCES weekly_plans(id),
  date DATE,
  day_index INTEGER,
  completed BOOLEAN DEFAULT FALSE,
  feedback TEXT,  -- too_easy/just_right/too_hard
  has_joint_pain BOOLEAN DEFAULT FALSE,
  completed_exercises TEXT, -- JSON数组
  created_at DATETIME
)
```

---

## 七、API 接口设计

### 认证相关
```
POST   /api/auth/register        - 注册
POST   /api/auth/login           - 登录
POST   /api/auth/guest           - 游客模式
```

### 用户相关
```
GET    /api/user/profile         - 获取用户档案
PUT    /api/user/profile         - 更新用户档案
GET    /api/user/details         - 获取详细数据
PUT    /api/user/details         - 更新详细数据
GET    /api/user/goals           - 获取目标装备
PUT    /api/user/goals           - 更新目标装备
```

### 项目相关
```
GET    /api/projects             - 获取所有项目
GET    /api/projects/:id         - 获取项目详情
GET    /api/projects/:id/exercises - 获取项目动作
```

### 用户项目
```
GET    /api/user/projects        - 获取用户选定项目
POST   /api/user/projects        - 选择项目
DELETE /api/user/projects/:id    - 移除项目
PUT    /api/user/projects/:id    - 更新项目状态
```

### 训练计划
```
POST   /api/plans/generate       - 生成周计划
GET    /api/plans/:id            - 获取计划详情
GET    /api/plans/current        - 获取当前周计划
```

### 训练记录
```
POST   /api/records              - 提交训练记录
GET    /api/records              - 获取训练记录
GET    /api/records/stats        - 获取统计数据
```

---

## 八、开发排期

### 阶段1：后端基础（3天）
- [ ] Express 项目搭建
- [ ] SQLite 数据库初始化
- [ ] 用户注册/登录 API
- [ ] JWT 认证中间件

### 阶段2：项目/动作库（2天）
- [ ] 6个项目数据录入
- [ ] 每个项目5-8个动作
- [ ] 热身/拉伸动作库
- [ ] 项目查询 API

### 阶段3：核心API（3天）
- [ ] 用户档案 CRUD
- [ ] 用户项目选择
- [ ] 训练计划生成引擎
- [ ] 训练记录 API

### 阶段4：前端-登录注册（2天）
- [ ] 登录页
- [ ] 注册页
- [ ] 游客模式入口

### 阶段5：前端-用户信息页（3天）
- [ ] 3个Tab组件
- [ ] 基础信息表单
- [ ] 详细数据表单
- [ ] 目标装备选择

### 阶段6：前端-项目选择（2天）
- [ ] 项目卡片列表
- [ ] 项目详情预览
- [ ] 添加/删除/排序

### 阶段7：前端-训练计划（3天）
- [ ] 打卡日历（复用V1）
- [ ] 计划生成逻辑
- [ ] 训练跟练页（复用V1）

### 阶段8：LLM教练（2天）
- [ ] OpenAI API 接入
- [ ] 训练文案生成
- [ ] 个性化建议

### 阶段9：测试部署（2天）
- [ ] 功能测试
- [ ] Vercel 部署前端
- [ ] Railway 部署后端

**总计：22天**

---

## 九、页面清单

| 页面 | 功能 | 优先级 |
|------|------|--------|
| 登录页 | 邮箱密码登录 | P0 |
| 注册页 | 邮箱密码注册 | P0 |
| 用户信息页 | 3个Tab：基础/详细/目标 | P0 |
| 项目选择页 | 6个项目卡片，可添加删除 | P0 |
| 打卡日历页 | 周视图，训练类型标记 | P0 |
| 当日训练页 | 三栏：热身/训练/拉伸 | P0 |
| 动作详情页 | 视频/图片，计时器 | P0 |
| 我的计划页 | 当前计划，历史记录 | P1 |
| 个人中心 | 账号设置，数据导出 | P2 |

---

## 十、风险与应对

| 风险 | 应对方案 |
|------|----------|
| LLM编造错误动作 | 动作全部来自数据库，LLM只渲染文案 |
| 用户动作做错受伤 | 每个动作强制风险提示，显著免责声明 |
| 渐进逻辑复杂 | MVP只调整次数/轮次，不换整套动作 |
| 用户预期过高 | Coach文案明确说明：只能收紧，不能完全消除 |

---

## 十一、后续扩展（V3+）

1. 社区功能：打卡分享、互相激励
2. 饮食模块：基于BMI的简单饮食建议
3. 进度对比：历史照片对比
4. 动作替代：根据反馈推荐替代动作
5. 多目标组合：同时训练多个项目
6. 小程序版本：微信小程序
7. AI教练：实时语音指导

---

*文档版本：v1.0*
*创建时间：2026-09-13*
*最后更新：2026-09-13*