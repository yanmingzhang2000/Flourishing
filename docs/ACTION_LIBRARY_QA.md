# 动作库人工 QA 清单（入库前必过）
> 适用文件：`/workspace/flourish_rag_exercise_library_v2.json`（= 教练原稿 57 条 + 本次补全 10 条，共 67 条）
> 原则：**误杀可接受，漏标 = 危险**。任何涉及关节负荷/过头的动作，若 contraindications 为空或偏少，必须人工复核是否漏标。
> 本清单与《动作库标注规范与内容管线.md》配套使用。
## 一、自动化校验结论（已通过，机器可复跑）
命令：`python3.11 /workspace/validate_v2.py`
| 检查项 | 结果 |
|--------|------|
| 缺字段 / 重复 ID | 0 处 OK |
| 非法伤病标签 / 肌群 / 器械 / 项目 ID | 0 处 OK |
| 难度越界 / 空禁忌 | 0 处 OK |
| function 含"减脂/瘦/燃脂" | 0 处 OK（合规）|
| 各项目 D4 补齐 | hip=3 / lower_abs=2 / tricep=1 / full_body=2 / round_shoulder=1 OK |
| full_body stretch 缺口 | 已补 2 条 OK |

> 注意：机器只能查"非法标签 / 漏字段"，**查不出"该标却漏标"**。第二节必须人工逐条过。
## 二、必须人工核对项（机器查不出）
### A. 禁忌完整性核对表（核心）
逐条确认：该动作的 `contraindications` 是否已覆盖其肌群/形态**应排查**的所有伤病标签。
| # | exercise_id | 名称 | 类别 | 难度 | 主要肌群 | 当前禁忌 | 应排查（参考）| 核对 |
|---|-------------|------|------|------|---------|----------|-----------|------|
| 1 | arm_circle_warmup | 手臂画圈热身 | warmup | D1 | 肱三头肌 | shoulder_impingement,rotator_cuff | elbow_pain/wrist_pain/shoulder_impingement；wrist_pain/elbow_pain |  |
| 2 | scapular_wall_slide | 靠墙肩胛滑动 | warmup | D1 | 斜方肌中下束 | neck_pain,shoulder_impingement | neck_pain；neck_pain/lower_back |  |
| 3 | wall_pushup | 墙面俯卧撑 | strength | D1 | 肱三头肌 | wrist_pain,shoulder_impingement | elbow_pain/wrist_pain/shoulder_impingement；shoulder_impingement/wrist_pain；wrist_pain/elbow_pain |  |
| 4 | band_tricep_kickback | 弹力带臂屈伸 | strength | D2 | 肱三头肌 | elbow_pain,shoulder_impingement | elbow_pain/wrist_pain/shoulder_impingement；wrist_pain/elbow_pain |  |
| 5 | dumbbell_overhead_ext | 站姿哑铃过顶臂屈伸 | strength | D2 | 肱三头肌 | shoulder_impingement,neck_pain | elbow_pain/wrist_pain/shoulder_impingement；wrist_pain/elbow_pain |  |
| 6 | chair_dip | 椅子臂屈伸 | strength | D3 | 肱三头肌 | elbow_pain,wrist_pain,shoulder_impingement | elbow_pain/wrist_pain/shoulder_impingement；shoulder_impingement/wrist_pain；wrist_pain/elbow_pain |  |
| 7 | close_grip_pushup | 窄距俯卧撑 | strength | D3 | 肱三头肌 | wrist_pain,shoulder_impingement,elbow_pain | elbow_pain/wrist_pain/shoulder_impingement；shoulder_impingement/wrist_pain；wrist_pain/elbow_pain |  |
| 8 | tricep_cross_stretch | 交叉臂屈伸拉伸 | stretch | D1 | 肱三头肌 | shoulder_impingement,neck_pain | elbow_pain/wrist_pain/shoulder_impingement；wrist_pain/elbow_pain |  |
| 9 | foam_roll_tricep | 泡沫轴大臂放松 | stretch | D1 | 肱三头肌 | elbow_pain | elbow_pain/wrist_pain/shoulder_impingement；wrist_pain/elbow_pain |  |
| 10 | glute_bridge | 臀桥 | strength | D1 | 臀大肌 | lower_back,sciatica | knee_pain/meniscus/lower_back；lower_back/sciatica/knee_pain |  |
| 11 | clam_shell | 蚌式开合 | strength | D2 | 臀中肌 | knee_pain,meniscus | knee_pain/meniscus；lower_back/sciatica/knee_pain |  |
| 12 | side_lying_leg_lift | 侧卧抬腿 | strength | D1 | 臀中肌 | knee_pain | knee_pain/meniscus；lower_back/sciatica/knee_pain |  |
| 13 | donkey_kick | 驴踢 | strength | D2 | 臀大肌 | lower_back,knee_pain | knee_pain/meniscus/lower_back；lower_back/sciatica/knee_pain |  |
| 14 | bodyweight_squat | 自重深蹲 | strength | D2 | 股四头肌,臀大肌 | knee_pain,meniscus,lower_back | knee_pain/meniscus/lower_back；lower_back/sciatica/knee_pain |  |
| 15 | fire_hydrant | 消防栓式抬腿 | strength | D2 | 臀中肌,臀大肌 | lower_back,knee_pain | knee_pain/meniscus；knee_pain/meniscus/lower_back；lower_back/sciatica/knee_pain |  |
| 16 | hip_flexor_stretch | 髋屈肌拉伸 | stretch | D1 | 臀大肌 | knee_pain,lower_back | knee_pain/meniscus；lower_back/sciatica/knee_pain |  |
| 17 | foam_roll_glutes | 泡沫轴臀部放松 | stretch | D1 | 臀大肌 | lower_back | knee_pain/meniscus/lower_back；lower_back/sciatica/knee_pain |  |
| 18 | hip_warmup_circles | 髋部绕环热身 | warmup | D1 | 臀中肌 | knee_pain,lower_back | knee_pain/meniscus；lower_back/sciatica/knee_pain |  |
| 19 | reverse_lunge | 反向箭步蹲 | strength | D3 | 股四头肌,臀大肌 | knee_pain,meniscus,lower_back | knee_pain/meniscus/lower_back；lower_back/sciatica/knee_pain |  |
| 20 | dead_bug | 死虫式 | strength | D2 | 腹横肌,腹直肌 | lower_back | lower_back/sciatica |  |
| 21 | lying_leg_raise | 仰卧举腿 | strength | D2 | 腹直肌 | lower_back | lower_back/sciatica |  |
| 22 | pelvic_tilt | 骨盆卷动 | strength | D1 | 腹横肌 | lower_back | lower_back/sciatica |  |
| 23 | supine_knee_tuck | 仰卧收膝 | strength | D2 | 腹直肌,腹横肌 | lower_back | lower_back/sciatica |  |
| 24 | mountain_climber | 登山者 | strength | D3 | 腹直肌,腹横肌 | wrist_pain,lower_back,knee_pain | elbow_pain/wrist_pain/shoulder_impingement；lower_back/sciatica |  |
| 25 | forearm_plank | 前臂平板支撑 | strength | D3 | 腹横肌,腹直肌 | wrist_pain,lower_back,shoulder_impingement | lower_back/sciatica；shoulder_impingement/rotator_cuff/neck_pain |  |
| 26 | bird_dog | 鸟狗式 | strength | D2 | 腹横肌,下背 | lower_back,knee_pain | lower_back/sciatica |  |
| 27 | core_breath_warmup | 核心呼吸激活 | warmup | D1 | 腹横肌 | lower_back | lower_back/sciatica |  |
| 28 | cat_cow_stretch | 猫牛式 | stretch | D1 | 下背 | lower_back,neck_pain | lower_back/sciatica |  |
| 29 | seated_forward_fold | 坐姿体前屈 | stretch | D1 | 腹直肌 | lower_back | lower_back/sciatica |  |
| 30 | neck_side_stretch | 颈部侧拉伸 | stretch | D1 | 斜方肌上束 | neck_pain | neck_pain |  |
| 31 | trap_self_massage_ball | 瑜伽球斜方肌自我松解 | stretch | D1 | 斜方肌上束 | neck_pain | neck_pain |  |
| 32 | shoulder_shrug_release | 耸肩释放 | warmup | D1 | 斜方肌上束 | neck_pain,shoulder_impingement | neck_pain |  |
| 33 | neck_rotation_warmup | 颈部缓慢绕转 | warmup | D1 | 斜方肌上束 | neck_pain | neck_pain |  |
| 34 | doorway_pec_stretch | 门框胸肌拉伸 | stretch | D1 | 胸大肌 | shoulder_impingement | shoulder_impingement/rotator_cuff/neck_pain；shoulder_impingement/wrist_pain |  |
| 35 | chin_tuck | 收下巴训练 | warmup | D1 | 斜方肌中下束,菱形肌 | neck_pain | neck_pain；neck_pain/lower_back；shoulder_impingement/rotator_cuff |  |
| 36 | foam_roll_upper_back | 泡沫轴上背放松 | stretch | D1 | 斜方肌上束 | neck_pain,lower_back | lower_back/sciatica；neck_pain |  |
| 37 | scapular_retraction_band | 弹力带肩胛后缩 | strength | D2 | 菱形肌,斜方肌中下束 | shoulder_impingement,neck_pain | neck_pain；neck_pain/lower_back；shoulder_impingement/rotator_cuff |  |
| 38 | wrist_neck_release | 手腕托颈放松 | stretch | D1 | 斜方肌上束 | neck_pain | neck_pain |  |
| 39 | wall_angel | 靠墙天使 | strength | D1 | 斜方肌中下束,菱形肌 | neck_pain,shoulder_impingement | neck_pain；neck_pain/lower_back；shoulder_impingement/rotator_cuff |  |
| 40 | band_face_pull | 弹力带面拉 | strength | D2 | 菱形肌,斜方肌中下束 | shoulder_impingement,rotator_cuff | neck_pain；neck_pain/lower_back；shoulder_impingement/rotator_cuff |  |
| 41 | prone_y_raise | 俯卧 Y 字上举 | strength | D2 | 斜方肌中下束,菱形肌 | lower_back,neck_pain | neck_pain；neck_pain/lower_back；shoulder_impingement/rotator_cuff |  |
| 42 | prone_t_raise | 俯卧 T 字上举 | strength | D2 | 菱形肌,三角肌后束 | lower_back,neck_pain | neck_pain；neck_pain/lower_back；shoulder_impingement/rotator_cuff |  |
| 43 | scapular_squeeze | 坐姿肩胛夹紧 | warmup | D1 | 菱形肌,斜方肌中下束 | neck_pain | neck_pain；neck_pain/lower_back；shoulder_impingement/rotator_cuff |  |
| 44 | doorway_chest_opener | 门框开胸拉伸 | stretch | D1 | 胸大肌 | shoulder_impingement | shoulder_impingement/rotator_cuff/neck_pain；shoulder_impingement/wrist_pain |  |
| 45 | foam_roll_chest_opener | 泡沫轴开胸 | stretch | D1 | 胸大肌 | lower_back,shoulder_impingement | shoulder_impingement/rotator_cuff/neck_pain；shoulder_impingement/wrist_pain |  |
| 46 | reverse_fly_dumbbell | 哑铃反向飞鸟 | strength | D2 | 三角肌后束,菱形肌 | shoulder_impingement,neck_pain | neck_pain；neck_pain/lower_back；shoulder_impingement/rotator_cuff |  |
| 47 | wall_slide_rs | 靠墙滑动矫正 | strength | D2 | 斜方肌中下束,菱形肌 | neck_pain,shoulder_impingement | neck_pain；neck_pain/lower_back；shoulder_impingement/rotator_cuff |  |
| 48 | fb_bodyweight_squat | 居家深蹲（基础版） | strength | D2 | 股四头肌,臀大肌 | knee_pain,meniscus,lower_back | knee_pain/meniscus/lower_back；lower_back/sciatica/knee_pain |  |
| 49 | fb_incline_pushup | 斜板俯卧撑 | strength | D2 | 胸大肌,肱三头肌 | wrist_pain,shoulder_impingement | elbow_pain/wrist_pain/shoulder_impingement；shoulder_impingement/rotator_cuff/neck_pain；shoulder_impingement/wrist_pain |  |
| 50 | fb_plank_hold | 平板支撑（基础体能） | strength | D3 | 腹横肌 | wrist_pain,lower_back,shoulder_impingement | lower_back/sciatica；按具体动作形态排查 |  |
| 51 | fb_glute_bridge | 臀桥（基础体能） | strength | D2 | 臀大肌 | lower_back,sciatica | knee_pain/meniscus/lower_back；lower_back/sciatica/knee_pain |  |
| 52 | fb_standing_march | 原地踏步 | cardio | D1 | 多肌群协同 | knee_pain,lower_back | 按具体动作形态排查 |  |
| 53 | fb_step_touch | 侧点步 | cardio | D1 | 多肌群协同 | knee_pain,lower_back | 按具体动作形态排查 |  |
| 54 | fb_bird_dog | 鸟狗式（基础体能） | strength | D2 | 多肌群协同,下背 | lower_back,knee_pain | lower_back/sciatica；按具体动作形态排查 |  |
| 55 | fb_sit_to_stand | 坐站练习 | strength | D2 | 股四头肌,臀大肌 | knee_pain,lower_back | knee_pain/meniscus/lower_back；lower_back/sciatica/knee_pain |  |
| 56 | fb_arm_leg_reach | 四肢伸展热身 | warmup | D1 | 多肌群协同 | lower_back,shoulder_impingement | 按具体动作形态排查 |  |
| 57 | fb_low_jack | 低冲击开合 | cardio | D2 | 多肌群协同 | knee_pain,lower_back,meniscus | 按具体动作形态排查 |  |
| 58 | dumbbell_skull_crusher | 哑铃仰卧臂屈伸 | strength | D4 | 肱三头肌 | shoulder_impingement,neck_pain,elbow_pain | elbow_pain/wrist_pain/shoulder_impingement；wrist_pain/elbow_pain | 新增 |
| 59 | bulgarian_split_squat | 保加利亚分腿蹲 | strength | D4 | 股四头肌 | knee_pain,meniscus,lower_back | knee_pain/meniscus；knee_pain/meniscus/lower_back；lower_back/sciatica/knee_pain | 新增 |
| 60 | single_leg_glute_bridge | 单腿臀桥 | strength | D4 | 臀大肌 | lower_back,sciatica | knee_pain/meniscus；knee_pain/meniscus/lower_back；lower_back/sciatica/knee_pain | 新增 |
| 61 | side_plank | 侧平板支撑 | strength | D4 | 腹斜肌 | lower_back,shoulder_impingement,wrist_pain | lower_back/sciatica；wrist_pain/elbow_pain | 新增 |
| 62 | flutter_kick | 仰卧上下打水 | strength | D4 | 腹直肌 | lower_back,sciatica | lower_back/sciatica | 新增 |
| 63 | single_arm_band_row | 单臂弹力带划船 | strength | D4 | 背阔肌 | shoulder_impingement,elbow_pain,neck_pain | lower_back；neck_pain；neck_pain/lower_back | 新增 |
| 64 | lateral_lunge | 侧弓步 | strength | D4 | 股四头肌 | knee_pain,meniscus,lower_back | knee_pain/meniscus；knee_pain/meniscus/lower_back；lower_back/sciatica/knee_pain | 新增 |
| 65 | high_knee_march_inplace | 原地高抬腿 | cardio | D4 | 股四头肌 | knee_pain,lower_back,sciatica | knee_pain/lower_back；knee_pain/meniscus/lower_back；lower_back/sciatica/knee_pain | 新增 |
| 66 | full_body_standing_stretch | 站姿全身拉伸 | stretch | D1 | 多肌群协同 | neck_pain,lower_back | knee_pain/lower_back；neck_pain；按具体动作形态排查 | 新增 |
| 67 | seated_spinal_twist | 坐姿脊柱扭转 | stretch | D1 | 竖脊肌 | lower_back,sciatica | lower_back/sciatica；lower_back/sciatica/knee_pain | 新增 |

