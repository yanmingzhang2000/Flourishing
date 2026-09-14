# Flourish AI

Flourish AI — Your AI-powered personal trainer, designed to make you shine.

AI that analyzes your body, learns your goals, and builds a plan that's uniquely yours. It adapts to your progress, corrects your form, and evolves with you — like a real coach, in your pocket, 24/7.

Train smart. Stay consistent. **Flourish.**

---

## 品牌定位

专为**女生新手**设计的**居家局部塑形健身应用**。

**核心特点**：
- **轻松上手**：零基础友好，每次 15-25 分钟，不需要健身房
- **局部精准**：针对具体部位的塑形改善（拜拜肉、假胯宽、下腹等）
- **AI 陪伴**：根据训练反馈自动调整下一周的强度和次数
- **渐进式成长**：从第一周的轻松适应，到逐周递增，建立长期习惯

---

## 配色方案

| 角色 | 色值 | 用途 |
|------|------|------|
| **主色** | `#7DC47A` 苹果绿 | 按钮、进度条、选中状态、完成标记 |
| **点缀色** | `#F59E0B` 琥珀橙 | 序号标签、警告提示、伤病标签 |
| **背景** | `#DCF0FB` 冰蓝 | 页面底色 |
| **卡片** | `#FFFFFF` 纯白 | 卡片、弹窗 |
| **文字** | `#1F2937` 深灰 | 正文 |
| **辅助文字** | `#6B7280` 中灰 | 说明文字 |

---

## 技术栈

- **前端**：React + TypeScript + TailwindCSS + Vite
- **路由**：React Router (HashRouter)
- **打包**：vite-plugin-singlefile（单 HTML 文件）

---

## 本地开发

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建生产版本（单 HTML 文件）
npm run build

# 预览构建结果
npm run preview
```

构建后的单文件位于 `dist/index.html`，可直接双击在浏览器中打开。
