# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# 本地开发（访问 http://localhost:3000）
npm run dev

# 类型检查 + 构建 Web 产物
npm run build

# Tauri 桌面应用开发模式
npm run tauri:dev

# Tauri 桌面应用打包（Windows NSIS .exe / macOS .dmg）
npm run tauri:build
```

## 项目概览

ZDP 是一个钢管库存查询与提货申请下单系统（B 端），同时支持浏览器 Web 模式和 Tauri v2 桌面应用模式。

- **前端**：React 19 + TypeScript + Ant Design v5 + Vite 6
- **桌面**：Tauri v2（src-tauri/），Rust 层通过 `tauri-plugin-http` 发起 HTTP 请求
- **后端测试环境**：`http://qaweixin.flsoft.cc`（仅测试，无公网文档）

## 架构要点

### 双运行时网络层（最关键）

`src/api/client.ts` 中 axios 实例使用 `adapter: 'fetch'`，并在生产包（Tauri）中通过 `env: { fetch: tauriFetch }` 注入 `@tauri-apps/plugin-http` 的 Rust fetch，而非替换 `globalThis.fetch`（会导致 Tauri IPC 死循环）。

**Cookie 注入机制**：生产模式下浏览器的 `Request` 构造器会过滤 `Cookie` 等 forbidden headers，因此 Cookie 必须放入 `config.fetchOptions.headers`（axios 将其作为第二参数直接传给 tauriFetch），而非 `config.headers`。`Cargo.toml` 中 `tauri-plugin-http` 需同时启用 `cookies` 和 `unsafe-headers` features。

### 认证流程

1. 登录接口 `GET /WXAuth/LoginByPhone` 返回 `"loginId;wxTokenId;isSalesman"` 格式字符串
2. 解析后存入 `AUTH_CONFIG`（内存）+ `localStorage`（持久化），键名 `zdp_auth`
3. 每个 API 请求从 `AUTH_CONFIG` 读取 `WXTokenID`、`LoginID`；生产模式手动注入 Cookie 头
4. 响应拦截器检测重定向到 `NotLoginInformation` 时触发 `authBus` 的 `unauthorized` 事件，App.tsx 监听后跳回登录页

### 页面导航模式

`App.tsx` 中所有页面用 `display: none/flex` 切换而非卸载，以保留各页面状态（搜索结果、暂存区等）。页面 key 持久化到 `sessionStorage`。

| PageKey | 组件 | 说明 |
|---|---|---|
| `create-order` | SearchPanel + StagingPanel / AutoSnatchPanel | 左侧查询 + 右侧暂存，或自动搜索抢单模式 |
| `order-list` | OrderListPage | 订单分页列表，带展开明细 |

### API 接口

所有接口定义在 `src/api/`，类型定义在 `src/types/index.ts`：

- **接口1** `GetInventoryClassList`：获取品种+规格列表，App.tsx 登录后调用一次，结果向下传给各组件（避免重复请求）
- **接口2** `GetOnLineStockList`：按品种/规格/壁厚查询在线库存列表；壁厚选项从首次查询结果的 `Wallthickness` 字段去重提取
- **接口3** `GetOnLineStockListByInvCode`：加入暂存区前获取货品最新详情
- **接口4** `CreateDeliveryApply`：提交订单，Content-Type: `application/x-www-form-urlencoded`，`jsonstr` 字段为 `OrderPayload` 的 JSON 字符串

### 暂存区

`StagingItem` 的唯一键为 `InvCode + "_" + WhCode`（来自 AutoID）。`buildOrderPayload()` 在 `src/api/order.ts` 中将暂存区条目转换为订单 payload，计算理论重量（`userNum × NumWeight`）和金额。

### 自动搜索抢单模式

`AutoSnatchPanel.tsx` 实现定时轮询库存并自动下单的功能，任务历史持久化到 `localStorage`（键名 `zdp_auto_snatch_tasks`，最多保留 20 条）。意外中断的 `running` 状态任务在下次加载时自动标记为 `stopped`。

### 响应式布局

`App.tsx` 使用 `Grid.useBreakpoint()`：`screens.lg` 以下切换为单列（移动端 Segmented 切换查询/暂存区面板）；`screens.md` 以下收缩 Header。

### 字体预设

用户字号偏好（紧凑/标准/舒适/大字）存入 `localStorage`（键名 `zdp_font_preset`），通过 Ant Design `ConfigProvider` 全局 token 注入。

## 添加新页面

1. 在 `App.tsx` 的 `NAV_ITEMS` 数组追加 `{ key: 'new-page', label: '新页面' }`
2. 扩展 `PageKey` 类型
3. 在 Content 区增加对应 `<div style={{ display: activePage === 'new-page' ? 'flex' : 'none', ... }}>` 块

## Vite Proxy（仅开发）

`/DeliveryApply` 和 `/WXAuth` 两个路径代理到后端，需先在浏览器访问后端完成登录以获取 Cookie（开发模式下 Cookie 由浏览器自动管理）。
