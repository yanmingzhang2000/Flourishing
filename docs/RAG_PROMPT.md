# RAG 动作库生成 Prompt（给「健身教练 AI 专家」用）

> 用途：生成 Flourish AI 的 RAG 动作库草稿（女生新手 / 居家轻器械 / 局部塑形紧致）。
> 重要：本 prompt 产出的是**待人工校验草稿**，禁止未经专业审核直接入库（呼应内容管线决议 18）。
> 用法：可直接整段复制给任意强推理模型；建议**按项目分批生成**（每批 1 个项目），便于人工校验。

---

## ▶ 复制以下 Prompt

```text
你是一位资深女性健身教练与运动科学专家。请为「Flourish AI」健身平台生成一批 RAG 动作库数据。
平台面向：女生新手、居家/办公室场景、轻器械或自重、目标是局部塑形紧致与体态改善（不是全身减脂/增肌）。

【必须遵守的合规与科学底线】
1. 不得承诺"局部减脂/只瘦某个部位"。脂肪是全身性减少，训练只能增肌紧致。动作 function 只能用：紧致/挺拔/放松/激活/改善体态 等表述。
2. 你提供健身指导，不诊断疾病。涉及伤病风险，标注 contraindications 并提示用户咨询医师。
3. 目标用户是新手，steps 必须分解清晰、可跟练；tips 必须包含防伤要点。
4. 安全优先：当某个动作对某伤病有不确定风险时，宁可将其加入 contraindications，并在该动作加 "needs_review": true，不要漏标。

【6 个项目定义（动作必须归属到这些 project_id）】
- tricep_tone 拜拜肉收紧：目标肌群 肱三头肌(主)/前臂(次)；效果 紧致大臂线条；难度 1-2；主训练 15min
- hip_thigh_tone 假胯宽改善：目标肌群 臀大肌/臀中肌(主)/股四头肌/腘绳肌(次)；效果 提臀瘦腿线条；难度 2-3；主训练 20min
- lower_abs_tone 下腹收紧：目标肌群 腹直肌/腹横肌(主)/腹斜肌(次)；效果 紧致小腹；难度 1-2；主训练 15min
- trap_relax 斜方肌放松：目标肌群 斜方肌上束(主)/颈肩(次)；效果 舒缓肩颈；难度 1-2；主训练 10min
- round_shoulder_fix 圆肩改善：目标肌群 菱形肌/斜方肌中下束(主)/三角肌后束(次)；效果 挺拔体态；难度 1-2；主训练 15min
- full_body_basic 居家基础体能：目标肌群 多肌群协同；效果 入门全身激活；难度 2-3；主训练 25min

【标准肌群词表（muscle_group 必须用这些词，禁止自造）】
肩部：三角肌前束/三角肌中束/三角肌后束/斜方肌上束/冈上肌
手臂：肱二头肌/肱三头肌/前臂
胸背：胸大肌/背阔肌/斜方肌中下束/菱形肌/竖脊肌
核心：腹直肌/腹横肌/腹斜肌/下背
臀腿：臀大肌/臀中肌/股四头肌/腘绳肌/内收肌/小腿三头肌
全身：多肌群协同

【伤病标签词表（contraindications 只能从下列 9 个中选，必须精确，否则系统无法识别）】
shoulder_impingement, rotator_cuff, neck_pain, elbow_pain, wrist_pain, lower_back, sciatica, knee_pain, meniscus
（对应：肩=前4中的 shoulder/rotator；颈=neck_pain；肘=elbow_pain；腕=wrist_pain；腰=lower_back/sciatica；膝=knee_pain/meniscus）

【器械主数据 ID（equipment 只能引用这些，可多选）】
bodyweight（无器械）
dumbbell_0.5kg / dumbbell_1kg / dumbbell_1.5kg / dumbbell_2kg / dumbbell_3kg / dumbbell_5kg
band_light / band_mid / band_heavy（弹力带）
rope_light / rope_mid / rope_heavy（弹力绳）
mat_6mm / mat_8mm / mat_10mm（瑜伽垫）
foam_roller_spike / foam_roller_plain（泡沫轴）
rope_skip_weighted / rope_skip_normal（跳绳）
kettlebell_2kg / kettlebell_4kg / kettlebell_6kg / kettlebell_8kg
door_pull（拉力带）
yoga_block（瑜伽砖）
yoga_ball_55 / yoga_ball_65 / yoga_ball_75
trx（悬挂带，仅进阶）

【每条动作的 JSON Schema（必须严格遵循）】
{
  "exercise_id": "snake_case_英文_id",
  "name": "中文名",
  "name_en": "English Name",
  "muscle_group": { "primary": ["标准肌群"], "secondary": ["标准肌群"] },
  "difficulty": 1-5的整数,
  "equipment": ["引用的equipment.id"],
  "function": { "primary": "紧致/挺拔/放松类效果", "secondary": "次要效果" },
  "category": "strength 或 warmup 或 stretch 或 cardio",
  "target_projects": ["归属的project_id，可多个"],
  "contraindications": ["伤病标签，可空数组但需谨慎"],
  "rest_seconds": 整数（建议30-60）,
  "steps": ["步骤1","步骤2",...],
  "tips": ["防伤要点1","要点2",...],
  "warning": "风险提示文本",
  "needs_review": false
}

【本次生成任务】
- 目标：为下方指定的项目生成动作，覆盖不同 difficulty（1-5 都要有分布）与多种 equipment（含自重）。
- 数量与分布：该项目至少 8-12 个动作，其中 strength 为主，warmup/stretch 各 2-3 个；难度低中高均衡。
- 一个动作可归属多个 target_projects（如平板支撑 ∈ lower_abs_tone + round_shoulder_fix + full_body_basic）。
- 输出：仅输出 JSON 数组（[...]），不要解释性文字、不要 markdown 代码块包裹，可直接被程序解析。
- 每条必须自检：contraindications 是否完整、equipment 是否合法、muscle_group 是否在词表内。

【请生成项目】：<在此填入一个 project_id，例如 tricep_tone；分批时逐个替换>

【生成后请附一份自检清单】
- 本项目动作总数：___
- difficulty 分布（1/2/3/4/5 各几个）：___
- 含自重(bodyweight)动作数：___
- 标注 needs_review=true 的动作及原因：___
- 是否每条 contraindications 都已对照 9 个伤病标签词表：是/否
```

---

## ▶ 使用说明（给你的，不发给专家）

1. **分批跑**：把最后「请生成项目」逐次换成 6 个 project_id，每次产出一个项目的动作，便于你逐个校验。
2. **校验（必须）**：拿到草稿后，按《动作库标注规范与内容管线.md》§七 做一审/二审（安全字段零容忍，抽检 ≥20%）。重点查 `contraindications` 是否漏标。
3. **入库**：校验通过后写入动作库 JSON，并补 `exercise_projects` 关联；每条新动作追加进《评测集样例.md》回归集。
4. **数量目标**：MVP 先 ≥30 条已校验动作跑通闭环，再扩到 50-100 条。
5. **禁忌重申**：专家若偷懒漏标 contraindications，RAG 护栏会基于错误知识放行危险动作——所以 prompt 里已强制"不确定就标 + needs_review"。
