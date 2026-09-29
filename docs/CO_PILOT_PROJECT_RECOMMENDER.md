# Co-pilot 项目推荐器设计（已锁定）

> 决策来源：与产品评审对齐，2026-09-29
> 职能：AI 接管录入期的项目推荐（文本输入 → 项目建议），L2 人工确认
> 风险等级：低（不自动写入计划，安全仍走确定性规则）

---

## 一、功能定位

**不是**：照片体态分析、自动选项目、AI 替用户决定
**是**：根据用户自由描述的困扰，推荐 1-3 个匹配项目 + 理由，用户确认后勾选

**L2 确认原则**：AI 生成建议 → 用户看到并主动勾选 → 才进入计划生成

---

## 二、输入设计

### 2.1 强制结构化字段（安全依赖，必须显式勾选）

| 字段 | 类型 | 用途 |
|------|------|------|
| 伤病 | 多选 | 肩/肘/腕/腰/膝/颈 → 用于硬阻断危险项目 |
| 器械 | 多选 | 哑铃/弹力带/自重 → 过滤不可行项目 |
| 经验 | 单选 | 零基础/偶尔练/经常练 → 难度匹配 |

**护栏 #1**：自由文本**绝不**用于安全判断
- ❌ 用户说"肩膀有点酸" → AI 判断为 `shoulder_impingement`
- ✅ 必须显式勾选"肩部伤病"才触发排除

---

### 2.2 新增自由文本字段（仅用于推荐）

```
标题："你最想改善哪里，或有什么困扰？"
示例：
- "手臂后侧松弛，夏天不敢穿无袖"
- "小肚子突出，久坐后腰酸"
- "肩膀容易酸痛，感觉有点驼背"
- "腿粗，假胯宽明显"

限制：
- 可选字段（用户可跳过，直接手动选项目）
- 最多 200 字
- 前端不做任何意图解析，原文传给后端
```

---

## 三、处理流程（三层架构复用）

```
用户输入自由文本
  ↓
[规则层] 意图映射 + 伤病硬阻断
  - 关键词匹配："手臂/拜拜肉" → tricep_tone
  - 交叉检查：用户勾了"肩伤" + 文本提到"肩膀酸" → round_shoulder_fix 硬阻断
  - 输出：候选项目列表 + 阻断项目列表
  ↓
[库层 / RAG 等价] 项目元数据检索
  - 读取 projects 表：每个项目的 name, subtitle, target_area, description
  - 为每个候选项目准备推荐理由素材
  ↓
[LLM 层] 生成个性化推荐话术
  - Prompt：用户困扰 + 候选项目 + 项目描述 → 生成推荐理由
  - 强化认知层："隔天练让肌肉恢复更好"、"紧致塑形需要坚持 4-6 周"
  - 输出：1-3 个推荐项目 + 各自理由（50-100 字）
  ↓
前端展示 → 用户勾选确认（L2）
```

---

## 四、规则层：意图映射表

### 4.1 关键词 → 项目映射（确定性）

| 用户输入关键词 | 映射到项目 | 优先级 |
|---------------|-----------|--------|
| 手臂、拜拜肉、蝴蝶袖、粗手臂 | tricep_tone | 高 |
| 腿粗、假胯宽、大腿外侧、提臀 | hip_thigh_tone | 高 |
| 小肚子、下腹、腰腹、久坐 | lower_abs_tone | 高 |
| 肩膀酸、肩颈痛、斜方肌、富贵包 | trap_relax | 高 |
| 圆肩、驼背、含胸、体态 | round_shoulder_fix | 高 |
| 全身、入门、零基础、体能 | full_body_basic | 中 |

**匹配策略**：
- 分词后逐词匹配
- 一个输入可以命中多个项目（如"小肚子 + 手臂"）
- 最多返回 3 个候选（按优先级排序）

---

### 4.2 伤病硬阻断规则（护栏 #2）

```typescript
// 伪代码
const candidates = mapIntentToProjects(userText);
const blocked: ProjectId[] = [];

for (const projectId of candidates) {
  const eligibility = assessProjectEligibility(projectId, profile);
  
  if (eligibility.safety === 'failed') {
    blocked.push(projectId);
    candidates = candidates.filter(p => p !== projectId);
  }
}

// 推荐结果必须再过一遍 eligibility 过滤
return { recommended: candidates, blocked };
```

