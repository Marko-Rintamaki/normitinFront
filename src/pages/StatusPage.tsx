import { useSocket } from '../context/SocketContext';
import './StatusPage.css';

export const StatusPage = () => {
  const { 
    connectionStatus, 
    appInfo, 
    healthStatus, 
    error, 
    isLoading, 
    ping, 
    refreshHealth, 
    makeRequest 
  } = useSocket();

  const handlePing = () => {
    ping();
  };

  const handleTestRequest = async () => {
    try {
      const response = await makeRequest('get-status');
      console.log('Test request response:', response);
      alert('Katso konsoli vastaukselle!');
    } catch (err) {
      alert(`Test request failed: ${(err as Error).message}`);
    }
  };

  return (
    <div className="status-page">
      <div className="page-header">
        <h1>📊 Järjestelmän tila</h1>
        <p>Reaaliaikainen yhteys ja palvelimen diagnostiikka</p>
      </div>

      {/* Connection Status */}
      <div className={`status-card connection-status ${connectionStatus.connected ? 'connected' : 'disconnected'}`}>
        <h2>🔌 Socket-yhteys:</h2>
        {connectionStatus.connected ? (
          <div className="status-content">
            <p className="status-indicator">✅ Yhdistetty</p>
            <p className="status-detail">Socket ID: {connectionStatus.socketId}</p>
          </div>
        ) : (
          <div className="status-content">
            <p className="status-indicator">❌ Ei yhteyttä</p>
            {connectionStatus.reason && <p className="status-detail">Syy: {connectionStatus.reason}</p>}
          </div>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="status-card loading">
          <h2>🔄 Ladataan</h2>
          <p>Yhdistetään palvelimeen...</p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="status-card error">
          <h2>❌ Virhe</h2>
          <p>{error}</p>
          <p className="error-help">Varmista että backend-palvelin pyörii portissa 3001</p>
        </div>
      )}

      {/* App Info */}
      {appInfo && (
        <div className="status-card app-info">
          <h2>📊 Sovelluksen tiedot:</h2>
          <div className="info-grid">
            <div className="info-row">
              <span className="info-label">Nimi:</span>
              <span className="info-value">{appInfo.name}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Versio:</span>
              <span className="info-value">{appInfo.version}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Ympäristö:</span>
              <span className="info-value">{appInfo.environment}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Käynnissäoloaika:</span>
              <span className="info-value">{Math.floor(appInfo.uptime)} sekuntia</span>
            </div>
          </div>
        </div>
      )}

      {/* Health Status */}
      {healthStatus && (
        <div className="status-card health-status">
          <h2>💚 Palvelimen kunto:</h2>
          <div className="info-grid">
            <div className="info-row">
              <span className="info-label">Tila:</span>
              <span className="info-value">{healthStatus.status}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Aktiiviset yhteydet:</span>
              <span className="info-value">{healthStatus.connections}</span>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {connectionStatus.connected && (
        <div className="status-card actions">
          <h2>🎮 Toiminnot:</h2>
          <div className="action-buttons">
            <button onClick={handlePing} className="action-btn primary">
              📡 Lähetä Ping
            </button>
            <button onClick={handleTestRequest} className="action-btn secondary">
              🧪 Testaa Pyyntö
            </button>
            <button onClick={refreshHealth} className="action-btn secondary">
              🔄 Päivitä Kunto
            </button>
          </div>
        </div>
      )}

      <div className="status-card info">
        <h2>🚀 Socket.IO-integraatio:</h2>
        <div className="tech-info">
          <p>✓ Frontend käyttää Socket.IO-clienttiä reaaliaikaiseen kommunikointiin</p>
          <p>✓ Kaikki data kulkee yhden WebSocket-yhteyden kautta</p>
          <p>✓ Backend Socket-palvelin pyörii REST API:n rinnalla</p>
          <p>✓ Automaattinen uudelleenyhdistäminen ja heartbeat</p>
        </div>
      </div>
    </div>
  );
};