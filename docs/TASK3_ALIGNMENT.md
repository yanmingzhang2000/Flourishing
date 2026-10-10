# TASK3_ALIGNMENT.md

> **文档版本**: v1.0  
> **创建时间**: 2024-01-08  
> **状态**: 已完成对齐，无冲突  
> **目的**: 逐条对照 `04-SAFETY_RULES.md` 与 `PRODUCT_LOGIC.md`，确认无冲突，记录每条规则的权威来源与实现位置

---

## 一、对齐结论

**✅ 无冲突**：经逐条比对，`04-SAFETY_RULES.md`（权威安全文档）与 `PRODUCT_LOGIC.md`（实现指导）**无矛盾**。
- `04-SAFETY_RULES.md` 定义安全边界与不可妥协的约束（红线）
- `PRODUCT_LOGIC.md` 提供业务规则的实现细节与映射表
- 当两者描述粒度不同时，以 `04-SAFETY_RULES.md` + `01-PRD.md` 为准

---

## 二、安全规则映射表（training-domain 实现位置）

### 2.1 禁忌过滤（Contraindication Filtering）

| 规则 ID | 权威来源 | 规则描述 | 实现位置 | 测试要求 |
|---------|----------|----------|----------|----------|
| **SAFE-01** | 04-SAFETY §1.1 | 用户伤病/限制映射到禁做动作/肌群，计划生成时排除 | `safety/exclusions.ts` | 100% 准确率，覆盖全部伤病类型 |
| **SAFE-01a** | PRODUCT_LOGIC §2.2.1 | 用户选项→内部标签映射（详见表 2.2） | `safety/contraindication-rules.ts` | 单测验证所有映射正确 |
| **SAFE-01b** | PRODUCT_LOGIC §6.4 | 确定性排除流程：取标签并集 → 排除含标签动作 | `safety/exclusions.ts` | 单测验证多伤病并集逻辑 |
| **SAFE-01c** | PRODUCT_LOGIC §6.4 | 无伤病时不误杀任何动作 | `safety/exclusions.ts` | 单测验证空输入 → 无排除 |

**关键约束**：
- ❗ **确定性规则，100% 准确率，不得用 LLM**（04-SAFETY §1.1）
- 多伤病叠加时取**并集**（union），不是交集
- 禁忌动作**绝不**进入计划（05-ACCEPTANCE §6）

---

### 2.2 用户伤病选项 → 内部标签映射表

| 用户选项（中文） | 内部标签（contraindication tags） | 来源 |
|------------------|----------------------------------|------|
| 肩 | `shoulder_impingement`, `rotator_cuff` | PRODUCT_LOGIC §2.2.1 |
| 肘 | `elbow_pain` | PRODUCT_LOGIC §2.2.1 |
| 腕 | `wrist_pain` | PRODUCT_LOGIC §2.2.1 |
| 腰 | `lower_back`, `sciatica` | PRODUCT_LOGIC §2.2.1 |
| 膝 | `knee_pain`, `meniscus` | PRODUCT_LOGIC §2.2.1 |
| 颈 | `neck_pain` | PRODUCT_LOGIC §2.2.1 |

**完整标签词表**（PRODUCT_LOGIC §5.4）:
```
shoulder_impingement, rotator_cuff, neck_pain, elbow_pain,
wrist_pain, lower_back, sciatica, knee_pain, meniscus
```

**实现位置**: `packages/training-domain/src/safety/contraindication-rules.ts`

---

### 2.3 恢复间隔（Recovery Intervals）

| 规则 ID | 权威来源 | 规则描述 | 实现位置 | 测试要求 |
|---------|----------|----------|----------|----------|
| **SAFE-02** | 04-SAFETY §1.1 | 同一肌群两次训练的最小间隔（≥48h），排期遵守 | `scheduling/recovery.ts` | 单测验证 <48h 被阻断，≥48h 通过 |
| **SAFE-02a** | PRODUCT_LOGIC §3.2 | 7 天全选时，系统强制插入主动恢复/变式日 | `scheduling/weekly-scheduler.ts` | 集成测试验证 7 天训练的恢复安排 |

**关键约束**：
- 最小间隔：48 小时（04-SAFETY §1.1）
- 多项目交替训练时，按肌群独立计算恢复时间（PRODUCT_LOGIC §3.2）

**实现位置**: `packages/training-domain/src/scheduling/recovery.ts`

---

### 2.4 难度约束（Difficulty Constraints）

