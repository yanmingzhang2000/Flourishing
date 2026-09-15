# Flourish AI V2 重构方案

## 一、当前问题

### 现有流程
```
登录 → 选择项目(多选) → 填写身体信息 → 生成计划 → 训练
```

### 问题

1. **流程顺序错误**：身体信息（身高体重、器械）是个人属性，应该在"设置"里，不该卡在项目选择后面
2. **无项目时间线配置**：每个项目是固定的，用户无法配置持续时长
3. **多项目支持不完善**：虽然可以选择多个项目，但计划生成只取第一个

---

## 二、重构目标

### 新用户流程
```
首次登录：
  登录 → 设置页(填写身体信息) → 项目浏览 → 选择项目+配置时间线 → 开始训练

非首次登录：
  登录 → 首页(我的训练列表) → 选择项目 → 日历/训练

随时可：
  设置 → 修改身体信息
  首页 → 添加新项目 / 暂停项目
```

### 核心设计理念

**每个项目是独立的训练实例**，用户可以同时进行多个，各自有独立的时间线和进度，训练时选择今天练哪个。

---

## 三、数据模型变更

### 新增 ProjectInstance（项目实例）

```typescript
interface ProjectInstance {
  id: string;                    // 实例ID
  projectId: string;             // 项目类型ID (tricep_tone / hip_width 等)
  status: 'active' | 'paused' | 'completed';
  startDate: string;             // 开始日期
  targetWeeks: 4 | 6 | 8;       // 目标周数（滑块选择）
  currentWeek: number;           // 当前第几周
  trainingDaysPerWeek: number;   // 每周训练天数（从全局偏好继承）
  sessionMinutes: number;        // 单次时长（从全局偏好继承）
  createdAt: string;
}
```

### 修改 UserProfile

```typescript
interface UserProfile {
  // 身体信息
  height: number;
  weight: number;
  bmi: number;
  experience: 'zero' | 'occasional' | 'regular';
  injuries: string[];
  equipment: string[];

  // 训练偏好（全局默认值）
  maxTrainingDaysPerWeek: number;
  singleSessionMaxMin: number;

  // 状态
  onboardingCompleted: boolean;

  // 项目实例列表（替代原来的 selectedProjects）
  projectInstances: ProjectInstance[];
}
```

### 移除的字段

- `UserProfile.selectedProjects: string[]` → 改为 `projectInstances: ProjectInstance[]`

---

## 四、页面结构变更

### 路由规划

| 路由 | 页面组件 | 说明 | 状态 |
|------|----------|------|------|
| `/` | MyProjectsPage | 我的训练列表 | **新增** |
| `/settings` | SettingsPage | 身体信息+训练偏好 | **新增** |
| `/projects` | ProjectsPage | 浏览6个项目 | **新增** |
| `/projects/:id/start` | ProjectStartPage | 配置时间线后启动 | **新增** |
| `/projects/:id/calendar` | CalendarPage | 某个项目的训练日历 | **修改** |
| `/workout/:projectId/:date/:dayIndex` | DayWorkoutPage | 训练页 | **修改** |
| `/exercise/:exerciseId` | ExerciseDetailPage | 动作详情 | 不变 |
| `/auth` | AuthPage | 登录/注册 | 不变 |

### 移除的页面

- `IntakePage.tsx` → 功能合并到 `SettingsPage`
- `ProjectSelectionPage.tsx` → 改为 `ProjectsPage`（浏览模式）+ `MyProjectsPage`（管理模式）

---

## 五、各页面详细设计

### 1. 首页 MyProjectsPage (`/`)

**功能：** 显示用户当前进行中的项目列表

**UI结构：**
```
┌─────────────────────────────────────┐
│  Flourish AI           [设置⚙️]     │
├─────────────────────────────────────┤
│  我的训练                            │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐   │
│  │ 💪 拜拜肉收紧                │   │
│  │ ████████░░░░ 第3周/共6周     │   │
│  │ [继续训练]   [暂停]          │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ 🍑 假胯宽改善                │   │
│  │ ████░░░░░░░░ 第1周/共4周     │   │
│  │ [继续训练]   [暂停]          │   │
│  └─────────────────────────────┘   │
│                                     │
│       [ + 添加新项目 ]              │
└─────────────────────────────────────┘
```

**交互：**
- 点击"继续训练" → 进入该项目的日历页
- 点击"暂停" → 项目状态变为 paused
- 点击"+" → 进入项目浏览页
- 点击设置图标 → 进入设置页

**空状态：**
- 首次使用时显示引导："还没有训练项目，开始你的第一个训练吧"
- 按钮："浏览项目"

---

### 2. 设置页 SettingsPage (`/settings`)

**功能：** 管理用户身体信息和训练偏好

**Tab结构：**

#### Tab1: 身体信息
| 字段 | 类型 | 说明 |
|------|------|------|
| 身高 | 数字输入 | 140-200cm |
| 体重 | 数字输入 | 35-120kg |
| BMI | 自动计算 | 显示但不可编辑 |

