# RAG AI 实施路线图

> 状态：规划阶段，暂不开发  
> 创建时间：2026-10-04  
> 最后更新：2026-10-04

---

## 一、背景与动机

### 1.1 当前系统架构

Flourish AI 采用**三层架构**（参考 PRODUCT_LOGIC.md §五）：

```
┌─────────────────────────────────────────────────────────┐
│                    规则引擎（核心）                       │
│  - 禁忌排除（确定性）                                     │
│  - 时长计算（公式）                                       │
│  - 48h 恢复排期                                          │
│  - 动作数量决策（新增）                                   │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    RAG 知识库（动作库）                   │
│  - 动作库 JSON（89条）                                   │
│  - 禁忌标签映射                                          │
│  - 肌群/器械/难度索引                                     │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    LLM（仅个性化文案）                   │
│  - 入职问卷分析                                          │
│  - 个性化鼓励语                                          │
│  - 训练反馈分析                                          │
└─────────────────────────────────────────────────────────┘
```

### 1.2 为什么需要 RAG AI

**核心问题：** 规则引擎无法处理复杂的、需要综合考量的个性化决策。

**典型场景：**

**场景 1：动作数量个性化**
```
用户 A（初学者）：
- 完成率 100%，经常反馈"太轻松"
- 规则引擎：3 个动作（固定）
- RAG AI：建议 4 个动作（基于历史表现）

用户 B（初学者）：
- 完成率 60%，经常反馈"太难"
- 规则引擎：3 个动作（固定）
- RAG AI：建议 2 个动作（降低负担）
```

**场景 2：多项目组合优化**
```
用户选择：拜拜肉 + 下腹 + 圆肩（3 个项目）
限制：肩伤 + 30 分钟时间

规则引擎：
- 拜拜肉：2 个动作
- 下腹：2 个动作
- 圆肩：2 个动作
- 问题：肩伤可能导致拜拜肉和圆肩动作不足

RAG AI：
- 分析：拜拜肉和圆肩都涉及肩部，肩伤限制较大
- 建议：
  - 拜拜肉：1 个动作（选择肩部压力小的）
  - 下腹：3 个动作（不受肩伤影响，可以多练）
  - 圆肩：1 个动作（轻量拉伸为主）
- 理由：在时间和伤病约束下的最优分配
```

**场景 3：渐进式训练计划**
```
用户训练历史（6 周）：
- 第 1-2 周：2 个动作，完成率 100%
- 第 3-4 周：3 个动作，完成率 95%
- 第 5-6 周：3 个动作，反馈"可以增加强度"

规则引擎：继续 3 个动作（不变）
RAG AI：建议第 7 周增加到 4 个动作，并解释渐进原因
```

---

## 二、RAG AI 适用范围

### 2.1 ✅ 适合用 RAG AI 的决策

| 决策点 | 复杂度 | 个性化需求 | RAG 价值 | 优先级 |
|-------|--------|-----------|---------|--------|
| **动作数量** | 中 | 高 | ⭐⭐⭐⭐ | P1 |
| **动作选择顺序** | 中 | 中 | ⭐⭐⭐ | P2 |
| **训练强度调整** | 高 | 高 | ⭐⭐⭐⭐⭐ | P1 |
| **多项目时间分配** | 高 | 高 | ⭐⭐⭐⭐ | P1 |
| **渐进式计划生成** | 高 | 高 | ⭐⭐⭐⭐⭐ | P2 |
| **个性化文案** | 低 | 中 | ⭐⭐⭐ | P3 |

### 2.2 ❌ 不适合用 RAG AI 的决策

**安全相关（必须 100% 确定性）：**
- ❌ 伤病动作排除
- ❌ 器械匹配检查
- ❌ 最小/最大动作数边界
- ❌ 48 小时恢复规则

**简单计算（不需要 AI）：**
- ❌ 时间预算计算（数学公式）
- ❌ 组数次数计算
- ❌ 训练日排期