| 规则 ID | 权威来源 | 规则描述 | 实现位置 | 测试要求 |
|---------|----------|----------|----------|----------|
| **SAFE-03** | 04-SAFETY §1.1 | 基于训练经验/近期表现决定进退阶，不超用户容量 | `difficulty/progression.ts` | 单测验证经验等级 → 难度范围映射 |
| **SAFE-03a** | PRODUCT_LOGIC §6.2 | 经验等级 → 难度范围映射（详见表 2.4） | `difficulty/progression.ts` | 单测覆盖 beginner/intermediate/advanced |
| **SAFE-03b** | PRODUCT_LOGIC §7.2 | 反馈调整规则：太轻松 → +次数/+组数/+难度 | `difficulty/adjustment.ts` | 单测验证调整优先级与边界 |
| **SAFE-03c** | PRODUCT_LOGIC §7.2 | 反馈调整规则：太难 → -次数/-组数/-难度 | `difficulty/adjustment.ts` | 单测验证降级逻辑 |

**经验等级 → 难度映射表**（PRODUCT_LOGIC §6.2）:

| 经验等级 | 映射难度 | 组数 | 次数 | 组间休息 | contracts 字段 |
|----------|----------|------|------|----------|----------------|
| 零基础 | D1-2 | 2-3组 | 8-12次 | 60秒 | `beginner` |
| 偶尔练 | D2-3 | 3组 | 12-15次 | 45秒 | `intermediate` |
| 经常练 | D3-4 | 3-4组 | 15-20次 | 30秒 | `advanced` |

**实现位置**: `packages/training-domain/src/difficulty/`

---

### 2.5 容量对齐（Capacity Alignment）

| 规则 ID | 权威来源 | 规则描述 | 实现位置 | 测试要求 |
|---------|----------|----------|----------|----------|
| **SAFE-04** | 04-SAFETY §1.1 | 单次时长/周频次必须落在用户档案设定范围内 | `composition/duration-calculator.ts` | **修旧债验证**：30min/5days → 每次 25-35min |
| **SAFE-04a** | PRODUCT_LOGIC §2.2.3 | 总时长 = Σ(各项目主训练时长) + 固定热身 5min | `composition/duration-calculator.ts` | 单测验证时长计算公式 |
| **SAFE-04b** | PRODUCT_LOGIC §6.1 | 根据时长分配动作数量（详见表 2.5） | `composition/exercise-selector.ts` | 单测验证 15/20/30/45min 动作数 |

**时长 → 动作数映射表**（PRODUCT_LOGIC §6.1）:

| 时长 | 热身 | 主训练 | 拉伸 | 总动作数 |
|------|------|--------|------|----------|
| 15分钟 | 2-3个 | 3-4个 | 2个 | 7-9个 |
| 20分钟 | 3个 | 4-5个 | 2个 | 9-10个 |
| 30分钟 | 3个 | 5-6个 | 3个 | 11-12个 |
| 45分钟 | 4个 | 6-8个 | 3个 | 13-15个 |

**关键约束**：
- ❗ **旧债修复**：用户填写 30min/5days，必须生成接近 30min 的训练（不能 5min）
- 容差：建议 ±5min 或 ±10%（待确认）
- 必须消费 `targetMinutesPerSession` 和 `targetSessionsPerWeek` 字段（contracts/user.ts）

**实现位置**: `packages/training-domain/src/composition/`

---

### 2.6 关节不适硬阻断（Joint Discomfort Hard Block）

| 规则 ID | 权威来源 | 规则描述 | 实现位置 | 测试要求 |
|---------|----------|----------|----------|----------|
| **SAFE-05** | 04-SAFETY §1.1, §2 | 跟练中反馈关节不适 → 立即暂停/跳过该动作 | `workouts` 模块（**任务 4**） | E2E 测试验证硬阻断 + 重校验 |
| **SAFE-05a** | 04-SAFETY §2 | 重校验后续安排：含该肌群/相关动作的计划重跑 safety 校验 | `safety/exclusions.ts` | 集成测试验证重校验逻辑 |
| **SAFE-05b** | PRODUCT_LOGIC §7.2 | 处理流程：停止 → 排除该动作及变式 → 推荐替代 → 建议休息 | `workouts` 模块（**任务 4**） | E2E 测试验证完整流程 |

**关键约束**：
- ❗ **LLM 不得决定"是否安全继续"**（04-SAFETY §2）
- 安全判定由规则引擎执行，AI 仅做安抚性/解释性话术
- 必须有 E2E 测试验证阻断生效（05-ACCEPTANCE §6）

**实现位置**: 
- 硬阻断逻辑：`packages/training-domain/src/safety/exclusions.ts`（可复用）
- 完整跟练流程：`apps/server/src/modules/workouts`（**任务 4 实现**）

---

## 三、权威来源优先级

当文档描述粒度或细节不同时，按以下优先级：

