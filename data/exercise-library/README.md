# data/exercise-library

动作库唯一数据目录（单一真相源，前后端不得另有第二数据源）。

## 文件

| 文件 | 说明 |
|---|---|
| `canonical-exercise-library.json` | 已复核的权威动作库（69 条，`library_version: initial-2026-03-20`）。任务 3 接线，本任务零改动。 |
| `exercise_assets_manifest.csv` | 动作封面/视频素材清单（授权与 QA 状态溯源） |
| `seed-exercises.json` | 新库种子样本（2 条，字段契约 = `packages/contracts` 的 `exerciseSchema`，camelCase） |

## 约定

- Schema 的唯一定义在 `packages/contracts`（Zod），本目录数据必须通过其校验。
- 封面图片位于 `apps/web/public/images/exercises/{exercise_id}_cover.jpg`（web 静态服务）。
- `canonical-exercise-library.json` 内部 `media.cover_image` 仍为旧相对路径 `./images/...`，
  任务 3 接线时统一映射为 `/images/exercises/...`，映射前**不得改写**该文件。
- 已知缺口：69 条中 2 条引用的封面不存在（`standing_scapular_depression`、
  `supine_ball_scapular_slide`），任务 3 处理。
