# Copilot 系统架构设计文档

## 📋 文档信息

- **版本**: 1.0.0
- **创建日期**: 2026-10-05
- **负责人**: AI Team
- **状态**: 实施中

---

## 🎯 概述

Copilot 是 Flourish AI 的核心交互层，负责在关键时刻主动与用户对话，提供个性化建议和指导。不同于传统的被动式 UI，Copilot 采用对话式交互，让用户感受到"有一个 AI 教练在关心我的训练"。

### 核心理念

1. **主动而非被动**：不等用户询问，在关键时刻主动响应
2. **对话而非表单**：用自然语言解释，而非冷冰冰的设置页面
3. **智能而非规则**：理解用户意图，提供个性化建议
4. **透明而非黑盒**：解释为什么做出某个建议，建立信任

### 核心能力矩阵

| 能力类别 | 当前实现 | 未来规划 |
|---------|---------|---------|
| **反馈响应** | ✅ 训练难度调整<br>✅ 关节不适处理 | 🔄 训练时长调整<br>🔄 动作偏好学习 |
| **主动指导** | - | 🔄 训练前提醒<br>🔄 训练中鼓励<br>🔄 训练后总结 |
| **知识问答** | - | 🔄 动作原理解释<br>🔄 训练方法咨询<br>🔄 计划调整原因 |
| **计划调整** | ✅ 难度自动调整 | 🔄 项目切换建议<br>🔄 暂停/恢复训练 |
| **数据洞察** | - | 🔄 训练效果分析<br>🔄 进度趋势展示<br>🔄 目标达成预测 |

---

## 🏗️ 系统架构

### 整体架构图

```
┌──────────────────────────────────────────────────────┐
│                  Copilot System                      │
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │         Frontend Copilot Client            │    │
│  │  (UI Layer + Local Context + Event Bus)   │    │
│  └────────────────┬───────────────────────────┘    │
│                   │ REST API                        │
│  ┌────────────────▼───────────────────────────┐    │
│  │         Backend Copilot Engine             │    │
│  │                                             │    │
│  │  ┌──────────────────────────────────────┐ │    │
│  │  │     Intent Router (意图路由)         │ │    │
│  │  │  - Rule-based (当前)                 │ │    │
│  │  │  - LLM-based (预留接口)              │ │    │
│  │  └──────────────┬───────────────────────┘ │    │
│  │                 │                          │    │
│  │  ┌──────────────▼───────────────────────┐ │    │
│  │  │   Context Manager (上下文管理器)     │ │    │
│  │  │  - Session Store (短期会话)          │ │    │
│  │  │  - User Profile Cache (用户档案)     │ │    │
│  │  │  - Conversation History (对话历史)   │ │    │
│  │  └──────────────┬───────────────────────┘ │    │
│  │                 │                          │    │
│  │  ┌──────────────▼───────────────────────┐ │    │
│  │  │   Intent Handlers (意图处理器)       │ │    │
│  │  │  - FeedbackHandler                   │ │    │
│  │  │  - PlanAdjustmentHandler             │ │    │
│  │  │  - KnowledgeQueryHandler (预留)      │ │    │
│  │  │  - ProgressInsightHandler (预留)     │ │    │
│  │  └──────────────┬───────────────────────┘ │    │
│  │                 │                          │    │
│  │  ┌──────────────▼───────────────────────┐ │    │
│  │  │   Response Builder (响应构建器)      │ │    │
│  │  │  - Template Matcher (模板匹配)       │ │    │
│  │  │  - Variable Interpolation (变量替换) │ │    │
│  │  │  - Action Injection (动作注入)       │ │    │
│  │  └──────────────┬───────────────────────┘ │    │
│  │                 │                          │    │
│  │  ┌──────────────▼───────────────────────┐ │    │
│  │  │   Actions Executor (动作执行器)      │ │    │
│  │  │  - API Calls (调用业务 API)          │ │    │
│  │  │  - Side Effects (副作用处理)         │ │    │
│  │  └──────────────────────────────────────┘ │    │
│  │                                             │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │         Data Layer (数据层)                 │    │
│  │                                             │    │
│  │  ┌──────────────┐  ┌──────────────────┐   │    │
│  │  │ Templates DB │  │ copilot_sessions │   │    │
│  │  │ (模板库)     │  │ (会话记录)       │   │    │
│  │  └──────────────┘  └──────────────────┘   │    │
│  │                                             │    │
│  │  ┌──────────────┐  ┌──────────────────┐   │    │
│  │  │ Knowledge DB │  │ user_preferences │   │    │
│  │  │ (知识库)     │  │ (用户偏好)       │   │    │
│  │  └──────────────┘  └──────────────────┘   │    │
│  └─────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

---

## 🗄️ 数据库设计

### 1. copilot_sessions（会话记录表）

存储每次 Copilot 交互的会话信息，支持多轮对话。

```sql
CREATE TABLE copilot_sessions (
  id TEXT PRIMARY KEY,                    -- UUID
  user_id INTEGER REFERENCES users(id),
  intent TEXT NOT NULL,                   -- feedback_response, plan_adjustment, etc.
  trigger_event TEXT,                     -- JSON: 触发事件详情
  context_snapshot TEXT,                  -- JSON: 上下文快照（用户档案、历史记录等）
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'active'            -- active, completed, abandoned
);
```

**字段说明**：
- `id`: 会话唯一标识，用于多轮对话追踪
- `intent`: 意图类型，决定由哪个 Handler 处理
- `trigger_event`: 触发事件的完整信息（JSON），用于调试和分析
- `context_snapshot`: 触发时的上下文快照，用于后续分析
- `status`: 会话状态（active=进行中，completed=已完成，abandoned=用户未响应）

### 2. copilot_messages（消息记录表）

存储会话中的所有消息（包括 Copilot 响应和用户选择）。

```sql
CREATE TABLE copilot_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT REFERENCES copilot_sessions(id),
  role TEXT NOT NULL,                     -- assistant, user, system
  content TEXT NOT NULL,                  -- 消息内容
  message_type TEXT,                      -- text, action_prompt, insight, etc.
  metadata TEXT,                          -- JSON: 额外信息（如显示的动作按钮）
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**字段说明**：
- `role`: 消息角色（assistant=Copilot, user=用户选择, system=系统通知）
- `message_type`: 消息类型，用于前端渲染不同样式
- `metadata`: 消息元数据（如动作按钮配置、语气标签等）