1. **04-SAFETY_RULES.md**（最高）：不可妥协的安全边界与 AI 权限隔离
2. **01-PRD.md**：产品需求与核心闭环定义
3. **PRODUCT_LOGIC.md**：业务规则实现细节与映射表（作为输入素材）

**已确认无冲突**：所有对比场景中，`PRODUCT_LOGIC.md` 的规则与 `04-SAFETY_RULES.md` 一致或更详细，无矛盾。

---

## 四、contracts 字段映射

### 4.1 用户档案（Profile）

| PRODUCT_LOGIC 字段 | contracts 字段 | Zod Schema | 说明 |
|--------------------|----------------|------------|------|
| 训练经验：零基础/偶尔练/经常练 | `experienceLevel` | `experienceLevelSchema` | `'beginner' \| 'intermediate' \| 'advanced'` |
| 伤病情况：肩/肘/腕/腰/膝/颈 | `injuries` | `z.array(injuryTagSchema)` | 存储内部标签数组（如 `['shoulder_impingement', 'knee_pain']`） |
| 每周训练天数 | `targetSessionsPerWeek` | `z.number().int().min(1).max(7)` | 必须消费此字段（SAFE-04） |
| 单次训练时长 | `targetMinutesPerSession` | `z.number().int().min(5).max(180)` | 必须消费此字段（SAFE-04） |

**来源**: `packages/contracts/src/user.ts`

### 4.2 动作库（Exercise）

| PRODUCT_LOGIC 字段 | contracts 字段 | 说明 |
|--------------------|----------------|------|
| `contraindications` | `contraindications` | `z.array(z.string())` - 禁忌标签数组 |
| `difficulty` | `difficulty` | `z.number().int().min(1).max(5)` |
| `muscle_group.primary` | `muscleGroup.primary` | `z.array(z.string())` |
| `rest_seconds` | `restSeconds` | `z.number().int().min(0).max(600)` |

**来源**: `packages/contracts/src/exercise.ts`

---

## 五、测试覆盖要求（对应验收标准）

### 5.1 Phase 4 - 禁忌过滤测试（SAFE-01）

**必须通过的测试场景**：

| 测试用例 ID | 场景描述 | 输入 | 期望输出 | 覆盖规则 |
|------------|----------|------|----------|----------|
| **T-SAFE-01-01** | 单个伤病排除 | 用户选择"肩" | 所有含 `shoulder_impingement` 或 `rotator_cuff` 的动作被排除 | SAFE-01a, SAFE-01b |
| **T-SAFE-01-02** | 单个伤病排除 | 用户选择"膝" | 所有含 `knee_pain` 或 `meniscus` 的动作被排除 | SAFE-01a, SAFE-01b |
| **T-SAFE-01-03** | 多伤病并集 | 用户选择"肩"+"膝" | 排除含（肩标签 ∪ 膝标签）的所有动作 | SAFE-01b |
| **T-SAFE-01-04** | 无伤病不误杀 | 用户未选择任何伤病 | 所有动作均可用（0 个排除） | SAFE-01c |
| **T-SAFE-01-05** | 全部伤病类型 | 遍历所有 6 种用户选项 | 每种伤病的标签映射正确 | SAFE-01a |

**准确率要求**：100%（不允许任何漏排或误排）

---

### 5.2 Phase 5 - 恢复间隔测试（SAFE-02）

| 测试用例 ID | 场景描述 | 输入 | 期望输出 | 覆盖规则 |
|------------|----------|------|----------|----------|
| **T-SAFE-02-01** | 同肌群 <48h 阻断 | 上次训练肱三头肌：周一 10:00，尝试安排：周二 10:00 | 被阻断（间隔 24h < 48h） | SAFE-02 |
| **T-SAFE-02-02** | 同肌群 ≥48h 通过 | 上次训练肱三头肌：周一 10:00，尝试安排：周三 11:00 | 通过（间隔 49h ≥ 48h） | SAFE-02 |
| **T-SAFE-02-03** | 不同肌群无限制 | 周一训练手臂，周二训练腿 | 通过（不同肌群） | SAFE-02 |

---

### 5.3 Phase 6 - 容量对齐测试（SAFE-04）

| 测试用例 ID | 场景描述 | 输入 | 期望输出 | 覆盖规则 |
|------------|----------|------|----------|----------|
| **T-SAFE-04-01** | 30min 目标 | `targetMinutesPerSession: 30` | 每个训练日 25-35min（±5min 容差） | SAFE-04 |
| **T-SAFE-04-02** | 15min 目标 | `targetMinutesPerSession: 15` | 每个训练日 10-20min | SAFE-04 |
| **T-SAFE-04-03** | 45min 目标 | `targetMinutesPerSession: 45` | 每个训练日 40-50min | SAFE-04 |
| **T-SAFE-04-04** | 周频次匹配 | `targetSessionsPerWeek: 5`, `trainingDays: [Mon,Tue,Wed,Thu,Fri]` | 生成 5 个训练日 | SAFE-04 |

