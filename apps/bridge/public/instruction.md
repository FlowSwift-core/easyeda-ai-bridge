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

EasyEDA Pro 的 API 全部挂载在全局 `eda` 对象上。代码在 `new Function('eda', 'return ' + code)` 中执行。

### ⚠️ 代码执行规则

- **不要使用 `const`/`let` 声明变量**
- **不要使用顶层 `await`**（使用 `.then()` 链或 IIFE）
- 所有 API 返回值都是 Promise
- 代码在沙箱中执行，无法访问外部变量

### API 命名规则

标准调用格式：`eda` + `类实例对象名` + `方法名/变量名`

类实例对象名为类名下划线前三个字母小写，例如：

| 类名             | 调用方式                    |
| ---------------- | --------------------------- |
| `SYS_I18n`       | `eda.sys_I18n.text()`       |
| `SYS_ToastMessage` | `eda.sys_ToastMessage.showMessage()` |
| `SYS_Storage`    | `eda.sys_Storage.getExtensionUserConfig()` |
| `PCB_Document`   | `eda.pcb_Document.getCurrent()` |

### 常用 API 分类

| 命名空间 | 说明 |
|----------|------|
| `eda.sys_*` | 系统级 API（存储、消息、对话框、HTTP 请求、国际化等） |
| `eda.sch_*` | 原理图 API（元件、网络、文档操作） |
| `eda.pcb_*` | PCB 设计 API（走线、焊盘、层管理、文档操作） |
| `eda.dmt_*` | 文档管理 API（工程信息、文件操作） |

### 获取完整 API 参考

1. **类型定义（推荐）**: 安装 `@jlceda/pro-api-types` 获取完整 TypeScript 类型定义
   ```bash
   npm install @jlceda/pro-api-types
   ```
   安装后查看 `node_modules/@jlceda/pro-api-types` 中的类型文件，包含所有 API 的完整接口。

2. **官方开发文档**: https://github.com/easyeda/extension-dev-skill/tree/main/resources/guide
   - [调用扩展 API](https://github.com/easyeda/extension-dev-skill/blob/main/resources/guide/invoke-apis.md)
   - [内联框架](https://github.com/easyeda/extension-dev-skill/blob/main/resources/guide/inline-frame.md)
   - [错误处理](https://github.com/easyeda/extension-dev-skill/blob/main/resources/guide/error-handling.md)
   - [扩展配置](https://github.com/easyeda/extension-dev-skill/blob/main/resources/guide/extension-json.md)

3. **官方扩展案例**: https://github.com/easyeda

---

## Bridge API 参考

### 1. 验证配对码

```
POST /pairing/verify
Content-Type: application/json

{"code": "{code}"}
```

返回:
```json
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

// 国际化文本
eda.sys_ToastMessage.showMessage(eda.sys_I18n.text('Done'), 0)
```

## 注意事项

- 复杂操作建议拆分为多个小请求
- 如需调试，可在 EasyEDA URL 添加 `?cll=debug` 参数，按 F12 打开控制台
- 如扩展导致严重错误，可在 URL 添加 `?safetyMode=true` 禁用所有扩展