---

## 三、技术方案

### 3.1 架构设计：分层决策模型

```typescript
// 第一层：硬性规则（安全门槛）
function applySafetyRules(profile: NormalizedProfile, library: ExerciseLibrary) {
  return {
    minExercises: 2,
    maxExercises: Math.min(5, getAvailableExerciseCount(profile, library)),
    excludedExercises: getExcludedByInjury(profile.injuries),
    requiredEquipment: profile.equipment,
  };
}

// 第二层：基础计算（时间预算）
function calculateTimeBudget(profile: NormalizedProfile, totalProjects: number) {
  const availableMinutes = (profile.session_max_min || 30) - 10; // 扣除热身和拉伸
  const minutesPerExercise = 8;
  const totalExercises = Math.floor(availableMinutes / minutesPerExercise);
  
  return {
    suggestedTotal: totalExercises,
    perProject: Math.max(2, Math.min(4, Math.floor(totalExercises / totalProjects))),
  };
}

// 第三层：RAG AI 优化（个性化调整）
async function optimizeWithAI(
  profile: NormalizedProfile,
  baseRecommendation: TimeBasedRecommendation,
  context: UserContext
): Promise<AIRecommendation> {
  
  // 1. 检索相似用户案例
  const similarUsers = await vectorDB.findSimilar({
    experience: profile.experience,
    completionRate: context.completionRate,
    feedback: context.recentFeedback,
    timePreference: profile.session_max_min,
  }, topK: 10);
  
  // 2. 构建 RAG 上下文
  const ragContext = {
    user: {
      experience: profile.experience,
      completionRate: context.completionRate,
      recentFeedback: context.recentFeedback,
      trainingWeeks: context.trainingWeeks,
      timeAvailable: profile.session_max_min,
      goals: profile.selected_projects,
      injuries: profile.injuries,
    },
    baseRecommendation: {
      count: baseRecommendation.perProject,
      min: baseRecommendation.min,
      max: baseRecommendation.max,
    },
    similarCases: similarUsers.map(u => ({
      profile: u.profile,
      optimalCount: u.optimalExerciseCount,
      satisfaction: u.satisfactionScore,
    })),
    constraints: {
      totalProjects: profile.selected_projects.length,
      availableExercisesPerProject: context.availablePerProject,
    }
  };
  
  // 3. LLM 推荐
  const prompt = buildPrompt(ragContext);
  const response = await llmService.complete(prompt);
  
  return {
    count: response.recommendedCount,
    adjustmentReason: response.reason,
    userMessage: response.userMessage, // "根据您的反馈，本周增加了 1 个动作"
    confidence: response.confidence,
  };
}

// 最终决策函数
async function decideExerciseCount(
  profile: NormalizedProfile,
  totalProjects: number,
  config: SystemConfig
): Promise<number> {
  
  // 1. 安全规则（必须通过）
  const safety = applySafetyRules(profile, library);
  
  // 2. 时间计算（基础推荐）
  const budget = calculateTimeBudget(profile, totalProjects);
  
  // 3. AI 优化（可选，需要足够历史数据）
  if (config.enableAI && hasEnoughHistory(profile)) {
    try {
      const context = buildUserContext(profile);
      const aiRecommendation = await optimizeWithAI(profile, budget, context);
      
      // AI 推荐必须在安全范围内
      const finalCount = clamp(
        aiRecommendation.count,
        safety.minExercises,
        safety.maxExercises
      );
      
      // 记录 AI 推荐日志
      logAIRecommendation(profile.user_id, aiRecommendation);
      
      return finalCount;
    } catch (error) {
      // AI 失败时降级到规则引擎
      logger.warn('AI recommendation failed, fallback to rule-based', error);
    }
  }
  
  // 4. 降级方案（无 AI 或新用户）
  return clamp(budget.perProject, safety.minExercises, safety.maxExercises);
}
```