### B. 本次补全 10 条专项核对
| exercise_id | 补全原因 / 重点核对 |
|-------------|------------------|
| dumbbell_skull_crusher | **D4 三头进阶（原最高 D3）**：过头顶负重，确认 shoulder_impingement/neck_pain/elbow_pain 是否够 |
| bulgarian_split_squat | **D4 臀腿进阶**：单腿负荷大，确认 knee_pain/meniscus/lower_back |
| single_leg_glute_bridge | **D4 臀进阶**：确认 lower_back/sciatica 是否需加 |
| side_plank | **D4 核心进阶（原腹项目无 D4）**：侧支撑压肩腕，确认 shoulder_impingement/wrist_pain；腰代偿风险 lower_back |
| flutter_kick | **D4 下腹进阶**：腰部贴地要求，确认 lower_back/sciatica |
| single_arm_band_row | **D4 肩背进阶**：划船压肩，确认 shoulder_impingement/elbow_pain/neck_pain |
| lateral_lunge | **D4 臀腿+全身**：侧向膝负荷，确认 knee_pain/meniscus/lower_back |
| high_knee_march_inplace | **D4 有氧进阶（原有氧最高 D2）**：膝腰冲击，确认 knee_pain/lower_back/sciatica |
| full_body_standing_stretch | **补 full_body 拉伸缺口**：前屈+侧屈，确认 neck_pain/lower_back |
| seated_spinal_twist | **补 full_body 拉伸缺口**：扭转，确认 lower_back/sciatica |

