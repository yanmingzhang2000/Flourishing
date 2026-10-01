# 67 个训练动作图像/视频素材外链清单（CSV Manifest）研究报告

## 摘要
本报告围绕 67 条动作文字库（`data/canonical-exercise-library.json`）补齐"图片/视频"素材外链，交付 CSV 清单 `exercise_assets_manifest.csv`（含 `exercise_id,cover_url,video_url,source,license` 及脚本维护的 `cover_status,video_status,cover_qa` 状态列）。

**实际覆盖（以 CSV 与 `素材/download_report.md` 为准）**：封面 31 条为 Pexels CDN 直链（已逐条实测 HTTP 200、已下载落盘），36 条为 Pexels 图片检索页（需人工挑图）；视频 2 条为精确定位页，65 条为检索入口（需人工挑片段）。所有 Pexels 素材适用免费可商用许可（无需署名），满足内测演示需求；商用上线前建议替换为自有拍摄或明确 CC0/CC-BY 授权素材。

> ⚠️ 更正记录：初稿曾声称"67 条封面全部为直链并验证通过"，与 CSV 实际内容不符（CSV 中仅 31 条为直链），该声明作废；本文档已按实测结果更正。

## 背景与目标
素材库已具备 RAG 所需的文字内容（肌群、禁忌、步骤、要领），但用户可见的"封面图"与"跟练演示视频"缺失。目标：按 `exercise_id` 命名规则为 67 个动作提供符合规格（封面 800×800、单张 <300KB；视频 MP4/H.264、15–30s、9:16 或 16:9、720p+、<15MB、全身可见）的素材来源，并产出可被脚本处理的 CSV。

## 素材来源策略
- 封面（静态）：首选 Pexels（`images.pexels.com` CDN 直链，`?w=800&h=800&fit=crop` 直接裁成正方形），次选 Pixabay、Unsplash。
- 跟练视频：Pexels Videos、Pixabay Videos、Coverr、Mixkit、Videvo（均免费可商用）。

## 覆盖情况（实测）

| 类型 | 数量 | 说明 |
|---|---|---|
| 封面直链（已下载验证） | 31 | `images.pexels.com` CDN，逐条 HTTP 200，全部带 800×800 裁切参数，已落盘至 `素材/images/{exercise_id}_cover.jpg` |
| 封面检索页（待人工挑图） | 36 | `pexels.com/search/...`，主要为小众/解剖位动作（蚌式、死虫、鸟狗、猫牛、体态矫正类等） |
| 视频精确定位页 | 2 | neck_side_stretch、scapular_retraction_band |
| 视频检索入口（待人工挑片段） | 65 | **原清单使用 `/videos/<slug>/` 格式，该格式非 Pexels 标准 URL，已批量更正为 `https://www.pexels.com/search/videos/<slug>/`** |

## 工具链（已落地）
- `python scripts/fetch_exercise_covers.py` — 归一化 CSV（修正视频链接格式、补齐状态列）+ 批量下载直链封面（JPEG 魔数校验、<300KB 校验、幂等跳过已存在文件）
- `素材/images/` — 已下载 31 张封面（合计约 1.9MB，最大 106KB）
- `素材/download_report.md` — 每次运行自动重写：已下载/失败/待人工处理清单
- CSV 状态列：
  - `cover_status`: `direct` | `search_page`
  - `video_status`: `exact` | `search_page`
  - `cover_qa`: 人工贴合度判定 `ok` | `mismatch` | `pending`（脚本只补默认值 `pending`，不覆盖人工结论）

## 贴合度 QA（抽查结论）
已抽查 3 张直链封面（人工目测）：

| exercise_id | 判定 | 说明 |
|---|---|---|
| dumbbell_overhead_ext | ok | 过顶臂屈伸动作正确（男性/健身房场景，品牌贴合度上线前可再评估） |
| forearm_plank | ok | 前臂平板支撑完全贴合 |
| glute_bridge / fb_glute_bridge | **mismatch** | 图为瑜伽轮式（全后弯），不是臀桥，已在 CSV 标记 `cover_qa=mismatch`，须换图 |

**31 张直链封面必须全量人工过一遍 `cover_qa` 后方可入库**（脚本无法判断动作对错）。

## 使用说明
- 封面：已下载的 31 张在 `素材/images/`；剩余 36 个动作打开 CSV 中 `cover_url` 检索页挑图，下载后重命名 `{exercise_id}_cover.jpg` 放入同目录，并把 `cover_qa` 标为 `ok`。
- 视频：打开 `video_url`（Pexels 搜索页）筛选 15–30s、全身可见、节奏正常的片段，下载为 `素材/videos/{exercise_id}.mp4`。Pexels 视频页有反爬，无法批量直链；如需批量可用 Mixkit/Pixabay 直链源。
- 重跑 `fetch_exercise_covers.py` 可幂等补齐缺失封面，不会覆盖已有文件。

## 版权与上线策略
- 内测/演示：Pexels 免费可商用、无需署名，可直接使用。
- 商用上线前：全部素材替换为自有拍摄或明确 CC0/CC-BY 授权；涉及真人肖像的，即便图库已授权，也建议在隐私条款中说明素材来源。
- **上线前必须自有化/重拍清单**：36 条检索页封面、全部 67 条视频、已标 `mismatch` 的封面。

## 结论
67 个动作的素材来源已全部登记入 CSV 并带真实状态列：31 张封面已下载落盘（全量 200 验证 + 体积校验），36 张封面和 65 条视频入口为可执行的人工任务清单（见 `素材/download_report.md`）。抽查已发现 1 个动作（glute_bridge）封面错误并标记，证明"下载后必须人工贴合度 QA"不可省略。

## 局限
1. 免费图库对小众/解剖位动作缺精确匹配，36 条仍待人工挑图。
2. Pexels 页面反爬（403），视频无法规模化抓取直链，需人工下载或改用 Mixkit/Pixabay。
3. 直链封面仅抽查 3 张，其余 28 张动作贴合度未逐一目测（CSV `cover_qa=pending`）。

## 参考来源
1. [Pexels — 免费可商用图片/视频](https://www.pexels.com)
2. [Pixabay — 免费可商用图片/视频（CC0 类）](https://pixabay.com)
3. [Mixkit — 免费可商用视频素材](https://mixkit.co)
4. [Coverr — 免费可商用视频素材](https://coverr.co)
5. [Videvo — 免费/可商用视频素材](https://www.videvo.net)