### 3.2 技术栈选型

#### 方案 A：轻量 LLM（推荐 Phase 2）

**技术选择：**
- OpenAI GPT-4o-mini
- 或 Claude 3 Haiku（更快，成本更低）

**优点：**
- ✅ 实现简单，1-2 周可上线
- ✅ 成本低（每次调用 $0.0001-0.0005）
- ✅ 灵活，容易调整 prompt
- ✅ 无需维护模型和数据库

**缺点：**
- ⚠️ 响应速度慢（1-3 秒）
- ⚠️ 需要 API key 和联网
- ⚠️ 无法离线运行

**适用场景：**
- MVP 后 3-6 个月
- 有 500+ 用户的训练数据
- 验证 AI 价值阶段

---

#### 方案 B：向量数据库 + RAG（推荐 Phase 3）

**技术选择：**
- 向量数据库：Qdrant / Pinecone / Weaviate
- Embedding 模型：OpenAI text-embedding-3-small
- LLM：GPT-4o-mini 或本地模型（Llama 3）

**优点：**
- ✅ 基于真实用户数据
- ✅ 可以检索相似案例
- ✅ 可选离线运行（本地模型）
- ✅ 更准确的个性化

**缺点：**
- ⚠️ 实现复杂（3-4 周开发）
- ⚠️ 需要足够数据（5000+ 用户）
- ⚠️ 维护成本高（数据库、模型更新）

**适用场景：**
- 产品成熟期（1 年后）
- 有大量历史数据
- 有专职 AI 工程师维护

---

#### 方案 C：混合方案（推荐✅）

**实施策略：**
```
Phase 1（当前）：规则引擎
├─ 新用户 → 根据时间计算动作数量
└─ 老用户 → 同样使用规则引擎

Phase 2（3-6 个月）：轻量 AI
├─ 新用户 → 规则引擎
└─ 老用户（有历史）→ LLM 调整（±1 个动作）

Phase 3（1 年后）：完整 RAG
├─ 新用户 → 规则引擎
└─ 老用户 → 向量检索 + LLM 推荐
```

---

## 四、实施路线图

### Phase 1：规则引擎（当前）✅

**时间：** 已完成

**内容：**
```typescript
function getStrengthExerciseCount(
  profile: NormalizedProfile,
  totalProjects: number
): number {
  const maxMinutes = profile.session_max_min || 30;
  const availableMinutes = Math.max(maxMinutes - 10, 15);
  const minutesPerExercise = 8;
  const totalExercises = Math.floor(availableMinutes / minutesPerExercise);
  const perProject = Math.max(2, Math.min(4, Math.floor(totalExercises / totalProjects)));
  
  return perProject;
}
```

**优点：**
- ✅ 简单、快速、可靠
- ✅ 无依赖，无成本
- ✅ 适合 MVP 阶段

**局限：**
- ⚠️ 无法个性化
- ⚠️ 不考虑用户历史表现

---

### Phase 2：轻量 AI 增强（3-6 个月后）

**前提条件：**
- ✅ 有 500+ 用户的训练数据
- ✅ 收集了用户反馈（太轻松/太难/动作太少）
- ✅ 验证了规则引擎的不足

**实施步骤：**

**2.1 数据收集（1 周）**
```sql
-- 用户训练历史表
CREATE TABLE training_history (
  user_id INTEGER,
  week_number INTEGER,
  exercise_count INTEGER,
  completion_rate REAL, -- 0.0-1.0
  feedback TEXT,        -- 'too_easy', 'just_right', 'too_hard', 'too_few_exercises'
  satisfaction_score INTEGER -- 1-5
);

-- 收集指标
SELECT 
  user_id,
  AVG(completion_rate) as avg_completion,
  COUNT(*) as total_weeks,
  AVG(satisfaction_score) as avg_satisfaction
FROM training_history
GROUP BY user_id;
```