### C. needs_review = true 三项决策（必须逐条拍板）
- **close_grip_pushup（窄距俯卧撑，strength D3）**
  - 当前禁忌：`wrist_pain,shoulder_impingement,elbow_pain`
  - 决策：保留并补全禁忌 / 修改描述 / **MVP 砍掉**（尤其 `trap_self_massage_ball` 球体压颈肩，新手误操作代价大，强烈建议移除）
- **trap_self_massage_ball（瑜伽球斜方肌自我松解，stretch D1）**
  - 当前禁忌：`neck_pain`
  - 决策：保留并补全禁忌 / 修改描述 / **MVP 砍掉**（尤其 `trap_self_massage_ball` 球体压颈肩，新手误操作代价大，强烈建议移除）
- **band_face_pull（弹力带面拉，strength D2）**
  - 当前禁忌：`shoulder_impingement,rotator_cuff`
  - 决策：保留并补全禁忌 / 修改描述 / **MVP 砍掉**（尤其 `trap_self_massage_ball` 球体压颈肩，新手误操作代价大，强烈建议移除）

### D. 高风险动作复核（建议）
- `trap_self_massage_ball`（瑜伽球顶颈肩松解）：球体压在颈部附近，MVP 风险偏高 → **建议直接移除**，保留 foam_roll_upper_back 等更安全的替代。
- `close_grip_pushup`（窄距俯卧撑，D3）：腕/肩/肘负荷大，新手务必跪姿起步，已标注 tips，确认 warning 充分。
- `band_face_pull`（弹力带面拉，D2）：过头外旋，确认 rotator_cuff/shoulder_impingement 是否已纳入（当前仅 shoulder_impingement）。

