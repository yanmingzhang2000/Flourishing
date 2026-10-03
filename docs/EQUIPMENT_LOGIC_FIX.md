# 装备选择逻辑优化 - P0 修复

## 修复日期
2026-10-03

## 问题背景

原有的装备选择逻辑存在缺陷：
1. "自重"和其他装备（哑铃、弹力带）可以同时选择，不符合产品逻辑
2. 哑铃重量只能单选，但用户可能同时拥有多对不同重量的哑铃
3. UI 没有清晰提示互斥逻辑

## 修复内容

### 1. 装备互斥逻辑

**新逻辑**：
- ✅ 选择"纯自重"时 → 自动清空所有其他装备，其他装备按钮变灰禁用
- ✅ 选择"哑铃"或"弹力带"时 → 自动取消"纯自重"，然后添加该装备
- ✅ 哑铃、弹力带可以同时选择（多选）

### 2. 哑铃重量多选

**新功能**：
- ✅ 支持同时选择多个不同重量的哑铃（如 1kg、1.5kg、2kg 同时拥有）
- ✅ UI 显示已选择的所有重量：`已选：1kg × 2, 1.5kg × 2, 2kg × 2`

### 3. UI 优化

**文案调整**：
- "自重" → "纯自重"（更清晰）
- "不需要任何器械" → "仅用身体重量，零门槛"
- "可选择多个重量" → 新增哑铃描述
- "选择你的哑铃重量（单个）" → "选择你的哑铃重量（可多选）"

**新增提示**：
```
💡 选择"纯自重"后，其他装备将自动取消；选择其他装备会自动取消"纯自重"
```

**视觉反馈**：
- 选择"自重"后，其他装备按钮变灰（opacity-50）并禁用（cursor-not-allowed）

## 代码变更

### 文件：`src/pages/SettingsPage.tsx`

#### 变更 1：状态变量调整
```typescript
// 之前
const hasDumbbell = form.equipment.some(e => e.startsWith('dumbbell'));
const selectedDumbbell = form.equipment.find(e => e.startsWith('dumbbell')) || null;

// 之后
const hasNone = form.equipment.includes('none');
const hasDumbbell = form.equipment.some(e => e.startsWith('dumbbell'));
const selectedDumbbells = form.equipment.filter(e => e.startsWith('dumbbell'));
```

#### 变更 2：toggleEquip 函数重构
```typescript
const toggleEquip = (value: string) => {
  if (value === 'none') {
    // 选择"自重"时，清空所有其他装备
    if (hasNone) {
      update({ equipment: [] });
    } else {
      update({ equipment: ['none'] });
      setDumbbellExpanded(false);
    }
  } else if (value === 'dumbbell') {
    // 选择"哑铃"时，先取消"自重"，然后展开重量选择
    if (hasDumbbell) {
      update({ equipment: form.equipment.filter(e => !e.startsWith('dumbbell')) });
      setDumbbellExpanded(false);
    } else {
      const newEquipment = form.equipment.filter(e => e !== 'none');
      update({ equipment: newEquipment });
      setDumbbellExpanded(true);
    }
  } else {
    // 选择"弹力带"等其他装备时，先取消"自重"
    const cur = form.equipment.filter(e => e !== 'none');
    update({ equipment: cur.includes(value) ? cur.filter(e => e !== value) : [...cur, value] });
  }
};
```

#### 变更 3：selectDumbbellWeight 函数重构
```typescript
const selectDumbbellWeight = (weight: string) => {
  // 支持多选哑铃重量
  const otherDumbbells = form.equipment.filter(e => e.startsWith('dumbbell') && e !== weight);
  const otherEquipment = form.equipment.filter(e => !e.startsWith('dumbbell') && e !== 'none');
  
  if (selectedDumbbells.includes(weight)) {
    // 取消选择该重量
    update({ equipment: [...otherEquipment, ...otherDumbbells] });
  } else {
    // 添加该重量
    update({ equipment: [...otherEquipment, ...otherDumbbells, weight] });
  }
};
```

## 测试场景

### 测试 1：选择"纯自重"
1. 进入设置页 → 可用器械
2. 点击"纯自重"
3. ✅ 预期：其他装备按钮变灰且无法点击

### 测试 2：选择哑铃后选择"纯自重"
1. 先选择"哑铃" → 选择 1.5kg
2. 点击"纯自重"
3. ✅ 预期：哑铃选择被清空，重量选择面板收起

### 测试 3：选择"纯自重"后选择其他装备
1. 先选择"纯自重"
2. 点击其他装备按钮（应该被禁用）
3. ✅ 预期：无法点击，按钮保持禁用状态

### 测试 4：哑铃多选
1. 选择"哑铃"
2. 依次点击 1kg、1.5kg、2kg
3. ✅ 预期：三个重量都被选中，显示为 `已选：1kg × 2, 1.5kg × 2, 2kg × 2`

### 测试 5：哑铃 + 弹力带多选
1. 选择"哑铃" → 选择 1.5kg
2. 选择"弹力带"
3. ✅ 预期：两者都被选中，"纯自重"未选中

### 测试 6：取消哑铃重量
1. 选择"哑铃" → 选择 1kg 和 2kg
2. 再次点击 1kg
3. ✅ 预期：1kg 被取消，只保留 2kg

## 产品逻辑说明

### 为什么"纯自重"要互斥？

**产品定义**：
- "纯自重" = 不使用任何器械的训练方式
- 如果用户选择了"纯自重"，意味着不需要任何装备辅助
- 同时选择"纯自重"和"哑铃"是逻辑矛盾

**用户场景**：
- 用户 A：家里没有任何器械 → 选择"纯自重"
- 用户 B：家里有哑铃和弹力带 → 选择"哑铃"+"弹力带"
- 用户 C：只有弹力带 → 选择"弹力带"

### 为什么哑铃可以多选？

**真实场景**：
- 很多用户会购买一套哑铃（比如 1kg、1.5kg、2kg 三对）
- 不同动作需要不同重量
- 系统应该支持用户如实记录拥有的装备

**动作匹配逻辑**：
- 动作库中每个动作会标注所需装备（如 `["dumbbell_1.5kg_pair", "dumbbell_2kg_pair"]`）
- 系统会根据用户拥有的哑铃重量，自动匹配可执行的动作
- 用户选择的重量越多，可执行的动作越多

## 后续优化建议

### P1 优化（可选）
- [ ] 在首次设置时，添加引导动画解释互斥逻辑
- [ ] 当用户尝试点击被禁用的按钮时，显示 Toast 提示："已选择纯自重训练，无需其他装备"

### P2 优化（未来）
- [ ] 支持用户自定义哑铃重量（输入框）
- [ ] 添加"推荐装备配置"功能（根据用户选择的训练项目推荐装备）

## 验证结果

- ✅ TypeScript 编译通过（无错误）
- ✅ 开发服务器启动成功
- ✅ 逻辑实现完整
- ✅ UI 视觉反馈正确

## 相关文件

- `src/pages/SettingsPage.tsx` - 主要修改文件
- `src/data/exercises.json` - 动作库（67个动作）
- `docs/PRODUCT_LOGIC.md` - 产品逻辑文档
