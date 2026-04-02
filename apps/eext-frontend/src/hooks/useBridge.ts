import useSWR from 'swr';
import type { BridgeStatus, BridgeEvent, EdaApi } from '../types/eda';

const STATUS_KEY = 'ai-bridge-status';
const EVENTS_KEY = 'easyeda-ai-bridge-events';

export function useBridgeStatus(eda: EdaApi | undefined) {
  const { data, error, isLoading, mutate } = useSWR<BridgeStatus | null>(
    eda ? STATUS_KEY : null,
    async () => {
      if (!eda) return null;
      try {
        return await eda.sys_MessageBus.rpcCallPublic(STATUS_KEY);
      } catch {
        return null;
      }
    },
    {
      refreshInterval: 2000,
      revalidateOnFocus: false,
    }
  );

  return {
    status: data,
    isLoading,
    isError: error,
    mutate,
  };
}

export function useBridgeEvents(eda: EdaApi | undefined, onEvent?: (event: BridgeEvent) => void) {
  if (eda) {
    eda.sys_MessageBus.subscribePublic(EVENTS_KEY, (data) => {
      if (onEvent) {
        onEvent(data as BridgeEvent);
      }
    });
  }

  return {};
}

export interface LogEntry {
  id: number;
  time: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

let logId = 0;
export function createLogEntry(message: string, type: LogEntry['type'] = 'info'): LogEntry {
  return {
    id: logId++,
    time: new Date().toLocaleTimeString(),
    message,
    type,
  };
}
