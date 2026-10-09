# AGENTS.md · Flourish AI 重开发（根上下文）

> 本文件是 AI Coding 工具的**始终加载根入口**：只做"指针与约束"，不重复细节。
> 详细内容见 `docs/` 下各文档。**改哪归哪**，本文件保持简短。

## 1. 项目是什么

**Flourish AI — 你的 AI 健身私教**：面向女性居家塑形的 Web-first 健身产品。核心价值不是打卡工具，而是"**懂我、会调整、能陪练的 AI 私教**"。

**重开发决策（已定）**：全盘 greenfield 重做；只保留已验证的**业务知识资产**（67 条动作库经复核、训练规则引擎、安全约束、计划生成的确定性约束），其余代码/实现与线上用户数据**全部清空**，全新库 + 种子数据启动，无迁移。

## 2. 技术栈

React + TS + Vite ｜ Tailwind + shadcn/ui ｜ React Router ｜ TanStack Query ｜ React Hook Form + Zod ｜ Node + Express + TS ｜ SQLite + better-sqlite3（Drizzle 管 migration）｜ 独立 LLM Service + Provider Adapter ｜ Vitest / Testing Library / Playwright ｜ Nginx + HTTPS。

## 3. 不可妥协的红线（详见 `docs/04-SAFETY_RULES.md`）

- 训练安全是不可绕过的边界：规则引擎定计划与安全，**AI 只解释已确定的计划，不得修改安全决策、不得虚构用户数据、不得直写计划/禁忌**。
- 跟练中关节不适 → **硬阻断** + 重校验后续安排（必须 E2E 通过）。
- 所有外部输入经 Zod 校验；记录必须归属当前用户（防越权）。
- **HTTPS 必须**，JWT 不得明文传输。

## 4. 架构原则（详见 `docs/03-ARCHITECTURE.md`）

- **可扩展性是硬要求**：训练域纯函数化（零框架依赖、可单测）、LLM Provider 可替换、DB 层 SQLite→Postgres 就绪（Repository + Drizzle + **必须建索引**）、服务无状态可横向扩展、契约先行。
- 三条边界：`packages/training-domain`（纯业务）｜ `apps/server/modules`（持久化/API）｜ `apps/web/features`（页面）。`packages/contracts` 是前后端唯一契约源。
- **同一业务规则不得在前端/后端维护两个版本**。

## 5. 不得带入新版的旧债（反模式）

零索引、bcrypt 同步阻塞事件循环、无自动备份、游客/登录双实现分叉、前端 exercises.json 与后端双数据源、snake/camel 字段混用、Nginx+Express 双重静态服务、HTTP 明文、无全局错误处理/输入校验、路由参数脆弱正则。

## 6. 当前阶段与下一步

- 阶段：基线文档已定（见下），待启动**纵向切片第 1 个任务：工程初始化**（monorepo + CI + DB migration + contracts + 测试框架）。
- 开发顺序：初始化 → 设计系统+首页 → 训练域核心 → 跟练闭环 → 日历与历史 → AI Copilot → 上线验收（详见 `docs/05-ACCEPTANCE.md` §8）。

## 7. 文档地图

| 文件 | 内容 |
|---|---|
| `docs/README.md` | 决策基线 + 现状实测诊断 + 反模式清单 |
| `docs/01-PRD.md` | 定位、目标用户、V1 范围、核心闭环、AI 三层感知 |
| `docs/02-DESIGN.md` | 视觉语言、设计 Token、信息架构、首屏规则、AI UI 分布 |
| `docs/03-ARCHITECTURE.md` | 仓库结构、分层、**可扩展性**、数据流、Copilot 状态 |
| `docs/04-SAFETY_RULES.md` | 训练安全边界、关节不适阻断、AI 权限隔离（红线） |
| `docs/05-ACCEPTANCE.md` | 验收门槛、5 类 E2E、AI Coding 任务模板与红线 |

## 8. AI Coding 工作规则（每次任务遵守，详见 `docs/05-ACCEPTANCE.md` §6–§7）

- 任务提示词显式 `@` 引用相关文档，不"读所有文档"。
- 不擅自改产品需求或训练安全规则；不引入未确认的新依赖/架构模式。
- 训练安全逻辑必须有自动化测试；不得删测试/跳校验/吞异常来通过。
- 只有**实际执行并通过**的检查才能标记通过。
- 涉及计划生成、安全阻断、DB 迁移、认证的任务必须有人审查。

## 9. 工具适配

若所用 AI Coding 工具只识别特定文件名（如 `CLAUDE.md`、`.cursorrules`），在该文件名下写一行指向本文件即可，例如：
`See AGENTS.md for project context, stack, and non-negotiable safety rules.`