### 3. copilot_actions（动作执行记录表）

记录用户执行的所有动作及其结果。

```sql
CREATE TABLE copilot_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT REFERENCES copilot_sessions(id),
  message_id INTEGER REFERENCES copilot_messages(id),
  action_id TEXT NOT NULL,                -- adjust_difficulty_lower, etc.
  action_params TEXT,                     -- JSON: 动作参数
  result TEXT,                            -- JSON: 执行结果
  executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**用途**：
- 分析用户行为（哪些建议被采纳，哪些被拒绝）
- 优化 Copilot 策略（提高建议采纳率）
- 支持 A/B 测试

### 4. copilot_templates（模板表）

**核心设计：数据驱动的响应模板系统**

```sql
CREATE TABLE copilot_templates (
  id TEXT PRIMARY KEY,                    -- feedback_too_hard_warning
  intent TEXT NOT NULL,                   -- feedback_response
  condition_expr TEXT,                    -- 条件表达式: "recentTooHardCount >= 2"
  priority INTEGER DEFAULT 0,             -- 优先级（多个模板匹配时选择高优先级）
  message_template TEXT NOT NULL,         -- 模板内容（支持变量插值）
  tone TEXT,                              -- informative, warning, celebratory, etc.
  actions TEXT,                           -- JSON: 动作按钮配置
  enabled INTEGER DEFAULT 1,              -- 是否启用
  version INTEGER DEFAULT 1,              -- 版本号（支持 A/B 测试）
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**为什么用数据库存储模板**：
- ✅ **热更新**：修改文案无需重新发版
- ✅ **A/B 测试**：同一意图可以有多个版本，按比例分流
- ✅ **非技术人员可维护**：PM/设计师可以直接在数据库管理后台修改
- ✅ **灰度发布**：新模板先对部分用户生效，验证后再全量

**条件表达式示例**：
```javascript
// 简单条件
"feedback === 'too_hard'"

// 复杂条件
"feedback === 'too_hard' && recentTooHardCount >= 2"

// 多条件组合
"(feedback === 'too_easy' && recentTooEasyCount >= 3) || userExperience === 'regular'"
```

**变量插值示例**：
```javascript
// 模板
"我注意到你最近{{recentTooHardCount + 1}}次训练都觉得有点难..."

// 渲染后
"我注意到你最近2次训练都觉得有点难..."
```

### 5. copilot_knowledge（知识库表，预留）

用于未来的知识问答功能，支持 RAG（Retrieval-Augmented Generation）。

```sql
CREATE TABLE copilot_knowledge (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,                 -- exercise_info, nutrition, injury_prevention
  question_pattern TEXT,                  -- 问题匹配模式（支持正则或关键词）
  answer TEXT NOT NULL,                   -- 答案内容
  sources TEXT,                           -- JSON: 来源引用
  confidence_score REAL,                  -- 置信度（用于 RAG 检索排序）
  embedding BLOB,                         -- 向量嵌入（用于语义搜索，预留）
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**未来应用场景**：
- 用户问："这个动作为什么对瘦手臂有效？"
- Copilot 从知识库检索相关条目，生成回答

### 6. user_profiles 扩展

新增 `copilot_settings` 字段存储用户偏好。

```sql
ALTER TABLE user_profiles ADD COLUMN copilot_settings TEXT DEFAULT '{}';
```

**JSON 格式**：
```json
{
  "difficulty_preference": "auto",           // auto, keep_low, keep_standard, keep_high
  "notification_frequency": "normal",        // minimal, normal, frequent
  "tone_preference": "friendly",             // friendly, professional, motivational
  "disabled_intents": [],                    // 用户可以关闭某些 Copilot 功能
  "last_interaction_at": "2026-10-05T10:30:00Z"
}
```

---

## 📡 API 设计

### POST /api/copilot/process

触发 Copilot 处理事件，返回响应消息。

**Request:**
```json
{
  "event": {
    "type": "training_feedback_submitted",
    "data": {
      "feedback": "too_hard",
      "date": "2026-10-05",
      "completedExercises": ["ex_001", "ex_002"]
    }
  },
  "sessionId": "uuid-123" // 可选，用于多轮对话
}
```

**Response:**
```json
{
  "sessionId": "uuid-456",
  "message": {
    "id": 789,
    "role": "assistant",
    "content": "我注意到你最近2次训练都觉得有点难。\n\n下次生成计划时，我可以为你：\n• 选择难度更低的动作\n• 减少训练组数和次数\n\n要调整吗？",
    "tone": "warning",
    "actions": [
      {
        "id": "adjust_lower",
        "label": "好的，帮我调整",
        "handler": "adjust_difficulty_lower",
        "style": "primary"
      },
      {
        "id": "keep_current",
        "label": "暂不调整，我再试试",
        "handler": "keep_current_difficulty",
        "style": "secondary"
      }
    ]
  },
  "context": {
    "recentFeedback": [
      { "date": "2026-10-03", "feedback": "too_hard" },
      { "date": "2026-10-01", "feedback": "just_right" }
    ],
    "currentDifficulty": 2
  }
}
```

**响应字段说明**：
- `sessionId`: 会话 ID，用于后续交互
- `message.content`: Copilot 响应文本
- `message.tone`: 语气标签（用于前端渲染不同样式）
- `message.actions`: 动作按钮列表
- `context`: 公开的上下文信息（用于前端展示）

### POST /api/copilot/execute

执行用户选择的动作。

**Request:**
```json
{
  "sessionId": "uuid-456",
  "messageId": 789,
  "actionId": "adjust_lower",
  "params": {}
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "message": "已为你降低训练难度，下次生成计划时生效。"
  },
  "nextMessage": null  // 如果有后续响应，返回下一条消息
}
```

**多轮对话示例**：
```json
// 如果需要进一步确认
{
  "success": true,
  "result": {},
  "nextMessage": {
    "id": 790,
    "role": "assistant",
    "content": "好的！我会为你降低难度。\n\n顺便问一下，你希望先从哪个项目开始降低呢？",
    "actions": [...]
  }
}
```

### GET /api/copilot/sessions/:sessionId

获取会话历史（支持多轮对话回顾）。

**Response:**
```json
{
  "sessionId": "uuid-456",
  "intent": "feedback_response",
  "messages": [
    {
      "id": 789,
      "role": "assistant",
      "content": "我注意到你最近2次训练都觉得有点难...",
      "createdAt": "2026-10-05T10:30:00Z"
    },
    {
      "id": 790,
      "role": "user",
      "content": "[执行动作: adjust_lower]",
      "createdAt": "2026-10-05T10:31:00Z"
    }
  ],
  "status": "completed"
}
```

### PUT /api/copilot/settings

更新用户 Copilot 偏好。

**Request:**
```json
{
  "difficulty_preference": "keep_low",
  "notification_frequency": "minimal",
  "tone_preference": "professional"
}
```

---

## 🧩 核心模块设计

### 1. Intent Router（意图路由器）

**职责**：根据触发事件识别用户意图。

**当前实现**：基于规则的路由
```typescript
class IntentRouter {
  route(event: CopilotEvent): CopilotIntent | null {
    if (event.type === 'training_feedback_submitted') {
      return 'feedback_response';
    }
    if (event.type === 'plan_generated' && event.data.difficultyAdjustment) {
      return 'plan_adjustment';
    }
    return null;
  }
}
```

**未来扩展**：LLM 意图识别
```typescript
class LLMIntentRouter extends IntentRouter {
  async route(event: CopilotEvent): Promise<CopilotIntent | null> {
    if (event.type === 'user_text_input') {
      // 调用 GPT-4 识别意图
      const response = await openai.chat.completions.create({...});
      return response.function_call.name;
    }
    return super.route(event);
  }
}
```

### 2. Context Manager（上下文管理器）

**职责**：管理对话上下文，加载相关数据。

**上下文结构**：
```typescript
interface CopilotContext {
  userId: number;
  sessionId: string;
  
