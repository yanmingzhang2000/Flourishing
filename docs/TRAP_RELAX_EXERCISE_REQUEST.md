## 任务：为 trap_relax 项目补充 strength 动作

### 背景信息

我正在开发一个女性居家健身应用（Flourish AI），针对局部塑形和姿势矫正。目前 trap_relax（斜方肌放松）项目严重缺少 strength 类动作。

### 项目定位

**trap_relax 项目目标：**
- 放松紧张的斜方肌上束（久坐、低头导致）
- 强化斜方肌中下束和菱形肌（改善圆肩驼背）
- 缓解肩颈僵硬和疼痛
- 改善头前伸姿势

**用户画像：**
- 女性新手，居家训练
- 久坐办公室，肩颈僵硬
- 有轻度圆肩、头前伸问题
- 可用器械：自重、弹力带、哑铃（1-2kg）、瑜伽垫、泡沫轴、瑜伽球

### 当前动作库现状

**trap_relax 现有动作（9 个）：**

**Strength (1 个) - 严重不足！⚠️**
1. 弹力带肩胛后缩 (Band Scapular Retraction) - D2, band_light

**Warmup (3 个) - 充足 ✅**
1. 耸肩释放 (Shoulder Shrug Release) - D1, bodyweight
2. 颈部缓慢绕转 (Neck Rotation Warmup) - D1, bodyweight
3. 收下巴训练 (Chin Tuck) - D1, bodyweight

**Stretch (5 个) - 充足 ✅**
1. 颈部侧拉伸 (Neck Side Stretch) - D1, bodyweight
2. 瑜伽球斜方肌自我松解 (Trap Self-massage with Ball) - D1, yoga_ball_55
3. 门框胸肌拉伸 (Doorway Pec Stretch) - D1, bodyweight
4. 泡沫轴上背放松 (Foam Roll Upper Back) - D1, foam_roller_plain
5. 手腕托颈放松 (Hands-supported Neck Release) - D1, bodyweight

**与 round_shoulder_fix 共享的动作（4 个）：**
- 门框胸肌拉伸、收下巴训练、泡沫轴上背放松、弹力带肩胛后缩

### 需求

**请帮我找 4-6 个适合 trap_relax 的 strength 动作，要求：**

1. **训练目标：**
   - 强化斜方肌中下束（降低肩胛骨，稳定肩胛）
   - 强化菱形肌（肩胛骨后缩）
   - 强化三角肌后束（平衡前后肌力）
   - 避免进一步紧张斜方肌上束

2. **装备分布（优先级排序）：**
   - 自重（bodyweight）：2-3 个 - 确保无器械用户也能练
   - 弹力带（band_light / band_mid）：1-2 个 - 轻便居家器械
   - 哑铃（dumbbell_1kg / dumbbell_1.5kg / dumbbell_2kg）：1 个 - 进阶选项
   - 瑜伽垫（mat_6mm）：可选配合其他装备
   - 瑜伽球（yoga_ball_55）：0-1 个 - 新增装备，可以利用

3. **难度分布：**
   - D1（零基础）：1-2 个
   - D2（偶尔练）：2-3 个
   - D3（经常练）：1 个
   - 避免 D4（太难）

4. **动作特征：**
   - 居家可做，不需要健身房器械
   - 动作幅度小，适合肩颈敏感人群
   - 强调"后缩、下沉、稳定"，而非"耸肩、上提"
   - 配合呼吸，控制型动作为主

5. **避免的动作类型：**
   - ❌ 过度活动颈椎的动作（如大幅度转头）
   - ❌ 耸肩动作（会加重斜方肌上束紧张）
   - ❌ 需要肩关节过度外展的动作（可能撞击）
   - ❌ 负重过大的动作（女性新手，1-2kg 为限）

### 期望输出格式

请为每个动作提供以下信息：

```
动作名称（中文 + 英文）
- 难度等级：D1/D2/D3
- 所需装备：[具体装备列表]
- 主要目标肌群：[如：菱形肌、斜方肌中下束]
- 次要目标肌群：[如：三角肌后束]
- 动作步骤：[3-5 个步骤，详细清晰]
- 技巧要点：[2-3 个关键提示]
- 禁忌人群/警告：[如：肩峰撞击者慎用]
- 为什么适合 trap_relax：[简要说明训练效果]
```

### 参考动作（可以启发你）

**类似有效的动作（来自 round_shoulder_fix）：**
- 靠墙天使 (Wall Angel) - D1, bodyweight
- 俯卧 Y 字上举 (Prone Y Raise) - D2, mat_6mm
- 俯卧 T 字上举 (Prone T Raise) - D2, mat_6mm
- 弹力带面拉 (Band Face Pull) - D2, band_mid

**可以考虑的方向：**
- 靠墙类动作（利用墙壁支撑）
- 俯卧类动作（prone position，重力辅助）
- 坐姿/站姿肩胛控制动作
- 弹力带多角度拉动
- 小重量哑铃控制型动作

### 额外要求

- 动作名称要通俗易懂，适合健身新手
- 避免过于专业的术语
- 每个动作要有清晰的视觉想象（方便后续配图）
- 优先选择已被验证有效且安全的经典动作

---

谢谢！期待你的建议 🙏