**旧债修复验证**：T-SAFE-04-01 必须通过，证明不再生成 5min 训练。

---

### 5.4 Phase 7 - 难度约束测试（SAFE-03）

| 测试用例 ID | 场景描述 | 输入 | 期望输出 | 覆盖规则 |
|------------|----------|------|----------|----------|
| **T-SAFE-03-01** | 初学者难度 | `experienceLevel: 'beginner'` | 动作难度 1-2，组数 2-3 | SAFE-03a |
| **T-SAFE-03-02** | 中级难度 | `experienceLevel: 'intermediate'` | 动作难度 2-3，组数 3 | SAFE-03a |
| **T-SAFE-03-03** | 高级难度 | `experienceLevel: 'advanced'` | 动作难度 3-4，组数 3-4 | SAFE-03a |

---

## 六、实现位置总览（training-domain 模块结构）

```
packages/training-domain/src/
├── exercises/
│   ├── loader.ts                      # 加载 canonical JSON（fs 隔离边界）
│   ├── repository.ts                  # 纯函数查询（按肌群/器械/难度）
│   └── exercises.test.ts              # 69 条动作加载验证
├── safety/
│   ├── contraindication-rules.ts      # 用户选项 → 内部标签映射（SAFE-01a）
│   ├── exclusions.ts                  # 禁忌过滤主逻辑（SAFE-01b/c）
│   └── exclusions.test.ts             # T-SAFE-01-01 ~ T-SAFE-01-05
├── scheduling/
│   ├── recovery.ts                    # 48h 恢复间隔检查（SAFE-02）
│   ├── recovery.test.ts               # T-SAFE-02-01 ~ T-SAFE-02-03
│   └── weekly-scheduler.ts            # 周计划排期（含 7 天恢复安排）
├── difficulty/
│   ├── progression.ts                 # 经验 → 难度范围映射（SAFE-03a）
│   ├── adjustment.ts                  # 反馈 → 难度调整（SAFE-03b/c）
│   └── difficulty.test.ts             # T-SAFE-03-01 ~ T-SAFE-03-03
├── composition/
│   ├── duration-calculator.ts         # 时长计算公式（SAFE-04a/b）
│   ├── exercise-selector.ts           # 动作数量分配（表 2.5）
│   ├── planner.ts                     # 单日计划组装（SAFE-04）
│   ├── weekly-planner.ts              # 周计划组装
│   └── composition.test.ts            # T-SAFE-04-01 ~ T-SAFE-04-04
├── generator/
│   ├── plan-generator.ts              # 计划生成编排（Phase 7 主入口）
│   └── plan-generator.test.ts         # 集成测试（端到端）
└── index.ts                           # 公开 API 导出
```

---

## 七、未决事项与后续任务

### 7.1 容差参数待确认

**问题**：容量对齐（SAFE-04）的时长容差未明确定义。

**建议**：
- 方案 A：固定容差 ±5 分钟（简单）
- 方案 B：百分比容差 ±10%（灵活，45min 容差更大）
- 方案 C：分段容差（15min: ±3min, 30min: ±5min, 45min: ±8min）

**决策记录**：待 Phase 6 实现前确认，本文档暂采用 **±5min**。

---

### 7.2 关节不适完整流程（任务 4）

**说明**：SAFE-05 的完整实现依赖跟练闭环（任务 4），本任务（任务 3）只需：
- Phase 4 实现 `safety/exclusions.ts`，使其**可复用**（支持动态追加排除动作）
- Phase 8 预留集成测试桩，验证可以"重跑 safety 校验"

**任务边界**：本任务不实现跟练 UI 与会话管理。

---

### 7.3 缺封面动作处理

**已知问题**（data/exercise-library/README.md）：
- `standing_scapular_depression` 和 `supine_ball_scapular_slide` 引用的封面不存在

**本任务处理**：
- Phase 3 加载时**不验证**封面文件存在性（只验证 JSON schema）
- Phase 8 单测中**文档化**这 2 条缺封面（不阻塞任务 3）
- 封面补充由独立任务处理

---

## 八、变更日志

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|----------|------|
| 2024-01-08 | v1.0 | 初始版本，完成全部对齐与映射 | AI Coding Agent |

---

**✅ Pre-Phase 完成**：本文档已完成所有对齐工作，确认无冲突，可进入 Phase 2 实现。