  // 用户档案
  userProfile: {
    experience: string;
    injuries: string[];
    equipment: string[];
    copilotSettings: CopilotSettings;
  };
  
  // 训练历史
  trainingHistory: {
    recentFeedback: Array<{ date: string; feedback: string }>;
    recentTooHardCount: number;
    recentTooEasyCount: number;
    currentDifficulty: 1 | 2 | 3;
  };
  
  // 触发事件
  triggerEvent: CopilotEvent;
}
```

**数据加载策略**：
- 用户档案：从 `user_profiles` 表加载，缓存 5 分钟
- 训练历史：从 `training_records` 表查询最近 10 条记录
- 会话历史：从 `copilot_messages` 表加载（如果是多轮对话）

### 3. Intent Handlers（意图处理器）

**接口定义**：
```typescript
interface IntentHandler {
  build(context: CopilotContext): Promise<CopilotResponse>;
}
```

**已实现的 Handlers**：

#### FeedbackHandler
处理训练反馈响应。

**逻辑**：
1. 加载对应意图的所有启用模板
2. 按优先级遍历，找到第一个条件匹配的模板
3. 变量插值，生成最终响应
4. 注入动作按钮

#### PlanAdjustmentHandler（预留）
处理计划生成时的主动说明。

**逻辑**：
1. 检查本次生成是否调整了难度
2. 如果调整了，解释原因
3. 提供"撤销调整"选项

### 4. Response Builder（响应构建器）

**职责**：基于模板生成最终响应。

**核心功能**：

#### 模板匹配
```typescript
class TemplateMatcher {
  match(templates: CopilotTemplate[], context: CopilotContext): CopilotTemplate | null {
    // 按优先级排序
    const sorted = templates.sort((a, b) => b.priority - a.priority);
    
    // 找到第一个条件匹配的
    for (const template of sorted) {
      if (this.evaluateCondition(template.condition_expr, context)) {
        return template;
      }
    }
    return null;
  }
  