**2.2 AI 服务实现（1 周）**
```typescript
// server/src/services/ai-recommendation.ts

interface AIRecommendationService {
  async adjustExerciseCount(
    profile: NormalizedProfile,
    baseCount: number,
    history: UserTrainingHistory
  ): Promise<{
    adjustment: -1 | 0 | 1;
    reason: string;
    userMessage: string;
  }>;
}

class OpenAIRecommendationService implements AIRecommendationService {
  async adjustExerciseCount(profile, baseCount, history) {
    const prompt = `
你是一个专业的健身教练，根据用户的训练历史，建议是否调整动作数量。

用户信息：
- 经验等级：${profile.experience}
- 当前建议动作数：${baseCount}

训练历史（最近 4 周）：
- 平均完成率：${history.avgCompletionRate * 100}%
- 反馈统计：${JSON.stringify(history.feedbackStats)}
- 满意度：${history.avgSatisfaction}/5

请判断：
1. 是否需要调整动作数量？（-1 减少 / 0 保持 / +1 增加）
2. 调整理由（30 字以内）
3. 给用户的提示信息（20 字以内）

返回 JSON 格式：
{
  "adjustment": -1 | 0 | 1,
  "reason": "理由",
  "userMessage": "提示信息"
}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "你是健身教练，帮助用户优化训练计划。" },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });
    
    return JSON.parse(response.choices[0].message.content);
  }
}
```

**2.3 集成到 composition.ts（1 周）**
```typescript
// 在 assembleTrainingDay 中调用

async function assembleTrainingDay(...) {
  // ... 现有逻辑
  
  const baseCount = getStrengthExerciseCount(profile, projects.length);
  let finalCount = baseCount;
  
  // AI 调整（仅对老用户）
  if (config.enableAI && hasEnoughHistory(profile)) {
    const history = await getUserTrainingHistory(profile.user_id);
    const aiAdjustment = await aiService.adjustExerciseCount(profile, baseCount, history);
    finalCount = clamp(baseCount + aiAdjustment.adjustment, 2, 5);
    
    // 记录 AI 决策日志
    logger.info('AI adjusted exercise count', {
      userId: profile.user_id,
      baseCount,
      adjustment: aiAdjustment.adjustment,
      finalCount,
      reason: aiAdjustment.reason,
    });
  }
  
  // 使用 finalCount 生成动作...
}
```

**2.4 A/B 测试（2 周）**
- 50% 用户使用规则引擎
- 50% 用户使用 AI 增强
- 对比指标：完成率、满意度、留存率

**成本估算：**
- 开发时间：3 周
- API 成本：~$0.0003/次 × 10,000 次/月 = $3/月
- 基础设施：无额外成本

---

### Phase 3：完整 RAG 系统（1 年后）

**前提条件：**
- ✅ 有 5000+ 用户的完整训练周期数据
- ✅ Phase 2 证明了 AI 的价值
- ✅ 有专职 AI 工程师

**实施步骤：**

**3.1 向量数据库搭建（2 周）**
```typescript
// 用户画像向量化
interface UserEmbedding {
  userId: number;
  vector: number[]; // 384 维
  metadata: {
    experience: string;
    avgCompletionRate: number;
    avgSatisfaction: number;
    optimalExerciseCount: number;
  };
}

// 构建向量
async function buildUserEmbedding(user: UserProfile): Promise<number[]> {
  const text = `
    Experience: ${user.experience}
    Completion Rate: ${user.avgCompletionRate}
    Feedback: ${user.recentFeedback.join(', ')}
    Time Preference: ${user.session_max_min} minutes
    Projects: ${user.selected_projects.join(', ')}
  `;
  
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  
  return response.data[0].embedding;
}

