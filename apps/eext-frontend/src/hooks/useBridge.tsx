import { createContext, useContext, useEffect, useReducer, type ReactNode } from 'react';
import type { BridgeStatus, BridgeEvent, EdaApi } from '../types/eda';

const STATUS_CHANNEL = 'easyeda-ai-bridge-status';
const EVENTS_CHANNEL = 'easyeda-ai-bridge-events';

interface BridgeState {
  status: BridgeStatus;
  events: BridgeEvent[];
}

type BridgeAction =
  | { type: 'SET_STATUS'; payload: BridgeStatus }
  | { type: 'ADD_EVENT'; payload: BridgeEvent }
  | { type: 'RESET' };

const initialState: BridgeState = {
  status: { paired: false },
  events: [],
};

function bridgeReducer(state: BridgeState, action: BridgeAction): BridgeState {
  switch (action.type) {
    case 'SET_STATUS':
      return { ...state, status: action.payload };
    case 'ADD_EVENT':
      return { ...state, events: [action.payload, ...state.events].slice(0, 50) };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

interface BridgeContextValue {
  state: BridgeState;
  dispatch: React.Dispatch<BridgeAction>;
  eda: EdaApi | null;
}

const BridgeContext = createContext<BridgeContextValue | null>(null);

let eventId = 0;

export function BridgeProvider({ children, eda }: { children: ReactNode; eda: EdaApi }) {
  const [state, dispatch] = useReducer(bridgeReducer, initialState);

  useEffect(() => {
    if (!eda) return;

    const fetchInitialStatus = async () => {
      try {
        const status = await eda.sys_MessageBus.rpcCallPublic('ai-bridge-status');
        if (status) {
          dispatch({ type: 'SET_STATUS', payload: status as BridgeStatus });
        }
      } catch (e) {
        console.log('[BridgeProvider] Failed to fetch initial status:', e);
      }
    };

    fetchInitialStatus();

    const unsubStatus = eda.sys_MessageBus.subscribePublic(STATUS_CHANNEL, (data) => {
      dispatch({ type: 'SET_STATUS', payload: data as BridgeStatus });
    });

    const unsubEvents = eda.sys_MessageBus.subscribePublic(EVENTS_CHANNEL, (data) => {
      const event = data as BridgeEvent;
      dispatch({ type: 'ADD_EVENT', payload: { ...event, id: eventId++ } });
    });

    const pollTimer = setInterval(() => {
      eda.sys_MessageBus.rpcCallPublic('ai-bridge-status', 'poll').catch(() => {});
    }, 3000);

    return () => {
      clearInterval(pollTimer);
      try {
        if (unsubStatus?.cancel) unsubStatus.cancel();
      } catch {}
      try {
        if (unsubEvents?.cancel) unsubEvents.cancel();
      } catch {}
    };
  }, [eda]);

  return (
    <BridgeContext.Provider value={{ state, dispatch, eda }}>
      {children}
    </BridgeContext.Provider>
  );
}

export function useBridge() {
  const context = useContext(BridgeContext);
  if (!context) {
    throw new Error('useBridge must be used within BridgeProvider');
  }
  return context;
}
