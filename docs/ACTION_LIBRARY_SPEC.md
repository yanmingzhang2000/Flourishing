# 动作库标注规范与内容管线

> 关联文档：PRODUCT_LOGIC_v2.1_修订版.md（§十七）
> 核心前提（决议 18）：**当前第一优先级是内容管线 + QA，不是 Agent。** 动作库 50-100 条需正确标注肌群/禁忌/难度；来源未定，先建管线与规范，再上 AI。

---

## 一、为什么先做这个

RAG 护栏的可靠性 = 知识正确性 × 检索准确性 × 强制执行。其中**知识正确性排第一**：只要有一条动作漏标 `shoulder_impingement`，肩伤用户就会被推荐危险动作。所以动作库标注质量直接决定产品安全底线，优先级高于模型选型。

---

## 二、标注 Schema（每条动作的字段规范）

| 字段 | 类型 | 取值 / 约束 | 说明 |
|------|------|------------|------|
| `exercise_id` | string | 唯一，snake_case | 如 `dumbbell_lateral_raise` |
| `name` / `name_en` | string | 中文 + 英文 | 显示用 |
| `muscle_group.primary` | array | 标准肌群名 | 主要发力肌群 |
| `muscle_group.secondary` | array | 标准肌群名 | 次要参与肌群 |
| `difficulty` | int | **1-5**（决议 15） | 动作绝对难度 |
| `equipment` | array | 引用 `equipment.id` | 所需器械规格 |
| `function.primary` | string | 自由文本 | 主要效果（紧致/挺拔/放松） |
| `function.secondary` | string | 自由文本 | 次要效果 |
| `category` | enum | strength / warmup / stretch / cardio | 动作类别 |
| `target_projects` | array | 引用 `projects.id` | 归属项目（多对多） |
| `contraindications` | array | 病症标签（见 §四） | **安全关键字段** |
| `rest_seconds` | int | 建议组间休息 | 默认 45 |
| `steps` | array | 有序步骤文本 | 跟练用 |
| `tips` | array | 要点文本 | 防伤要点 |
| `warning` | string | 风险提示 | 与 contraindications 对应 |

### 标准肌群词表（统一命名，避免标注歧义）
```
肩部：三角肌前束 / 三角肌中束 / 三角肌后束 / 斜方肌上束 / 冈上肌
手臂：肱二头肌 / 肱三头肌 / 前臂
胸背：胸大肌 / 背阔肌 / 斜方肌中下束 / 菱形肌 / 竖脊肌
核心：腹直肌 / 腹横肌 / 腹斜肌 / 下背
臀腿：臀大肌 / 臀中肌 / 股四头肌 / 腘绳肌 / 内收肌 / 小腿三头肌
全身：多肌群协同
```

---

## 三、器械主数据表（equipment，12 类）

| id 示例 | category | name | spec |
|---------|----------|------|------|
| `bodyweight` | 自重 | 无器械 | any |
| `dumbbell_0.5kg` ~ `dumbbell_5kg` | dumbbell | 哑铃 | 0.5/1/1.5/2/3/5 kg |
| `band_light` / `band_mid` / `band_heavy` | band | 弹力带 | 轻/中/重 |
| `rope_light` / `rope_mid` / `rope_heavy` | rope | 弹力绳 | 轻/中/重 |
| `mat_6mm` / `mat_8mm` / `mat_10mm` | mat | 瑜伽垫 | 6/8/10 mm |
| `foam_roller_spike` / `foam_roller_plain` | foam | 泡沫轴 | 狼牙/普通 |
| `rope_skip_weighted` / `rope_skip_normal` | skip | 跳绳 | 负重/普通 |
| `kettlebell_2kg` ~ `kettlebell_8kg` | kettlebell | 壶铃 | 2/4/6/8 kg |
| `door_pull` | door_pull | 拉力带 | 门框式 |
| `yoga_block` | block | 瑜伽砖 | 辅助 |
| `yoga_ball_55` / `65` / `75` | ball | 瑜伽球 | 55/65/75 cm |
| `trx` | trx | TRX 悬挂带 | 进阶 |

---

## 四、伤病映射表（确定性排除，决议 6）

用户伤病选项（维度1）：`肩 / 颈 / 肘 / 腕 / 腰 / 膝`

