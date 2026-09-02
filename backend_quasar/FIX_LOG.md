# backend_quasar 修改记录（FIX LOG）

> 本文档记录 Quasar 版 GM 后台相对初版的所有修复与改动。
> 每条注明：原因、改动文件、验证方式。状态分【已修复】【特殊处理】【未改/待办】。

---

## 一、遮罩（Mask）编辑器

### 1.1 遮罩初始颜色应为黑色【已修复】

- **问题**：编辑遮挡的窗口里 Mask 图显示为白色，应为黑色（未探索区域）
- **原因**：画布初始填充/底色逻辑问题
- **改动**：`src/components/mask/MaskEditorDialog.vue` 及遮罩绘制逻辑
- **验证**：打开编辑遮挡弹框，初始画面为黑色

### 1.2 前后端擦除半径不一致【已修复】

- **问题**：前端预览的笔刷大小和后端实际擦除范围对不上
- **修复**：前后端统一笔刷半径为 **48**
- **改动**：`useMaskEditor.ts`（前端）+ 后端对应擦除参数
- **验证**：擦除预览与提交结果一致

### 1.3 面板卡片化 + 撑满高度【已修复】

- **要求**：和道具模块一致，每个面板放进带标题栏的卡片并拉满视口高度
- **改动**：
  - `src/pages/MapPage.vue`：左/中/右三个面板（地图/地图视图/属性）各自一张 `q-card`，统一标题栏，flex 撑满剩余高度，内容面板内滚动
  - `src/components/map/MapList.vue`、`MapPropertyPanel.vue`：移除组件内重复的旧标题
  - `src/css/app.scss`：移除 `.map-list`/`.map-property-panel` 的半透明底（卡片已提供外框）
- **验证**：Playwright 截图确认；237 测试全过

---

## 二、添加道具弹框（ItemPickerDialog）

### 2.1 弹框布局重构【已修复】

- **问题**：初版弹框布局简陋，用户要求参考旧项目（backend_tauri2）`itemPickerModal`
- **改动**：`src/components/items/ItemPickerDialog.vue`
- **新布局**（三列，与旧项目一致）：
  - 左列（col-2）：**类型** —— 类别列表（全部 + 各类别）
  - 中列（col-6）：**道具** —— 搜索框 + 网格单元（名称两行截断 + 价格），无库存的置灰
  - 右列（col-4）：**道具属性** —— 类别/价格/鉴定/模组用途 + 数量输入 + 剩余可添加
  - 底部：取消 / 确定（确定按钮显示 ×N）

### 2.2 弹框长宽比固定【特殊处理】

- **要求**：弹框窗口长宽比需要固定
- **实现**：桌面端（≥576px）固定 **16:9**，用 `min(90vw, calc(85vh * 16/9))` 同时兼顾宽高限制
- **注意**：`min()` CSS 函数需要 Chromium 79+，老 WebView 上无效声明被忽略、回退到基础值（90vw/85vh），可接受
- **移动端**（<576px）：撑满 90vw × 85vh，不强制比例（竖屏强制 16:9 会太小）

---

## 三、老 WebView（Chromium 72）白屏【已修复】

- **问题**：手机（MI 8，系统 WebView = Chromium 72）打开 GM 页面白屏
- **根因**（adb logcat 实测）：
  1. 构建产物含 `?.`/`??` 语法 → `Uncaught SyntaxError: Unexpected token ?`
  2. 产物调用新 API → `TypeError: Object.hasOwn is not a function`（esbuild 只降级语法不降 API，Quasar 框架自身在用这些 API）
- **改动**：
  - `quasar.config.ts`：构建目标从 `es2022/chrome115` 降到 `['es2019', 'chrome72']`
  - 新增 `src/boot/polyfills.ts`（boot 数组第一位）：polyfill `Object.hasOwn`、`Array.prototype.at`、`String.prototype.replaceAll`、`Promise.allSettled`
  - `src/css/app.scss`：`.map-overlay` 的 `inset: 0` 改为 top/right/bottom/left 四条（`inset` 需 Chromium 87+）
  - `src/components/mask/MaskEditorDialog.vue`：`aspect-ratio` 内联样式改为 `padding-top` 百分比方案；`inset: 0` 同样改四条
- **验证**：adb 实测玩家页、地图页正常渲染，logcat 无报错
- **注意**：构建目标**不要改回去**，兼容性是有意为之（原项目 gm.css 注释也写明兼容 Chromium 72）

---

## 四、道具模块整体重构（ItemsPage）【已修复】

- **要求**：道具页按旧项目添加道具弹框布局：左类别 / 中道具 / 右上属性 / 右下分配面板
- **改动**：
  - `src/pages/ItemsPage.vue`：三列布局（col-md-2 / 5 / 5），四个面板（类型/道具/道具属性/分配面板）各自一张 `q-card`，统一居中标题栏；桌面端（≥1024px）整页撑满视口高度、卡片拉到底部、内容面板内滚动，移动端自然高度
  - 新增 `src/components/items/ItemCategoryList.vue`：左列类别列表
  - 改造 `src/components/items/ItemCatalog.vue`：搜索 + 网格单元（复用弹框样式），点击 emit select
  - 新增 `src/components/items/ItemPropertyPanel.vue`：右上属性面板（类别/价格/鉴定/模组用途/库存/剩余可分配）
  - `ItemAllocationPanel.vue`：原样保留在右下
  - 新增 `src/css/item-cells.scss`：道具网格单元 + 属性行共享样式，注册进 `quasar.config.ts` 的 css 数组
- **说明**：选中状态由 ItemsPage 持有，目录选中 → 属性面板联动；弹框的深色 scoped 样式优先级高于共享样式，保持原深色外观
- **验证**：237 个单元测试全过（新增 ItemCategoryList/ItemPropertyPanel 用例，更新 ItemsPage/ItemCatalog 用例）

---

## 五、主题（Dark 模式）【已修复】

- **问题**：用户询问是否有其他主题 / Dark 主题
- **说明**：Quasar 没有多套成品皮肤，主题定制 = 品牌色（`quasar.config.ts` 配色变量）+ 内置 Dark 模式
- **改动**：
  - `src/App.vue`：顶栏右上角加明暗切换按钮（`toggleDark()`），主题选择手动持久化到 localStorage（key：`dicetale-theme`，Quasar Dark 插件本身**不自动持久化**，`src/boot` 前在模块顶层恢复主题避免闪烁）
  - `src/css/item-cells.scss`、`src/css/app.scss`：补 `body.body--dark` 暗色覆盖
  - `src/App.spec.ts`：补 `$q.dark` mock 与 `q-btn` stub
- **验证**：Playwright 验证切换→刷新后主题保持（深色/浅色双向）；截图两种模式渲染正常；237 测试全过

---

## 已知问题 / 待办

| 项 | 状态 | 说明 |
|---|---|---|
| 手机端 <576px 下弹框不固定 16:9 | 特殊处理 | 竖屏强制比例过小，有意为之 |
| `min()`/`inset` 等 CSS 新特性在老 WebView 失效 | 特殊处理 | 已用回退方案规避，视觉影响可忽略 |
| 品牌色定制 | 未改 | 想换整套配色可在 quasar.config 改 primary 等变量 |
| 结构性大改（初版 review 中标记项） | 未改 | 如需启动再逐条探讨 |
