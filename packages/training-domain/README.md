# @flourish/training-domain

> 纯函数训练领域包。**零框架依赖**（无 React / Express / LLM SDK）。文件系统访问（`fs`）仅允许出现在
> `exercises/loader.ts` 的加载边界内，所有其他模块必须是输入 → 输出的纯函数，可脱离 I/O 单测。

对应 `docs/03-ARCHITECTURE.md` §3.1：训练域是产品的"大脑"，也是可扩展性的根基。
安全规则的权威映射见 `docs/TASK3_ALIGNMENT.md`。

## 模块边界

| 目录 | 职责 | 对应安全规则 |
|---|---|---|
| `exercises/` | 动作库加载（fs 隔离边界）+ 按肌群/器械/难度查询的纯函数 | — |
| `safety/` | 禁忌过滤：用户伤病标签 → 排除动作/肌群（**确定性规则，不得用 LLM**） | SAFE-01 |
| `scheduling/` | 同肌群恢复间隔（≥48h）、周排期 | SAFE-02 |
| `difficulty/` | 经验等级 → 难度范围映射；反馈 → 难度调整 | SAFE-03 |
| `composition/` | 时长计算、动作数量分配、单日/周计划组装（消费用户容量字段） | SAFE-04 |
| `generator/` | 串联 exercises → safety → scheduling → difficulty → composition，输出完整计划生成结果 | 编排层，无新规则 |

## 红线

- **禁止** import `react` / `express` / 任何 LLM Provider SDK。
- **禁止**在 `safety/` `scheduling/` `difficulty/` `composition/` `generator/` 中直接 `import fs`；
  仅 `exercises/loader.ts` 可以读文件，其余模块接收已加载的数据作为参数。
- 所有导出函数必须是纯函数（无副作用、无隐藏状态）。
- 同一业务规则只在本包维护一份；`apps/server` 与 `apps/web` 不得各自实现一份校验逻辑。

## 测试

```bash
pnpm --filter @flourish/training-domain test
pnpm --filter @flourish/training-domain typecheck
```