// 存储到向量数据库
async function indexUser(user: UserProfile) {
  const vector = await buildUserEmbedding(user);
  await qdrant.upsert({
    collection: 'user_profiles',
    points: [{
      id: user.user_id,
      vector: vector,
      payload: {
        experience: user.experience,
        avgCompletionRate: user.avgCompletionRate,
        optimalExerciseCount: user.optimalExerciseCount,
      }
    }]
  });
}
```

**3.2 相似用户检索（1 周）**
```typescript
async function findSimilarUsers(
  profile: NormalizedProfile,
  topK: number = 10
): Promise<SimilarUser[]> {
  
  const queryVector = await buildUserEmbedding(profile);
  
  const results = await qdrant.search({
    collection: 'user_profiles',
    vector: queryVector,
    limit: topK,
    filter: {
      must: [
        { key: 'experience', match: { value: profile.experience } }
      ]
    }
  });
  
  return results.map(r => ({
    userId: r.id,
    similarity: r.score,
    optimalExerciseCount: r.payload.optimalExerciseCount,
    completionRate: r.payload.avgCompletionRate,
  }));
}
```

**3.3 RAG 推荐（1 周）**
```typescript
async function ragRecommendExerciseCount(
  profile: NormalizedProfile,
  baseCount: number
): Promise<AIRecommendation> {
  
  // 1. 检索相似用户
  const similarUsers = await findSimilarUsers(profile, 10);
  
  // 2. 构建 RAG 上下文
  const context = {
    baseRecommendation: baseCount,
    similarCases: similarUsers.map(u => ({
      optimalCount: u.optimalExerciseCount,
      completionRate: u.completionRate,
      similarity: u.similarity,
    })),
  };
  
  // 3. LLM 推荐
  const prompt = `
基于以下相似用户的成功案例，推荐最佳动作数量：

基础建议：${baseCount} 个动作

相似用户案例（按相似度排序）：
${similarUsers.map((u, i) => `
  ${i+1}. 最佳动作数：${u.optimalExerciseCount}，完成率：${(u.completionRate*100).toFixed(0)}%，相似度：${(u.similarity*100).toFixed(0)}%
`).join('\n')}

请推荐：
1. 最佳动作数量（2-5 之间）
2. 推荐理由
3. 置信度（0-1）

返回 JSON。
  `;
  
  const response = await llmService.complete(prompt);
  
  return {
    count: response.recommendedCount,
    reason: response.reason,
    confidence: response.confidence,
  };
}
```

**成本估算：**
- 开发时间：4-6 周
- 向量数据库：Qdrant Cloud ~$25/月 或自建
- Embedding API：~$0.0001/用户 × 5000 = $0.50/月
- LLM API：~$3/月
- **总成本：~$30/月**

---

## 五、评估指标

### 5.1 技术指标

| 指标 | 规则引擎 | Phase 2 AI | Phase 3 RAG | 目标 |
|-----|---------|-----------|------------|------|
| 响应时间 | <10ms | <2s | <3s | <3s |
| 准确率 | N/A | 70%+ | 85%+ | 80%+ |
| 成本/用户 | $0 | $0.0003 | $0.001 | <$0.01 |
| 可用性 | 99.9% | 99% | 99% | 99%+ |

### 5.2 业务指标

| 指标 | Phase 1 基线 | Phase 2 目标 | Phase 3 目标 |
|-----|-------------|-------------|-------------|
| 训练完成率 | 75% | 80% | 85% |
| 用户满意度 | 3.5/5 | 4.0/5 | 4.5/5 |
| 30 天留存率 | 40% | 45% | 50% |
| 反馈"动作太少" | 15% | 8% | 5% |

### 5.3 A/B 测试框架

```typescript
// 实验配置
const experiment = {
  name: 'ai_exercise_count_v1',
  variants: [
    { name: 'control', weight: 0.5, useAI: false },
    { name: 'treatment', weight: 0.5, useAI: true },
  ],
  metrics: [
    'completion_rate',
    'satisfaction_score',
    'retention_30d',
    'feedback_too_few',
  ],
  duration: 14, // 天
  minSampleSize: 500, // 每组至少 500 用户
};