**示例**：
- 用户勾选"肩部伤病" + 输入"圆肩驼背" → `round_shoulder_fix` 被 `contraindications` 排除
- 返回：`blocked: ['round_shoulder_fix']` + 提示"您选择了肩部伤病，圆肩改善项目暂不适合，建议康复后再练"

---

## 五、LLM 层：推荐话术生成

### 5.1 Prompt 模板

```
你是 Flourish AI 的健身教练，专门为女性新手做居家轻器械训练指导。

用户背景：
- 训练经验：{{experience}}
- 可用器械：{{equipment}}
- 伤病情况：{{injuries}}
- 困扰描述：{{userText}}

根据规则引擎分析，推荐以下项目：
{{#each candidates}}
- {{name}}（{{subtitle}}）：目标肌群 {{target_muscles}}
{{/each}}

请为每个项目生成推荐理由（50-100字），要求：
1. 结合用户困扰解释为什么推荐
2. 用通俗语言说明训练原理（如"肱三头肌紧致后手臂视觉更纤细"）
3. 强化认知："局部紧致需要 4-6 周坚持"、"隔天练让肌肉恢复更好"
4. 避免效果承诺，用"紧致/挺拔/改善"而非"瘦/减脂"

输出 JSON 格式：
{
  "recommendations": [
    {
      "project_id": "tricep_tone",
      "reason": "..."
    }
  ]
}
```

---

### 5.2 LLM 调用参数

| 参数 | 值 |
|-----|---|
| 模型 | 通义千问 `qwen-turbo` |
| 温度 | 0.7（允许一定创造性） |
| 最大 tokens | 500 |
| 成本 | ~0.004 元/次（200 tokens） |

---

## 六、输出格式

### 6.1 API 响应结构

```typescript
interface ProjectRecommendation {
  project_id: ProjectId;
  name: string;
  subtitle: string;
  reason: string; // LLM 生成的推荐理由
  match_keywords: string[]; // 命中的关键词（可选）
}

interface RecommendationResponse {
  outcome: 'success' | 'no_match' | 'all_blocked';
  recommendations: ProjectRecommendation[]; // 1-3 个
  blocked: Array<{
    project_id: ProjectId;
    name: string;
    reason: string; // 为什么被阻断（如"肩部伤病不适合"）
  }>;
  user_input: string; // 回显用户输入
}
```

---

### 6.2 前端展示（SettingsPage onboarding 完成后）

```
┌─────────────────────────────────────────┐
│  根据你的困扰，推荐以下训练项目：          │
├─────────────────────────────────────────┤
│  ☐ 💪 拜拜肉收紧                         │
│     推荐理由：你提到手臂后侧松弛，这是   │
│     肱三头肌缺乏训练导致的。通过针对性   │
│     训练可以紧致手臂线条，4-6 周后改善   │
│     明显。建议隔天练，让肌肉充分恢复。   │
│                                          │
│  ☐ 🔥 下腹收紧                           │
│     推荐理由：久坐会导致腹横肌松弛，小   │
│     肚子突出。通过激活深层核心肌群，可   │
│     以改善体态并紧致腹部。                │
├─────────────────────────────────────────┤
│  ⚠️ 以下项目因伤病暂不推荐：              │
│  • 圆肩改善：你选择了肩部伤病，建议康复  │
│    后再练。如需恢复训练请咨询医生。      │
├─────────────────────────────────────────┤
│              [确认选择]                   │
└─────────────────────────────────────────┘
```

**交互**：
- 推荐项目默认不勾选（护栏 #3：L2 人工确认）
- 用户可以取消推荐、增加其他项目
- 点击"确认选择"后才写入 `user_profiles.selected_projects`

---

## 七、四个必须卡住的护栏

### 护栏 #1：自由文本只用于推荐，不用于安全判断

**执行**：
```typescript
// ✅ 正确
const injuries = profile.injuries; // 来自显式勾选
const blocked = checkContraindications(candidates, injuries);

// ❌ 错误
const extractedInjuries = extractInjuriesFromText(userText); // 绝不允许
```

---

### 护栏 #2：推荐结果必须再过 eligibility 过滤