  private evaluateCondition(expr: string, context: CopilotContext): boolean {
    // 使用 Function 构造器执行表达式
    const fn = new Function('ctx', `with (ctx) { return ${expr}; }`);
    return fn(context);
  }
}
```

#### 变量插值
```typescript
class VariableInterpolator {
  interpolate(template: string, context: CopilotContext): string {
    return template.replace(/\{\{(.+?)\}\}/g, (_, expr) => {
      const fn = new Function('ctx', `with (ctx) { return ${expr}; }`);
      return String(fn(context));
    });
  }
}
```

### 5. Actions Executor（动作执行器）

**职责**：执行用户选择的动作，调用业务 API。

**已注册的动作**：

```typescript
const actionHandlers = {
  adjust_difficulty_lower: async (params, context) => {
    await userApi.setDifficultyPreference(context.userId, 'keep_low');
    return {
      success: true,
      message: '已为你降低训练难度，下次生成计划时生效。'
    };
  },
  
  adjust_difficulty_higher: async (params, context) => {
    await userApi.setDifficultyPreference(context.userId, 'keep_high');
    return {
      success: true,
      message: '已为你提高训练难度，准备好挑战吧！'
    };
  },
  
  keep_current_difficulty: async (params, context) => {
    await userApi.setDifficultyPreference(context.userId, 'keep_standard');
    return {
      success: true,
      message: '好的，保持当前难度。如果后续觉得不合适，随时告诉我。'
    };
  }
};
```

---

## 💻 实现细节

### 后端文件结构

```
server/src/copilot/
├── engine.ts                  # Copilot 核心引擎
├── router.ts                  # Express 路由
├── types.ts                   # 类型定义
├── intentRouter.ts            # 意图路由器
├── contextManager.ts          # 上下文管理器
├── responseBuilder.ts         # 响应构建器
├── actionsExecutor.ts         # 动作执行器
├── templateMatcher.ts         # 模板匹配器
├── handlers/                  # 意图处理器
│   ├── index.ts
│   ├── feedbackHandler.ts
│   └── planAdjustmentHandler.ts
└── services/
    ├── sessionService.ts      # 会话管理
    ├── templateService.ts     # 模板管理
    └── analyticsService.ts    # 分析服务
