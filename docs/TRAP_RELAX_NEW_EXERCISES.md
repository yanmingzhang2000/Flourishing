# trap_relax 新增 Strength 动作（Workbuddy 提供）

## 动作清单

### 1. 站姿肩胛下沉
- **ID**: `standing_scapular_depression`
- **难度**: D1
- **装备**: bodyweight
- **主要肌群**: 斜方肌下束、菱形肌
- **次要肌群**: 前锯肌

### 2. 靠墙天使
- **ID**: `wall_angel`（已存在于 round_shoulder_fix！）
- **难度**: D1
- **装备**: bodyweight
- **主要肌群**: 斜方肌中下束、菱形肌
- **次要肌群**: 三角肌后束
- **⚠️ 注意**: 这个动作已存在，只需将 `trap_relax` 添加到其 `target_projects`

### 3. 俯卧 T 字上举
- **ID**: `prone_t_raise`（已存在于 round_shoulder_fix！）
- **难度**: D2
- **装备**: mat_6mm
- **主要肌群**: 三角肌后束、斜方肌中束
- **次要肌群**: 菱形肌
- **⚠️ 注意**: 这个动作已存在，只需将 `trap_relax` 添加到其 `target_projects`

### 4. 弹力带面拉
- **ID**: `band_face_pull`（已存在于 round_shoulder_fix！）
- **难度**: D2
- **装备**: band_mid
- **主要肌群**: 菱形肌、斜方肌中下束
- **次要肌群**: 三角肌后束
- **⚠️ 注意**: 这个动作已存在，只需将 `trap_relax` 添加到其 `target_projects`

### 5. 哑铃俯身反向飞鸟
- **ID**: `reverse_fly_dumbbell`（已存在于 round_shoulder_fix！）
- **难度**: D2
- **装备**: dumbbell_1kg
- **主要肌群**: 三角肌后束、菱形肌
- **次要肌群**: 斜方肌中下束
- **⚠️ 注意**: 这个动作已存在，只需将 `trap_relax` 添加到其 `target_projects`
- **⚠️ Workbuddy建议1.5kg，但库中是1kg，需要确认是否调整**

### 6. 瑜伽球仰卧肩胛滑动
- **ID**: `supine_ball_scapular_slide`
- **难度**: D2
- **装备**: yoga_ball_55, mat_6mm
- **主要肌群**: 斜方肌下束、前锯肌
- **次要肌群**: 菱形肌

---

## 📊 发现重要信息！

**6 个动作中，5 个已经存在于 round_shoulder_fix！**

这意味着：
- ✅ 只需要**新增 2 个动作**（站姿肩胛下沉 + 瑜伽球仰卧肩胛滑动）
- ✅ 其余 4 个动作**只需修改 `target_projects`**，添加 `trap_relax`
- ✅ 这充分利用了数据库的多项目共享机制！

---

## 📈 修改后的统计

**修改前：**
- trap_relax: 1 个 strength 动作

**修改后：**
- trap_relax: **7 个 strength 动作**（1个旧 + 4个共享 + 2个新增）

**装备分布：**
- 自重: 2 个（靠墙天使、站姿肩胛下沉）
- 弹力带: 2 个（弹力带肩胛后缩[旧]、弹力带面拉）
- 哑铃: 1 个（哑铃俯身反向飞鸟）
- 瑜伽垫: 1 个（俯卧 T 字上举）
- 瑜伽球: 1 个（瑜伽球仰卧肩胛滑动）

**难度分布：**
- D1: 2 个
- D2: 5 个
- D3: 0 个（哑铃反向飞鸟在库中标记为 D2）

---

## ✅ 下一步行动

1. **新增 2 个动作** JSON 数据
2. **修改 4 个现有动作**，添加 `trap_relax` 到 `target_projects`
3. **验证系统生成效果**

需要我现在开始吗？
