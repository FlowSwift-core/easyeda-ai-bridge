---
name: easyeda-ai-bridge
description: >
  Control EasyEDA Pro (schematic & PCB) via AI agent. Read components, place parts, route wires, and manipulate designs.
  Use this skill when the user wants to interact with EasyEDA Pro EDA software.
  After pairing, execute JavaScript code on the `eda` global object to control the application.
license: Apache-2.0
compatibility:
  - Claude Code
  - Cursor
  - OpenCode
  - Gemini CLI
  - Cline
  - RooCode
  - Trea
metadata:
  author: FlowSwift
  version: 1.0.0
  tags:
    - eda
    - easyeda
    - pcb
    - schematic
    - electronics
---

# EasyEDA AI Bridge

Control EasyEDA Pro EDA software remotely. This skill enables AI agents to read schematic/PCB data, place components, route wires, and manipulate designs via JavaScript code execution.

## Pairing Info

**Pairing Code**: {code}

**Expires**: {expires}

## How to Use

### Step 1: Verify Pairing Code

```
POST {host}/pairing/verify
Content-Type: application/json

{"code": "{code}"}
```

Response:
```json
{"success": true, "sessionId": "sess_xxx"}
```

### Step 2: Execute Code

After obtaining `sessionId`, use it to execute JavaScript code in EasyEDA:

```
POST {host}/execute
X-Session-Id: <sessionId>
Content-Type: application/json

{"code": "eda.dmt_Project.getCurrentProjectInfo().then(p=>p?.friendlyName)"}
```

## Code Execution Rules

- **No `const`/`let` variable declarations** — all code runs in `new Function('eda', 'return ' + code)`
- **No top-level `await`** — use `.then()` chains or IIFE `(async()=>{...})()`
- All API calls return Promises
- Code runs in a sandboxed environment with only the `eda` object available

## API Naming Convention

All EasyEDA APIs are on the global `eda` object. The naming pattern is:

`eda` + `lowercase_first_3_letters_of_class_name` + `MethodName`

Examples:

| Class | API Call |
|-------|----------|
| `SYS_I18n` | `eda.sys_I18n.text()` |
| `SYS_ToastMessage` | `eda.sys_ToastMessage.showMessage()` |
| `SYS_Storage` | `eda.sys_Storage.getExtensionUserConfig()` |
| `PCB_Document` | `eda.pcb_Document.getCurrent()` |

## API Namespaces

| Namespace | Description |
|-----------|-------------|
| `eda.sys_*` | System APIs (storage, dialogs, HTTP requests, i18n, toast messages) |
| `eda.sch_*` | Schematic APIs (components, wires, nets, document operations) |
| `eda.pcb_*` | PCB APIs (tracks, pads, layers, document operations) |
| `eda.dmt_*` | Document management APIs (project info, file operations) |

## Common Examples

```javascript
// Get current project name
eda.dmt_Project.getCurrentProjectInfo().then(p => p?.friendlyName)

// Get all schematic component IDs
eda.sch_PrimitiveComponent.getAllPrimitiveId()

// Get all schematic components
eda.sch_PrimitiveComponent.getAll(undefined, true)

// Get all schematic wires
eda.sch_PrimitiveWire.getAll(true)

// Get all PCB components
eda.pcb_PrimitiveComponent.getAll()

// Read user config
eda.sys_Storage.getExtensionUserConfig('myKey')

// Save user config
eda.sys_Storage.setExtensionUserConfig('myKey', 'myValue')

// Show information dialog
eda.sys_Dialog.showInformationMessage('Hello from AI!', 'AI Bridge')

// Get current PCB document
eda.pcb_Document.getCurrent()

// Send HTTP request
eda.sys_ClientUrl.request('https://api.example.com/data', 'GET')

// Show toast message
eda.sys_ToastMessage.showMessage(eda.sys_I18n.text('Done'), 0)
```

## Full API Reference

1. **TypeScript Types (Recommended)**: Install `@jlceda/pro-api-types`
   ```bash
   npm install @jlceda/pro-api-types
   ```
   Then browse `node_modules/@jlceda/pro-api-types` for complete type definitions.

2. **Official Dev Guide**: https://github.com/easyeda/extension-dev-skill/tree/main/resources/guide
   - [Invoke Extension APIs](https://github.com/easyeda/extension-dev-skill/blob/main/resources/guide/invoke-apis.md)
   - [Inline Frame](https://github.com/easyeda/extension-dev-skill/blob/main/resources/guide/inline-frame.md)
   - [Error Handling](https://github.com/easyeda/extension-dev-skill/blob/main/resources/guide/error-handling.md)

## Important Notes

- Break complex operations into multiple small requests for reliability
- For debugging: add `?cll=debug` to EasyEDA URL and press F12 to open console
- If the extension causes critical errors: add `?safetyMode=true` to EasyEDA URL to disable all extensions
- **Required**: The extension must have "Allow External Interaction" enabled in its settings
