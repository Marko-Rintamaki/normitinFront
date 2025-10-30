import { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import './SettingsPage.css';

interface InstallationMethod {
  method_code: string;
  method_name: string;
  description: string;
  is_active: boolean;
  created: string;
  updated?: string;
}

interface PackageInstallationMethod {
  method_code: string;
  method_name: string;
  description: string;
  is_active: boolean;
  created: string;
  updated?: string;
}

export const SettingsPage = () => {
  const { socketClient, connectionStatus } = useSocket();
  const [productMethods, setProductMethods] = useState<InstallationMethod[]>([]);
  const [packageMethods, setPackageMethods] = useState<PackageInstallationMethod[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const loadProductMethods = async () => {
    if (!socketClient) return;
    console.log('🔧 Ladataan tuotteen asennustavat...');
    try {
      const response = await socketClient.apiRequest('get_product_installation_methods', {});
      console.log('📦 Tuotteen asennustavat vastaus:', response);
      if (response && typeof response === 'object' && 'success' in response && response.success && 'data' in response && Array.isArray(response.data)) {
        setProductMethods(response.data);
        console.log('✅ Ladattu', response.data.length, 'tuotteen asennustapaa');
      }
    } catch (err) {
      console.error('❌ Tuotteen asennustapojen lataus epäonnistui:', err);
      showMessage('error', 'Tuotteen asennustapojen lataus epäonnistui');
    }
  };

  const loadPackageMethods = async () => {
    if (!socketClient) return;
    console.log('📦 Ladataan paketin asennustavat...');
    try {
      const response = await socketClient.apiRequest('get_all_package_installation_method_definitions', {});
      console.log('📦 Paketin asennustavat vastaus:', response);
      if (response && typeof response === 'object' && 'success' in response && response.success && 'data' in response && Array.isArray(response.data)) {
        setPackageMethods(response.data);
        console.log('✅ Ladattu', response.data.length, 'paketin asennustapaa');
      }
    } catch (err) {
      console.error('❌ Paketin asennustapojen lataus epäonnistui:', err);
      showMessage('error', 'Paketin asennustapojen lataus epäonnistui');
    }
  };

  useEffect(() => {
    if (socketClient && connectionStatus.connected) {
      loadProductMethods();
      loadPackageMethods();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socketClient, connectionStatus.connected]);

  return (
    <div className="settings-page">
      <div className="page-header">
        <h1>⚙️ Asennustapojen hallinta</h1>
        <p className="page-subtitle">Tuotteiden ja pakettien asennustapojen luonti ja muokkaus</p>
      </div>

      {message && (
        <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-danger'}`}>
          {message.text}
        </div>
      )}

      <div className="methods-grid">
        {/* TUOTTEEN ASENNUSTAVAT - VASEN PUOLI */}
        <div className="methods-section">
          <div className="section-header">
            <h2>🔧 Tuotteen asennustavat</h2>
            <span className="badge">{productMethods.length} kpl</span>
          </div>
          <div className="methods-list">
            {productMethods.length === 0 ? (
              <p className="empty-message">Ei asennustapoja</p>
            ) : (
              <table className="methods-table">
                <thead>
                  <tr>
                    <th>Koodi</th>
                    <th>Nimi</th>
                    <th>Kuvaus</th>
                    <th>Aktiivinen</th>
                  </tr>
                </thead>
                <tbody>
                  {productMethods.map(m => (
                    <tr key={m.method_code}>
                      <td>{m.method_code}</td>
                      <td><strong>{m.method_name}</strong></td>
                      <td>{m.description || '-'}</td>
                      <td>{m.is_active ? '✓' : '✗'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* PAKETIN ASENNUSTAVAT - OIKEA PUOLI */}
        <div className="methods-section">
          <div className="section-header">
            <h2>📦 Paketin asennustavat</h2>
            <span className="badge">{packageMethods.length} kpl</span>
          </div>
          <div className="methods-list">
            {packageMethods.length === 0 ? (
              <p className="empty-message">Ei asennustapoja</p>
            ) : (
              <table className="methods-table">
                <thead>
                  <tr>
                    <th>Koodi</th>
                    <th>Nimi</th>
                    <th>Kuvaus</th>
                    <th>Aktiivinen</th>
                  </tr>
                </thead>
                <tbody>
                  {packageMethods.map(m => (
                    <tr key={m.method_code}>
                      <td>{m.method_code}</td>
                      <td><strong>{m.method_name}</strong></td>
                      <td>{m.description || '-'}</td>
                      <td>{m.is_active ? '✓' : '✗'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
