# EasyEDA AI Bridge - Agent 配对

## 配对码

**{code}**

{expires}

---

## 配对步骤

1. 调用 `POST /pairing/verify` API 验证配对码
2. 获取 sessionId
3. 使用 sessionId 调用 `/execute` 接口执行代码

---

## EDA API 参考

EasyEDA Pro 的 API 全部挂载在全局 `eda` 对象上。代码在 `new Function('eda', 'return ' + code)` 中执行，**不要使用 `const`/`let` 声明变量**，**不要使用顶层 `await`**（使用 `.then()` 链或 IIFE）。

### 获取完整 API 类型定义

推荐安装 `@jlceda/pro-api-types` 获取完整的 TypeScript 类型定义，方便查阅所有可用 API：

```bash
npm install @jlceda/pro-api-types
```

安装后查看类型定义文件，包含 `eda.sys_*`、`eda.sch_*`、`eda.pcb_*`、`eda.dmt_*` 等所有类的完整接口。

### 常用 API 分类

| 命名空间 | 说明 |
|----------|------|
| `eda.sys_*` | 系统级 API（存储、消息、对话框、HTTP 请求等） |
| `eda.sch_*` | 原理图 API（元件、网络、文档操作） |
| `eda.pcb_*` | PCB 设计 API（走线、焊盘、层管理等） |
| `eda.dmt_*` | 文档管理 API（工程信息、文件操作） |

---

## API 参考

### 1. 验证配对码

```
POST /pairing/verify
Content-Type: application/json

{"code": "{code}"}
```

返回:
```
{"success": true, "sessionId": "sess_xxx"}
```

### 2. 执行代码

```
POST /execute
X-Session-Id: <sessionId>
Content-Type: application/json

{"code": "eda.dmt_Project.getCurrentProjectInfo().then(p=>p?.friendlyName)"}
```

### 3. 轮询命令（可选）

```
GET /poll/<sessionId>
```

---

## 代码执行示例

```javascript
// 获取当前工程名称
eda.dmt_Project.getCurrentProjectInfo().then(p => p?.friendlyName)

// 获取原理图所有元件 ID
eda.sch_PrimitiveComponent.getAllPrimitiveId()

// 读取存储配置
eda.sys_Storage.getExtensionUserConfig('myKey')

// 保存存储配置
eda.sys_Storage.setExtensionUserConfig('myKey', 'myValue')

// 弹出提示框
eda.sys_Dialog.showInformationMessage('Hello from AI!', 'AI Bridge')

// 获取 PCB 文档
eda.pcb_Document.getCurrent()

// 发送 HTTP 请求
eda.sys_ClientUrl.request('https://api.example.com/data', 'GET')
```

## 注意事项

- 所有 API 返回值都是 Promise，使用 `.then()` 链式调用
- 代码在沙箱中执行，无法访问外部变量
- 复杂操作建议拆分为多个小请求
