# 03 · ARCHITECTURE（技术架构）

> 版本：重开发 V1 基线 ｜ 状态：待技术确认 ｜ 配套：`01-PRD` `02-DESIGN` `04-SAFETY_RULES` `05-ACCEPTANCE`
> **重点：可扩展性（scalability / extensibility）是本版架构的一票通过项。**

## 1. 仓库结构（monorepo，greenfield）

```
flourish-ai/
├── apps/
│   ├── web/                     # React Web 应用（Vite + TS）
│   │   └── src/{app, pages, features, components, lib, styles}
│   └── server/                  # Express API（Node + TS）
│       └── src/{modules, shared, db, index.ts}
├── packages/
│   ├── contracts/               # 共享 DTO、Zod Schema、类型（前后端唯一契约源）
│   └── training-domain/         # 纯函数规则与领域模型（零框架依赖）
│       └── {scheduling, safety, difficulty, composition}
├── data/
│   └── exercise-library/        # 经审核的动作数据 + 版本（种子来源）
├── tests/{integration, e2e}
├── docs/{PRD, DESIGN, ARCHITECTURE, SAFETY_RULES, ACCEPTANCE}
└── package.json / README.md
```

**三条边界（核心）**：
1. `training-domain`：纯业务规则，**不依赖 React / Express / LLM**，可独立单测。这是产品的"大脑"，也是可扩展性的根基。
2. `server/modules`：鉴权、持久化、API、业务流程。
3. `web/features`：用户实际看到的页面与交互。
4. `packages/contracts`：API DTO 与 Zod Schema 单一真相源；DB 实体不直接暴露前端。

## 2. 技术选型（保留熟悉栈，消除复杂度）

| 层 | 方案 | 决策理由 |
|---|---|---|
| 前端 | React + TS + Vite | 延续积累，快速 |
| UI | Tailwind CSS + shadcn/ui | 统一组件体系，利于 AI Coding |
| 路由 | React Router | 清晰页面/路由边界 |
| 服务端状态 | TanStack Query | 统一请求/缓存/失效 |
| 表单校验 | React Hook Form + Zod | 输入校验统一（前端复用 contracts 的 Zod） |
| 后端 | Node + Express + TS | 保留熟悉架构 |
| DB | SQLite + better-sqlite3 | 单实例 MVP 轻量；**访问必须异步/非阻塞，禁止同步长阻塞** |
| Migration | Drizzle ORM + Drizzle Kit | 类型化查询 + 可追踪 schema 迁移 |
| AI | 独立 LLM Service + Provider Adapter | 供应商可替换，安全逻辑与模型解耦 |
| 测试 | Vitest + Testing Library + Playwright | 规则/组件/E2E |
| 部署 | Nginx + HTTPS + Node | 静态资源与 API 职责分明 |

> 不为重构而换栈。SQLite 适合单实例；未来多实例横向扩展再评估 Postgres——不要因为"用户增长"就机械切库（见 §5 演进路径）。

## 3. 可扩展性设计（本版硬要求）

### 3.1 训练域纯函数化（最重要）
`packages/training-domain` 全部为纯函数（输入 → 输出，无副作用、无 I/O）。好处：
- 可被 server、未来 worker、测试、**甚至前端预览**复用，逻辑单一真相。
- 极易单测与并行化；规则演进不影响基础设施。
- **禁止**在前端/后端分别维护不同版本的同一条规则（旧债之一）。

### 3.2 LLM Provider Adapter（模型可替换）
```ts
interface LLMProvider {
  chat(req: ChatRequest): Promise<ChatResponse>;
  stream(req: ChatRequest): AsyncIterable<ChatChunk>;
}
// 实现：SiliconFlowProvider / OpenAIProvider / MockProvider(测试)
// 选择：配置驱动；未来可加模型路由（按任务选模型、按成本降级）
```
- 任何 LLM 调用必须经 `LLMService`，**禁止**业务代码直接 import 供应商 SDK。
- 超时 / 重试 / 降级（fallback 模板）在 `LLMService` 统一处理，不散落各处。

### 3.3 DB 层可演进（SQLite → Postgres 就绪）
- 通过 Drizzle + Repository 模式隔离数据访问；业务代码不直接写 SQL 字符串。
- 当前 `better-sqlite3`（sync API 但用异步封装避免阻塞事件循环）；切 Postgres 仅换 dialect + 连接，Repository 接口不变。
- **必须建立索引**（旧债：零索引导致线性退化）：`training_records(user_id, created_at)`、`(user_id, completed, created_at)`、`weekly_plans(user_id, start_date)`、`project_instances(user_id, status)`、`copilot_messages(session_id, created_at)`。

