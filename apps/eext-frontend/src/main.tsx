import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BridgeProvider } from './hooks/useBridge';
import { App } from './components/App';
import './styles/globals.css';
import './styles/App.css';

function initApp(options: {
  eda: typeof window.eda;
  onRequestPairing: () => Promise<void>;
  onDisconnect: () => Promise<void>;
}) {
  const root = createRoot(document.getElementById('root')!);
  root.render(
    <StrictMode>
      <BridgeProvider eda={options.eda}>
        <App
          eda={options.eda}
          onRequestPairing={options.onRequestPairing}
          onDisconnect={options.onDisconnect}
        />
      </BridgeProvider>
    </StrictMode>
  );
}

window.initReactApp = initApp;