// 分配逻辑
function assignVariant(userId: number): 'control' | 'treatment' {
  const hash = hashCode(userId);
  return (hash % 100) < 50 ? 'control' : 'treatment';
}
```

---

## 六、风险与缓解

### 6.1 技术风险

**风险 1：AI 推荐不准确**
- 影响：用户体验下降，完成率降低
- 缓解：
  - Phase 2 只允许 ±1 调整（不会偏离太远）
  - 保留规则引擎作为降级方案
  - A/B 测试验证再全量

**风险 2：响应速度慢**
- 影响：用户等待时间长
- 缓解：
  - 异步处理：先返回规则引擎结果，AI 结果下次生效
  - 缓存：相似用户的推荐结果缓存 24 小时
  - 超时降级：AI 超过 3 秒自动降级

**风险 3：API 成本超预算**
- 影响：运营成本增加
- 缓解：
  - 仅对有历史数据的用户启用 AI（约 30%）
  - 设置每日调用上限
  - 监控成本，超标自动降级

### 6.2 业务风险

**风险 4：数据不足**
- 影响：AI 无法学习有效模式
- 缓解：
  - Phase 2 要求至少 500 用户数据
  - Phase 3 要求至少 5000 用户数据
  - 数据不足时延后 AI 上线

**风险 5：用户隐私**
- 影响：用户担心数据被滥用
- 缓解：
  - 匿名化：向量数据库不存储敏感信息
  - 透明：告知用户 AI 如何使用数据
  - 可选：允许用户关闭 AI 推荐

---

## 七、决策检查清单

### 何时启动 Phase 2（轻量 AI）

- [ ] 有 500+ 活跃用户
- [ ] 收集了至少 4 周的训练反馈数据
- [ ] 规则引擎存在明显不足（用户反馈"不够个性化"）
- [ ] 有预算支持 AI API 成本（~$3-10/月）
- [ ] 有开发资源（1 名工程师 3 周）

### 何时启动 Phase 3（完整 RAG）

- [ ] 有 5000+ 用户和完整训练周期数据
- [ ] Phase 2 证明了 AI 的价值（完成率提升 5%+）
- [ ] 有专职 AI 工程师或外部顾问
- [ ] 有预算支持向量数据库和模型维护（~$30-50/月）
- [ ] 规则引擎 + 轻量 AI 无法满足个性化需求

---

## 八、参考资料

### 8.1 内部文档
- [PRODUCT_LOGIC.md](./PRODUCT_LOGIC.md) - 产品逻辑和架构
- [ACTION_LIBRARY_SPEC.md](./ACTION_LIBRARY_SPEC.md) - 动作库规范
- [EVAL_SET.md](./EVAL_SET.md) - 评测集

### 8.2 技术参考
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Qdrant Vector Database](https://qdrant.tech/documentation/)
- [LangChain RAG Guide](https://python.langchain.com/docs/use_cases/question_answering/)

### 8.3 健身训练科学
- ACSM Guidelines for Exercise Prescription
- NSCA Essentials of Personal Training

---

## 九、总结

### 当前状态（Phase 1）
- ✅ 规则引擎实现完成
- ✅ 根据训练时长计算动作数量
- ✅ 简单、可靠、零成本

### 下一步（Phase 2 - 3-6 个月后）
- 🔄 收集用户训练数据和反馈
- 🔄 验证规则引擎的不足
- 🔄 实施轻量 AI 增强
- 🔄 A/B 测试验证价值

### 长期愿景（Phase 3 - 1 年后）
- 🎯 完整 RAG 系统
- 🎯 基于相似用户案例推荐
- 🎯 持续学习和优化

**关键原则：**
1. **安全优先**：AI 不能突破安全规则
2. **渐进演进**：先规则后 AI，先轻后重
3. **数据驱动**：有数据才启动 AI
4. **降级保护**：AI 失败自动降级

---

*文档结束*