```

### 前端文件结构

```
src/lib/copilot/
├── client.ts                  # Copilot 客户端（封装 API 调用）
├── eventBus.ts                # 事件总线
└── types.ts                   # 类型定义

src/components/copilot/
├── CopilotModal.tsx           # 通用模态框
├── CopilotMessage.tsx         # 消息组件
├── CopilotActionButton.tsx    # 动作按钮
└── CopilotToast.tsx           # 轻量提示

src/hooks/
└── useCopilot.ts              # React Hook
```

---

## 🧪 测试策略

### 单元测试

#### 模板匹配测试
```typescript
describe('TemplateMatcher', () => {
  it('should match template by condition', () => {
    const matcher = new TemplateMatcher();
    const templates = [
      { id: 'a', condition_expr: 'count >= 2', priority: 10 },
      { id: 'b', condition_expr: 'count >= 1', priority: 5 }
    ];
    const context = { count: 2 };
    
    const matched = matcher.match(templates, context);
    expect(matched.id).toBe('a'); // 高优先级优先
  });
});
```

#### 动作执行测试
```typescript
describe('ActionsExecutor', () => {
  it('should execute action and return result', async () => {
    const executor = new ActionsExecutor();
    const result = await executor.execute('adjust_difficulty_lower', {}, context);
    
    expect(result.success).toBe(true);
    expect(result.message).toContain('降低训练难度');
  });
});
```

### 集成测试

#### 端到端反馈流程
```typescript
describe('Copilot Feedback Flow', () => {
  it('should respond to consecutive too_hard feedback', async () => {
    // 1. 用户第 1 次反馈 too_hard
    const response1 = await copilotEngine.process({
      type: 'training_feedback_submitted',
      data: { feedback: 'too_hard' }
    }, userId);
    expect(response1.message.content).toContain('我会持续关注');
    
    // 2. 用户第 2 次反馈 too_hard
    const response2 = await copilotEngine.process({
      type: 'training_feedback_submitted',
      data: { feedback: 'too_hard' }
    }, userId);
    expect(response2.message.content).toContain('我注意到你最近2次');
    expect(response2.message.actions.length).toBe(2);
    
    // 3. 用户选择"帮我调整"
    const actionResult = await copilotEngine.executeAction(
      response2.sessionId,
      response2.message.id,
      'adjust_lower',
      {}
    );
    expect(actionResult.success).toBe(true);
    
    // 4. 验证偏好已保存
    const settings = await getUserCopilotSettings(userId);
    expect(settings.difficulty_preference).toBe('keep_low');
  });
});
```

---

## 📊 数据分析指标

### 核心指标

#### 1. 交互率
- **定义**：每周至少与 Copilot 交互 1 次的用户占比
- **目标**：≥ 60%
- **计算**：`COUNT(DISTINCT user_id WHERE interacted_this_week) / COUNT(DISTINCT active_users)`

#### 2. 动作执行率
- **定义**：用户选择"执行建议"的比例
- **目标**：≥ 40%
- **计算**：`COUNT(actions WHERE result='accept') / COUNT(actions)`

#### 3. 会话完成率
- **定义**：用户完成整个对话的比例（未中途关闭）
- **目标**：≥ 80%
- **计算**：`COUNT(sessions WHERE status='completed') / COUNT(sessions)`

### 分析查询

#### 最受欢迎的模板
```sql
SELECT 
  t.id,
  t.message_template,
  COUNT(m.id) AS usage_count,
  AVG(CASE WHEN a.action_id LIKE '%accept%' THEN 1 ELSE 0 END) AS acceptance_rate
