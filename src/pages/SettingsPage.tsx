import { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import './SettingsPage.css';

interface AppSettings {
  theme: 'light' | 'dark' | 'auto';
  language: 'fi' | 'en';
  pageSize: number;
  autoRefresh: boolean;
  refreshInterval: number;
}

export const SettingsPage = () => {
  const { socketClient, connectionStatus, appInfo } = useSocket();
  const [settings, setSettings] = useState<AppSettings>({
    theme: 'light',
    language: 'fi',
    pageSize: 50,
    autoRefresh: false,
    refreshInterval: 30
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    // Lataa asetukset local storage:sta
    const savedSettings = localStorage.getItem('normitin-settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(prev => ({ ...prev, ...parsed }));
      } catch (error) {
        console.error('Failed to parse saved settings:', error);
      }
    }
  }, []);

  const saveSettings = async () => {
    try {
      setLoading(true);
      setMessage(null);

      // Tallenna local storage:een
      localStorage.setItem('normitin-settings', JSON.stringify(settings));
      
      // Sovella teema
      applyTheme(settings.theme);
      
      setMessage({ type: 'success', text: 'Asetukset tallennettu onnistuneesti!' });
      
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setMessage({ type: 'error', text: 'Asetusten tallennus epäonnistui.' });
    } finally {
      setLoading(false);
    }
  };

  const resetSettings = () => {
    const defaultSettings: AppSettings = {
      theme: 'light',
      language: 'fi',
      pageSize: 50,
      autoRefresh: false,
      refreshInterval: 30
    };
    setSettings(defaultSettings);
    localStorage.removeItem('normitin-settings');
    applyTheme('light');
    setMessage({ type: 'success', text: 'Asetukset palautettu oletusarvoihin!' });
    setTimeout(() => setMessage(null), 3000);
  };

  const applyTheme = (theme: string) => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark-theme');
    } else {
      root.classList.remove('dark-theme');
    }
  };

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const testConnection = async () => {
    if (!socketClient || !connectionStatus.connected) {
      setMessage({ type: 'error', text: 'Ei yhteyttä palvelimeen.' });
      return;
    }

    try {
      setLoading(true);
      setMessage(null);
      
      await socketClient.apiRequest('ping');
      setMessage({ type: 'success', text: 'Yhteys palvelimeen toimii!' });
    } catch (error) {
      console.error('Connection test failed:', error);
      setMessage({ type: 'error', text: 'Yhteystesti epäonnistui.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="page-header">
        <h1>Asetukset</h1>
        <p className="page-subtitle">Sovelluksen asetusten hallinta</p>
      </div>

      {message && (
        <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-danger'}`}>
          {message.text}
        </div>
      )}

      <div className="settings-sections">
        {/* Ulkoasu-asetukset */}
        <section className="settings-section">
          <h2>🎨 Ulkoasu</h2>
          <div className="settings-grid">
            <div className="setting-group">
              <label htmlFor="theme">Teema:</label>
              <select
                id="theme"
                value={settings.theme}
                onChange={(e) => updateSetting('theme', e.target.value as 'light' | 'dark' | 'auto')}
                className="form-control"
              >
                <option value="light">Vaalea</option>
                <option value="dark">Tumma</option>
                <option value="auto">Automaattinen</option>
              </select>
            </div>

            <div className="setting-group">
              <label htmlFor="language">Kieli:</label>
              <select
                id="language"
                value={settings.language}
                onChange={(e) => updateSetting('language', e.target.value as 'fi' | 'en')}
                className="form-control"
              >
                <option value="fi">Suomi</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
        </section>

        {/* Suorituskyky-asetukset */}
        <section className="settings-section">
          <h2>⚡ Suorituskyky</h2>
          <div className="settings-grid">
            <div className="setting-group">
              <label htmlFor="pageSize">Sivun koko:</label>
              <select
                id="pageSize"
                value={settings.pageSize}
                onChange={(e) => updateSetting('pageSize', Number(e.target.value))}
                className="form-control"
              >
                <option value={25}>25 kohdetta</option>
                <option value={50}>50 kohdetta</option>
                <option value={100}>100 kohdetta</option>
                <option value={200}>200 kohdetta</option>
              </select>
            </div>

            <div className="setting-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.autoRefresh}
                  onChange={(e) => updateSetting('autoRefresh', e.target.checked)}
                />
                <span className="checkmark"></span>
                Automaattinen päivitys
              </label>
            </div>

            {settings.autoRefresh && (
              <div className="setting-group">
                <label htmlFor="refreshInterval">Päivitysväli (sekunteina):</label>
                <input
                  id="refreshInterval"
                  type="number"
                  min="10"
                  max="300"
                  value={settings.refreshInterval}
                  onChange={(e) => updateSetting('refreshInterval', Number(e.target.value))}
                  className="form-control"
                />
              </div>
            )}
          </div>
        </section>

        {/* Järjestelmätiedot */}
        <section className="settings-section">
          <h2>🔧 Järjestelmä</h2>
          <div className="system-info">
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Sovellus:</span>
                <span className="info-value">{appInfo?.name || 'Normitin'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Versio:</span>
                <span className="info-value">{appInfo?.version || '1.0.0'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Ympäristö:</span>
                <span className="info-value">{appInfo?.environment || 'development'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Yhteyden tila:</span>
                <span className={`connection-badge ${connectionStatus.connected ? 'connected' : 'disconnected'}`}>
                  {connectionStatus.connected ? 'Yhdistetty' : 'Ei yhteyttä'}
                </span>
              </div>
              {appInfo?.uptime && (
                <div className="info-item">
                  <span className="info-label">Palvelimen käyttöaika:</span>
                  <span className="info-value">{Math.floor(appInfo.uptime / 60)} min</span>
                </div>
              )}
            </div>

            <div className="system-actions">
              <button
                onClick={testConnection}
                className="btn btn-secondary"
                disabled={loading}
              >
                🔌 Testaa yhteys
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Toiminnot */}
      <div className="settings-actions">
        <button
          onClick={saveSettings}
          className="btn btn-primary"
          disabled={loading}
        >
          {loading ? 'Tallennetaan...' : '💾 Tallenna asetukset'}
        </button>
        
        <button
          onClick={resetSettings}
          className="btn btn-secondary"
          disabled={loading}
        >
          🔄 Palauta oletukset
        </button>
      </div>
    </div>
  );
};