**执行**：
```typescript
const candidates = mapIntentToProjects(userText);

// 强制过滤
const eligibleProjects = candidates.filter(projectId => {
  const assessment = assessProjectEligibility(projectId, profile);
  return assessment.eligible;
});
```

---

### 护栏 #3：推荐是"建议"不是"决定"，走 L2

**前端实现**：
- 推荐项目的复选框**默认不勾选**
- 显示"AI 建议"标签，区别于用户自选
- 提示文案："请确认后再开始训练"

---

### 护栏 #4：解释里延续"认知+塑形"主张

**LLM Prompt 约束**：
- ✅ "紧致手臂线条"、"改善体态"、"激活深层肌群"
- ❌ "瘦手臂"、"减脂"、"只练这个部位就能瘦"

**认知强化点**：
- 隔天练的恢复原理
- 4-6 周坚持的必要性
- 局部塑形 + 全身协调的科学性

---

## 八、评测标准（接回三层评测）

| 指标 | 通过阈值 | 评测方式 |
|-----|---------|---------|
| **推荐准确率** | ≥ 80% | 离线评测集（30个样例） |
| **采纳率** | > 50% | 内测用户勾选率 |
| **安全拦截** | 100% | 伤病+危险项目必须全阻断 |
| **话术质量** | 人工抽检 | 10 人小组评分 ≥ 4/5 |

---

### 8.1 离线评测集示例

```typescript
const EVAL_CASES = [
  {
    input: { text: "手臂后侧松弛，夏天不敢穿无袖", injuries: [] },
    expected: ["tricep_tone"],
  },
  {
    input: { text: "小肚子突出，腰酸", injuries: [] },
    expected: ["lower_abs_tone"],
  },
  {
    input: { text: "圆肩驼背", injuries: ["shoulder"] },
    expected_blocked: ["round_shoulder_fix"],
  },
  {
    input: { text: "零基础，不知道从哪开始", injuries: [] },
    expected: ["full_body_basic"],
  },
  // ... 共 30 个
];
```

---

## 九、实现优先级

### P0（MVP 必须）
- [x] 规则层：意图映射表（关键词 → 项目）
- [ ] 规则层：伤病硬阻断逻辑
- [ ] API：`POST /api/co-pilot/recommend-projects`
- [ ] 前端：SettingsPage 增加自由文本输入框
- [ ] 前端：推荐结果展示 + L2 确认交互

### P1（内测前完成）
- [ ] LLM 层：通义千问集成
- [ ] LLM 层：推荐话术生成
- [ ] 离线评测集（30 个样例）
- [ ] 采纳率埋点

### P2（优化）
- [ ] 多轮对话（用户说"还有其他推荐吗"）
- [ ] 推荐理由的 A/B 测试
- [ ] 认知层文案优化

---

## 十、与现有架构的关系

### 10.1 不冲突的点

| 现有模块 | 关系 |
|---------|------|
| `eligibility.ts` | 推荐结果必须走 `assessProjectEligibility` 过滤 ✓ |
| `plan-engine` | 推荐只影响 `selected_projects`，不改计划生成逻辑 ✓ |
| `DECISIONS.md` | 复用三层架构（规则+库+LLM），符合已锁定决策 ✓ |

---

### 10.2 新增文件清单

```
server/src/
├── co-pilot/
│   ├── intent-mapper.ts       # 规则层：关键词 → 项目映射
│   ├── recommender.ts          # 主逻辑：推荐流程
│   ├── prompt-templates.ts     # LLM prompt 模板
│   └── recommender.test.ts     # 单元测试 + 评测集
├── routes/
│   └── co-pilot.ts             # 新增：POST /recommend-projects
└── lib/
    └── llm-client.ts           # 通义千问 SDK 封装（复用）
```

---

## 十一、上线前 Checklist

- [ ] 护栏 #1-4 全部通过代码审查
- [ ] 离线评测集准确率 ≥ 80%
- [ ] 内测 10 人采纳率 > 50%
- [ ] 伤病+危险项目拦截率 100%
- [ ] LLM 话术人工抽检 ≥ 4/5 分

---

*设计锁定日期：2026-09-29*
*下一步：实现 P0 规则层 + API*