| 用户选择 | 展开病症标签 | 排除条件 |
|---------|------------|---------|
| 肩 | `shoulder_impingement`, `rotator_cuff` | 动作 `contraindications` 含任一即排除 |
| 颈 | `neck_pain` | 同上 |
| 肘 | `elbow_pain` | 同上 |
| 腕 | `wrist_pain` | 同上 |
| 腰 | `lower_back`, `sciatica` | 同上 |
| 膝 | `knee_pain`, `meniscus` | 同上 |

> 执行：用户勾选 → 展开标签 → 任何动作 `contraindications` 命中即**确定性排除**（不依赖 LLM 判断）。LLM 仅生成解释话术。

---

## 五、难度与经验映射（决议 15）

| 用户经验 | 目标难度区间 (1-5) | 组数 | 次数 | 休息 |
|---------|------------------|------|------|------|
| 零基础 | 1-2 | 2-3 | 8-12 | 60s |
| 偶尔练 | 2-3 | 3 | 12-15 | 45s |
| 经常练 | 3-4 | 3-4 | 15-20 | 30s |

---

## 六、内容来源策略（决议 18：暂无可靠来源 → 先建管线）

推荐路径（按可靠性排序）：
1. **自有教练 / 合作健身专家**：最优先，直接产出带正确标注的内容。
2. **公开权威资料 + 人工校验**：如 ACE/NASM 动作库、专业健身书籍，由具备资质人员校验后入库。
3. **（不推荐）纯 AI 生成草稿**：仅作辅助，必须经人工校验，禁止直接入库。

> 禁止：未校验的 AI 生成内容直接进入 RAG——护栏会基于错误知识放行危险动作。

---

## 七、标注流程与 QA

```
1. 采集：从来源获取动作原始信息（名称/步骤/肌群/禁忌）
2. 标注：按 §二 Schema 填写，肌群用词表（§二）对齐
3. 一审：标注人自查 contraindications 与 equipment.id 合法性
4. 二审（QA）：具备资质人员抽检，抽检比例 ≥ 20%
5. 入库：写入动作库 JSON，建立 exercise_projects 关联
6. 回归：每条新动作加入评测集（§八 / 评测集样例.md）
```

QA 重点（安全相关，零容忍）：
- `contraindications` 是否完整（漏标即高危）
- `muscle_group` 是否与 `target_projects` 一致
- `equipment` 是否引用合法 `equipment.id`

---

## 八、种子样例（已校验格式示范，MVP 首批 ≥30 条之一）

```json
{
  "exercise_id": "dumbbell_lateral_raise",
  "name": "哑铃侧平举",
  "name_en": "Dumbbell Lateral Raise",
  "muscle_group": { "primary": ["三角肌中束"], "secondary": ["斜方肌上束", "三角肌前束"] },
  "difficulty": 2,
  "equipment": ["dumbbell_1kg", "dumbbell_1.5kg", "dumbbell_2kg"],
  "function": { "primary": "肩部塑形，打造直角肩", "secondary": "改善圆肩体态" },
  "category": "strength",
  "target_projects": ["shoulder_tone", "round_shoulder_fix"],
  "contraindications": ["shoulder_impingement", "neck_pain"],
  "rest_seconds": 45,
  "steps": ["双脚与肩同宽站立", "双手握哑铃置于体侧", "肘微屈向两侧举起", "与肩同高停留1秒", "缓慢放下"],
  "tips": ["不要耸肩", "手低于肘、肘低于肩", "肩部发力勿借力"],
  "warning": "肩部有伤者慎做"
}
```

```json
{
  "exercise_id": "plank",
  "name": "平板支撑",
  "name_en": "Plank",
  "muscle_group": { "primary": ["腹横肌", "腹直肌"], "secondary": ["下背", "臀大肌"] },
  "difficulty": 2,
  "equipment": ["mat_6mm", "mat_8mm", "mat_10mm"],
  "function": { "primary": "紧致小腹", "secondary": "稳定核心" },
  "category": "strength",
  "target_projects": ["lower_abs_tone", "round_shoulder_fix", "full_body_basic"],
  "contraindications": ["lower_back", "sciatica"],
  "rest_seconds": 30,
  "steps": ["俯卧撑起始姿势", "前臂贴地、肘在肩正下方", "身体成直线", "收紧腹部与臀部", "保持呼吸"],
  "tips": ["不塌腰不撅臀", "量力而行", "腰部不适立即停止"],
  "warning": "腰伤者慎做，可选跪姿降难度"
}
```

---

*规范结束。配套评测集见《评测集样例.md》。*
