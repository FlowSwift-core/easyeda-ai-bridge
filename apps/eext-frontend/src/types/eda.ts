export interface BridgeStatus {
  paired: boolean;
  sessionId?: string;
  pairingCode?: string;
  url?: string;
  connectionError?: boolean;
  success?: boolean;
}

export interface BridgeEvent {
  id?: number;
  type: 'execute' | 'result' | 'error';
  data: {
    id?: string;
    code?: string;
    result?: unknown;
    duration?: number;
    error?: string;
  };
}

interface ISYS_MessageBusTask {
  cancel: () => void;
  running: () => boolean;
}

export interface EdaApi {
  sys_Message: {
    showToastMessage: (message: string, type: number, duration: number) => void;
  };
  sys_MessageBus: {
    rpcCallPublic: (service: string, action?: string) => Promise<BridgeStatus>;
    rpcServicePublic: (service: string, handler: (action?: string) => unknown) => void;
    publishPublic: (channel: string, payload: unknown) => void;
    subscribePublic: (channel: string, callback: (data: unknown) => void) => ISYS_MessageBusTask;
  };
  sys_Storage: {
    getExtensionUserConfig: (key: string) => string | undefined;
    setExtensionUserConfig: (key: string, value: string) => void;
  };
  sys_ClientUrl: {
    request: (url: string, method: string, body?: string, options?: { headers: Record<string, string> }) => Promise<{
      ok: boolean;
      status: number;
      text: () => Promise<string>;
    }>;
  };
  sys_Window: {
    open: (url: string, target?: string) => void;
  };
  sys_Dialog: {
    showInformationMessage: (message: string, title: string) => void;
  };
  sys_IFrame: {
    openIFrame: (url: string, width: number, height: number, id: string, options?: {
      maximizeButton?: boolean;
      minimizeButton?: boolean;
      title?: string;
    }) => Promise<void>;
  };
}

declare global {
  interface Window {
    eda: EdaApi;
    initReactApp: (options: {
      eda: EdaApi;
      onRequestPairing: () => Promise<void>;
      onDisconnect: () => Promise<void>;
    }) => void;
  }
}
