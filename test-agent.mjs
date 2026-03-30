#!/usr/bin/env node
const CODE = process.argv[2];
const BRIDGE_URL = process.argv[3] || 'http://localhost:49620';

const tests = [
  { code: '1+1', desc: 'Math' },
  { code: 'typeof eda', desc: 'eda type' },
  { code: 'eda.dmt_SelectControl?.getCurrentDocumentInfo?.()', desc: 'getCurrentDocumentInfo' },
  { code: 'eda.dmt_Pcb?.getCurrentPcbInfo?.()', desc: 'getCurrentPcbInfo' },
  { code: 'eda.pcb_SelectControl?.getAllSelectedPrimitives?.()', desc: 'PCB getAllSelectedPrimitives (nothing selected)' },
  { code: 'eda.pcb_SelectControl?.getAllSelectedPrimitives_PrimitiveId?.()', desc: 'PCB getAllSelectedPrimitives_PrimitiveId' },
  { code: 'eda.pcb_SelectControl?.clearSelected?.()', desc: 'PCB clearSelected' },
  { code: 'eda.pcb_SelectControl?.getCurrentMousePosition?.()', desc: 'PCB getCurrentMousePosition' },
  { code: 'eda.dmt_Workspace?.getAllWorkspacesInfo?.()', desc: 'getAllWorkspacesInfo' },
  { code: 'eda.dmt_Project?.getCurrentProjectInfo?.()', desc: 'getCurrentProjectInfo' },
  { code: 'eda.dmt_Schematic?.getCurrentSchematicInfo?.()', desc: 'getCurrentSchematicInfo' },
  { code: 'eda.sys_Dialog?.showInformationMessage?.("Test from AI", "Hello")', desc: 'showInformationMessage' },
  { code: 'eda.sys_Message?.showToastMessage?.("Toast from AI!", 0, 3)', desc: 'showToastMessage' },
  { code: 'eda.sys_Log?.log?.("Log test")', desc: 'sys_Log' },
];

async function main() {
  const r = await fetch(`${BRIDGE_URL}/pairing/verify`, {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({code: CODE})
  });
  const d = await r.json();
  if (!d.success) { console.log('❌', d.error); return; }
  console.log('✅', d.sessionId, '\n');
  
  for (const t of tests) {
    const res = await fetch(`${BRIDGE_URL}/execute`, {
      method: 'POST', headers: {'Content-Type': 'application/json', 'X-Session-Id': d.sessionId},
      body: JSON.stringify({code: t.code})
    });
    const result = await res.json();
    const output = result.success 
      ? (result.result === undefined ? 'undefined' : JSON.stringify(result.result).slice(0,300))
      : result.error;
    console.log(t.desc + ':', output);
  }
}
main();