#### Tab2: 训练背景
| 字段 | 类型 | 说明 |
|------|------|------|
| 训练经验 | 单选 | 零基础 / 偶尔练 / 经常练 |
| 伤病情况 | 多选标签 | 肩部 / 肘部 / 腕部 |

#### Tab3: 可用器械
| 字段 | 类型 | 说明 |
|------|------|------|
| 器械 | 多选 | 自重 / 1.5kg哑铃 / 2kg哑铃 / 弹力带 |

#### Tab4: 训练偏好
| 字段 | 类型 | 说明 |
|------|------|------|
| 每周训练天数 | 选择 | 2 / 3 / 4 / 5天 |
| 单次训练时长 | 选择 | 20 / 30 / 45分钟 |

**说明：** 这些偏好是全局默认值，新建项目时会继承，但每个项目可独立调整。

---

### 3. 项目浏览页 ProjectsPage (`/projects`)

**功能：** 浏览所有可用项目，查看详情

**UI结构：**
- 复用现有6个项目卡片UI
- 点击卡片 → 进入项目启动配置页（不是直接选中）
- 顶部返回按钮

**与原 ProjectSelectionPage 的区别：**
- 不再是多选模式
- 点击是查看详情+启动，不是勾选
- 不再有"继续"按钮

---

### 4. 项目启动页 ProjectStartPage (`/projects/:id/start`)

**功能：** 配置项目时间线并启动

**UI结构：**
```
┌─────────────────────────────────────┐
│  ← 返回                             │
├─────────────────────────────────────┤
│  💪 拜拜肉收紧                       │
│  瘦大臂，告别蝴蝶袖                  │
│                                     │
│  针对部位：手臂                      │
│  难度：新手友好                      │
│  单次时长：15分钟                    │
│  所需器械：哑铃                      │
├─────────────────────────────────────┤
│  训练时长                            │
│                                     │
│  4周  ──●──────── 6周  ──────── 8周  │
│                                     │
│  预计完成：2026年11月15日            │
├─────────────────────────────────────┤
│                                     │
│       [ 开始训练 ]                   │
│                                     │
└─────────────────────────────────────┘
```

**交互：**
- 滑块选择目标周数：4 / 6 / 8周
- 根据选择动态显示预计完成日期
- 点击"开始训练" → 创建 ProjectInstance → 跳转到该项目的日历页

---

### 5. 项目日历页 CalendarPage (`/projects/:id/calendar`)

**功能：** 显示某个项目的周训练日历

**变更：**
- 增加 `projectId` 参数
- 顶部显示项目名称+返回按钮
- 日历数据从对应 ProjectInstance 获取

---

### 6. 训练页 DayWorkoutPage (`/workout/:projectId/:date/:dayIndex`)

**变更：**
- 增加 `projectId` 参数
- 顶部显示项目名称
- 训练完成后返回该项目的日历页

---

## 六、路由守卫逻辑

### RequireOnboarding

新增路由守卫：首次登录时强制跳转到设置页完成信息录入。

```typescript
// 逻辑
if (!profile.onboardingCompleted && currentPath !== '/settings') {
  return <Navigate to="/settings" />;
}
```

### RequireProject

进入项目日历/训练页时，验证该项目实例存在且状态为 active。

```typescript
// 逻辑
const instance = profile.projectInstances.find(p => p.id === projectId);
if (!instance || instance.status !== 'active') {
  return <Navigate to="/" />;
}
```

---

## 七、实施步骤

### Phase 1: 数据层重构
1. 修改 `types.ts` — 新增 ProjectInstance，修改 UserProfile
2. 修改 `storage.ts` — 支持新的数据结构
3. 修改 `api.ts` — 更新相关API调用

### Phase 2: 新增页面
4. 创建 `SettingsPage.tsx` — 身体信息+训练偏好
5. 创建 `ProjectsPage.tsx` — 项目浏览
6. 创建 `ProjectStartPage.tsx` — 项目启动配置
7. 创建 `MyProjectsPage.tsx` — 首页项目列表

### Phase 3: 修改现有页面
8. 修改 `CalendarPage.tsx` — 增加projectId参数
9. 修改 `DayWorkoutPage.tsx` — 增加projectId参数

### Phase 4: 路由与流程
10. 修改 `App.tsx` — 更新路由配置
11. 新增 `RequireOnboarding` 路由守卫
12. 修改 `planGenerator.ts` — 支持多项目独立生成计划

### Phase 5: 清理
13. 删除 `IntakePage.tsx`（功能已合并到Settings）
14. 删除 `ProjectSelectionPage.tsx`（被新页面替代）

---

## 八、兼容性处理

### 游客模式
- localStorage 存储结构调整为与登录用户一致
- 现有游客数据需要迁移脚本

### 后端API
- 新增 `POST /api/projects/:id/start` — 创建项目实例
- 新增 `PUT /api/projects/:id/instance` — 更新项目状态
- 修改 `GET /api/user/profile` — 返回 projectInstances

---

*文档版本：v2.0*
*创建时间：2026-09-16*
