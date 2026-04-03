import { useCallback } from 'react';
import { useBridge } from '../hooks/useBridge';
import { VERSION } from '../version';
import type { BridgeEvent } from '../types/eda';

interface AppProps {
  eda: import('../types/eda').EdaApi;
  onRequestPairing: () => Promise<void>;
  onDisconnect: () => Promise<void>;
}

export function App({ eda, onRequestPairing, onDisconnect }: AppProps) {
  const { state } = useBridge();
  const { status, events } = state;

  const handleCopyUrl = async () => {
    if (status.url) {
      await navigator.clipboard.writeText(`Please use the web fetch tool to fetch the following URL and get the instructions: ${status.url}`);
    }
  };

  const handleCopyCode = async () => {
    if (status.pairingCode) {
      await navigator.clipboard.writeText(status.pairingCode);
    }
  };

  const handleOpenUrl = async () => {
    if (status.url) {
      eda.sys_Window.open(status.url);
    }
  };

  const handleRequestPairing = async () => {
    await onRequestPairing();
  };

  const handleDisconnect = async () => {
    await onDisconnect();
  };

  const handleCopyLogs = async () => {
    if (events.length === 0) return;
    const text = events
      .map((e) => {
        const tag = e.type === 'execute' ? '执行' : e.type === 'result' ? '结果' : '错误';
        const content =
          e.type === 'execute'
            ? e.data?.code ?? ''
            : e.type === 'result'
              ? JSON.stringify(e.data?.result, null, 2)
              : e.data?.error ?? '';
        return `[${tag}] ${content}`;
      })
      .join('\n\n');
    await navigator.clipboard.writeText(text);
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <svg className="logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          <h1>EasyEDA AI Bridge</h1>
        </div>
        <span className="version">v{VERSION}</span>
      </header>

      <section className={`status-card ${status.paired ? 'paired' : status.connectionError ? 'error' : 'pending'}`}>
        <div className="status-indicator">
          <span className="status-dot" />
          <span className="status-text">
            {status.paired ? '已配对' : status.connectionError ? '连接失败' : '等待配对'}
          </span>
        </div>
        {status.sessionId && (
          <div className="session-info">
            <span className="session-label">Session:</span>
            <span className="session-value">{status.sessionId}</span>
          </div>
        )}
      </section>

      {status.url && status.pairingCode && (
        <section className="pairing-section">
          <h2 className="section-title">配对信息</h2>
          
          <div className="pairing-card">
            <div className="pairing-header">
              <span className="pairing-label">配对码</span>
              <span className="pairing-expires">5分钟内有效</span>
            </div>
            <div className="pairing-code">{status.pairingCode}</div>
            <button className="btn btn-outline" onClick={handleCopyCode}>
              复制配对码
            </button>
          </div>

          <div className="pairing-card">
            <div className="pairing-header">
              <span className="pairing-label">链接配对</span>
              <span className="pairing-expires">推荐</span>
            </div>
            <div className="url-display">{status.url}</div>
            <div className="btn-group">
              <button className="btn btn-outline flex-1" onClick={handleOpenUrl}>
                打开页面
              </button>
              <button className="btn btn-outline flex-1" onClick={handleCopyUrl}>
                复制链接
              </button>
            </div>
          </div>
        </section>
      )}

      <div className="actions">
        <button className="btn btn-primary" onClick={handleRequestPairing}>
          请求配对码
        </button>
        <button className="btn btn-danger" onClick={handleDisconnect}>
          断开连接
        </button>
      </div>

      <section className="log-section">
        <div className="log-header">
          <h2 className="section-title">执行日志</h2>
          <button
            className="btn btn-outline btn-sm"
            onClick={handleCopyLogs}
            disabled={events.length === 0}
          >
            复制日志
          </button>
        </div>
        <div className="log-list">
          {events.length === 0 ? (
            <div className="log-empty">暂无日志</div>
          ) : (
            events.map((event) => (
              <div key={event.id} className={`log-item ${event.type}`}>
                <span className="log-tag">
                  {event.type === 'execute' ? '执行' : event.type === 'result' ? '结果' : '错误'}
                </span>
                <span className="log-content">
                  {event.type === 'execute' && (event.data?.code || '').substring(0, 40)}
                  {event.type === 'result' && JSON.stringify(event.data?.result || '').substring(0, 60)}
                  {event.type === 'error' && event.data?.error}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
