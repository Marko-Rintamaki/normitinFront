import { useSocket } from '../context/SocketContext';
import './HomePage.css';

export const HomePage = () => {
  const { connectionStatus, appInfo, healthStatus, error, isLoading } = useSocket();

  return (
    <div className="home-page">
      <div className="hero-section">
        <h1>Tervetuloa Normitin-järjestelmään</h1>
        <p>Tuotteiden hallinta ja hakujärjestelmä</p>
      </div>

      <div className="status-section">
        <h2>Järjestelmän tila</h2>
        
        {/* Connection Status */}
        <div className={`status-card connection-status ${connectionStatus.connected ? 'connected' : 'disconnected'}`}>
          <h3>🔌 Yhteys palvelimeen</h3>
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
            <h3>🔄 Ladataan</h3>
            <p>Yhdistetään palvelimeen...</p>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="status-card error">
            <h3>❌ Virhe</h3>
            <p>{error}</p>
          </div>
        )}

        {/* App Info */}
        {appInfo && (
          <div className="status-card app-info">
            <h3>📊 Sovelluksen tiedot</h3>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Nimi:</span>
                <span className="info-value">{appInfo.name}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Versio:</span>
                <span className="info-value">{appInfo.version}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Ympäristö:</span>
                <span className="info-value">{appInfo.environment}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Käynnissäoloaika:</span>
                <span className="info-value">{Math.floor(appInfo.uptime)} sekuntia</span>
              </div>
            </div>
          </div>
        )}

        {/* Health Status */}
        {healthStatus && (
          <div className="status-card health-status">
            <h3>💚 Palvelimen kunto</h3>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Tila:</span>
                <span className="info-value">{healthStatus.status}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Aktiiviset yhteydet:</span>
                <span className="info-value">{healthStatus.connections}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="quick-actions">
        <h2>Pikavalinnat</h2>
        <div className="action-cards">
          <div className="action-card">
            <h3>📦 Tuotteet</h3>
            <p>Selaa kaikkia tuotteita järjestelmässä</p>
            <a href="/products" className="action-button">Siirry tuotteisiin</a>
          </div>
          <div className="action-card">
            <h3>🔍 Tuotehaku</h3>
            <p>Hae tuotteita nimellä, koodilla tai kategorian mukaan</p>
            <a href="/search" className="action-button">Aloita haku</a>
          </div>
        </div>
      </div>
    </div>
  );
};