### E. 难度与渐进合理性
- 确认每个项目均有 D1→D4 递进，且"经常练"用户（映射 D3-4）有可选动作。
- 同一动作不同难度变式是否形成清晰阶梯（如 wall_pushup D1 → incline D2 → close_grip D3 → skull_crusher D4）。

### F. 步骤可执行性与安全性（抽审 >=20%）
- steps 是否清晰到新手能照做，无歧义动作描述。
- tips/warning 是否针对该动作真实风险（而非套话）。
- rest_seconds 与难度/类别匹配（stretch 30、strength 40-50、cardio 30）。

## 三、合规边界（入库前确认）
- 所有 function 仅含：紧致 / 激活 / 放松 / 改善体态（已校验无"减脂/瘦"）。
- 无"局部减脂 / 瘦某部位"承诺，与产品"认知+塑形"主张一致。
- 动作描述不含诊断性语言；伤病提示统一指向"如有不适请咨询专业人士"。

## 四、入库与关联
1. 过审后写入 RAG 知识库（先存 draft 区，非直接进生产）。
2. 建立 `exercise_projects` 多对多关联表（一个动作常属多项目）。
3. 保留 `needs_review` 字段，便于后续迭代时定位待复核动作。

## 五、CI 接入（防回归）
- 将 `validate_v2.py` 接入 CI：教练每补一批动作即跑，非法标签/词表/字段直接拦截，禁止合入。
- 建议扩展：自动比对"肌群→应排查标签"覆盖率，对疑似漏标输出 warning。

## 六、签字栏
| 角色 | 姓名 | 日期 | 结论 |
|------|------|------|------|
| 健身教练（内容）| | | 通过 / 修改后重审 |
| 产品（你）| | | 通过 / 修改后重审 |
| 合规/法务（上线前）| | | 免责声明已审阅 |
