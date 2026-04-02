# EasyEDA AI Bridge - Agent 配对

## 配对码

**{code}**

{expires}

---

## 配对步骤

1. 调用 `POST /pairing/verify` API 验证配对码
2. 获取 sessionId
3. 使用 sessionId 调用 `/execute` 接口

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

### 更多示例

```
# 获取原理图所有元件
eda.sch_PrimitiveComponent.getAllPrimitiveId()

# 读取存储配置
eda.sys_Storage.getExtensionUserConfig('key')

# 保存存储配置  
eda.sys_Storage.setExtensionUserConfig('key', 'value')

# 获取当前工程信息
eda.dmt_Project.getCurrentProjectInfo()

# 获取 PCB 文档
eda.pcb_Document.getCurrent()
```