### 3.4 服务无状态 + 横向扩展预留
- server 不持有训练会话/计划生成的状态；状态在 DB / 客户端。
- 未来多实例只需前置负载均衡 + 共享 DB，无需 sticky session。
- 异步任务（训练后分析、通知、周报）预留事件/队列接口（MVP 可同步，但接口留好），避免未来改造成重写。

### 3.5 契约先行 + 模块化
- `packages/contracts` 的 Zod Schema 前后端共享，API 字段命名**统一**（旧债：snake/camel 混用）。
- server 按 domain 分 module（auth/users/exercises/plans/workouts/records/copilot），各自拥有边界，禁止跨 module 直读对方 DB 表。

### 3.6 Copilot 权限隔离（安全 + 扩展）
- Copilot **不拥有**可直写计划/禁忌的通用工具接口。
- 它只能请求业务 service 执行**受限操作**，业务 service 自行校验权限/输入/规则。
- 新增 AI 能力 = 在 `copilot` module 注册一个新受限操作，不改动核心域。

### 3.7 可观测与配置
- 结构化日志（请求/LLM 调用/异常）；敏感数据（JWT、密码、隐私）**不进日志**。
- 配置驱动 feature flag，为未来实验（如计划密度 A/B）留接口。

## 4. 核心数据流（计划生成链路）

```
用户资料 + 训练历史 + 当日反馈
   │
   ▼  packages/training-domain（纯函数）
确定性规则引擎：禁忌过滤 → 恢复间隔 → 难度约束 → 排期
   │
   ▼  exercises module（只读 exercise-library，按适用条件校验）
动作检索 + 计划组装（仅选通过校验的动作）
   │
   ▼  safety module（硬校验，不可绕过）
安全校验（禁忌/恢复/容量）
   │
   ▼  DB 持久化（repository，带索引）
持久化
   │
   ▼  LLMService（只解释已确定计划）
AI 个性化解释 + 训练复盘
```
**安全校验不在生成时只跑一次**：跟练中反馈关节不适，须立即阻断不适动作并重校验后续安排。

## 5. 演进路径（不提前过度设计）

| 阶段 | 形态 | 触发条件 |
|---|---|---|
| V1 | 单实例 SQLite + 同步(异步封装) server | 起步，用户量小 |
| V1.5 | 加缓存（动作库读多）、结构化监控 | 数据/请求增长 |
| V2 | 切 Postgres（仅换 dialect+连接）、server 多实例 | 写入并发 / 多实例需求 |
| V2+ | 异步队列（训练后分析/通知/周报） | 出现重后台任务 |

> 原则：**现在不为未来写全套，但现在的边界要让未来切换是"换实现"而非"重写"。**

## 6. Copilot 状态管理（修旧债）

- 不再由多个 `useEffect` 互踩同一 `isOpen`。
- 分离：`对话会话数据`（Copilot session state）｜`桌面侧栏展开`｜`移动浮层打开`（Copilot UI Controller 集中所有权）。
- 同一时刻只渲染适配当前视口的单一交互容器；路由切换/会话切换/关闭行为有约定。
- V1 不引入 XState；集中所有权 + 明确状态模型 + 测试即可。

## 7. 反模式 / 不得带入新版（来自审计）

- ❌ bcrypt 同步阻塞事件循环（用 `await bcrypt.hash/compare`）。
- ❌ 数据库零索引、无自动备份（cron + 异地/对象存储）。
- ❌ 游客/登录双实现逻辑分叉（统一 `DataAdapter` 接口）。
- ❌ 前端 `exercises.json` 与后端双数据源（唯一真相在 `data/exercise-library`）。
- ❌ 重复常量/逻辑多副本（抽 `shared/`）。
- ❌ Nginx 与 Express 双重静态服务（Express 只处理 API）。
- ❌ HTTP 明文（必须 HTTPS）。
- ❌ 无全局错误处理中间件、无输入校验（Zod 中间件）。
- ❌ 路由参数脆弱正则判断（用显式路由/query）。

## 8. 部署与恢复

- Nginx 终结 HTTPS + SPA fallback；Express 仅 API。
- 每日自动备份 DB 到对象存储；**上线前完成一次实际恢复演练**（见 `05-ACCEPTANCE`）。
- CI：类型检查 + 测试 + 生产构建；PR 需过检查再合并。
