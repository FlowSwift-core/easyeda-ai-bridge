# EasyEDA Bridge

6位配对码方案 - 连接AI Agents到你的EDA工作区

## 快速开始

### 1. 启动Bridge服务

```bash
cd apps/bridge
node scripts/bridge-server.mjs
```

服务启动在 `http://localhost:49620`

### 2. 在EDA中配对

1. 打开嘉立创EDA
2. 加载扩展插件
3. 请求配对码（扩展会自动显示6位配对码）
4. 在Agent端验证配对码

### 3. Agent端调用API

```bash
# 请求配对码
curl -s -X POST http://localhost:49620/pairing/request
# 返回: {"success":true,"code":"123456","sessionId":"sess_xxx",...}

# 验证配对码（在Agent端输入EDA显示的配对码）
curl -s -X POST http://localhost:49620/pairing/verify \
  -H "Content-Type: application/json" \
  -d '{"code": "123456"}'
# 返回: {"success":true,"sessionId":"sess_xxx"}

# 执行EDA API
curl -s -X POST http://localhost:49620/execute \
  -H "Content-Type: application/json" \
  -H "x-session-id: sess_xxx" \
  -d '{"code": "eda.sch_PrimitiveComponent.getAll(undefined, true)"}'
```

## API列表

### 配对接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /pairing/request | 请求配对码 |
| POST | /pairing/verify | 验证配对码 |

### 执行接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /execute | 执行代码 |
| GET | /poll/:sessionId | EDA轮询命令 |
| POST | /result | 提交执行结果 |

### 状态接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /health | 健康检查 |

## EDA API示例

### 获取所有器件

```javascript
eda.sch_PrimitiveComponent.getAll(undefined, true)
```

### 获取原理图所有导线

```javascript
eda.sch_PrimitiveWire.getAll(true)
```

### 获取PCB器件

```javascript
eda.pcb_PrimitiveComponent.getAll()
```

完整API参考: `../../packages/api-docs/references/classes/`

## 技术细节

- **配对码有效期**: 30分钟
- **会话有效期**: 24小时
- **轮询超时**: 30秒
- **配对缓冲**: 60秒（相同配对码重复验证返回同一sessionId）
- **存储**: SQLite持久化

## 文件结构

```
apps/
├── bridge/
│   ├── scripts/
│   │   ├── bridge-server.mjs  # 主服务
│   │   └── db.mjs             # SQLite模块
│   ├── public/
│   │   └── pairing.html       # Agent配对页面
│   └── data/
│       └── bridge.db          # SQLite数据库
├── extension/
│   └── src/
│       └── index.ts           # EDA插件客户端
```

## License

Apache-2.0