FROM copilot_templates t
JOIN copilot_messages m ON m.metadata LIKE '%' || t.id || '%'
LEFT JOIN copilot_actions a ON a.message_id = m.id
GROUP BY t.id
ORDER BY usage_count DESC;
```

#### 用户 Copilot 使用习惯
```sql
SELECT 
  user_id,
  COUNT(DISTINCT session_id) AS session_count,
  COUNT(action_id) AS action_count,
  AVG(CASE WHEN result LIKE '%success%' THEN 1 ELSE 0 END) AS success_rate
FROM copilot_actions
WHERE executed_at >= datetime('now', '-30 days')
GROUP BY user_id
HAVING session_count >= 3;
```

---

## 🔮 未来扩展路线图

### Phase 1: MVP（当前实现）
- ✅ 反馈响应系统
- ✅ 难度调整逻辑
- ✅ 模板驱动架构
- ✅ 基础数据分析

### Phase 2: 能力扩展（3-6 个月）
- 🔄 知识问答功能
- 🔄 进度洞察功能
- 🔄 主动鼓励系统
- 🔄 多轮对话支持

### Phase 3: 智能升级（6-12 个月）
- 🔄 LLM 意图识别
- 🔄 RAG 知识检索
- 🔄 个性化推荐引擎
- 🔄 语音交互支持

---

## ✅ 实施检查清单

### 后端开发
- [ ] 数据库表创建与迁移
- [ ] Copilot Engine 核心代码
- [ ] Intent Handlers 实现
- [ ] API 路由注册
- [ ] 模板初始化脚本
- [ ] 单元测试编写

### 前端开发
- [ ] Copilot Client 实现
- [ ] React Hook 封装
- [ ] UI 组件开发
- [ ] 集成到 DayWorkoutPage
- [ ] Toast 提示实现

### 测试验证
- [ ] 单元测试通过
- [ ] 集成测试通过
- [ ] 端到端测试验证
- [ ] 用户体验测试

### 上线准备
- [ ] 文档完善
- [ ] 监控告警配置
- [ ] 数据分析看板
- [ ] 灰度发布计划

---

## 📚 参考资料

- [对话式 UI 设计最佳实践](https://www.nngroup.com/articles/conversational-ui/)
- [模板引擎设计模式](https://refactoring.guru/design-patterns/template-method)
- [RAG 系统架构](https://arxiv.org/abs/2005.11401)

---

**最后更新**: 2026-10-05  
**审核人**: AI Team  
**状态**: ✅ 架构设计完成，进入实施阶段
