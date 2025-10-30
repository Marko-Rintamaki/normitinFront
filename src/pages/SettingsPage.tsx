import { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import './SettingsPage.css';

interface InstallationMethod {
  method_code: number;
  method_name: string;
  legacy_id: number | null;
  description: string;
  created: string;
}

interface PackageInstallationMethod {
  id: number;
  method_id: number;
  method_name: string;
  standard_hours: number;
  description?: string;
  created: string;
}

export const SettingsPage = () => {
  const { socketClient, connectionStatus } = useSocket();
  const [productMethods, setProductMethods] = useState<InstallationMethod[]>([]);
  const [packageMethods, setPackageMethods] = useState<PackageInstallationMethod[]>([]);
  const [activeTab, setActiveTab] = useState<'product' | 'package'>('product');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const loadProductMethods = async () => {
    if (!socketClient) return;
    try {
      const response: any = await socketClient.apiRequest('get_product_installation_methods', {});
      if (response.success && Array.isArray(response.data)) {
        setProductMethods(response.data);
      }
    } catch (err) {
      showMessage('error', 'Lataus epäonnistui');
    }
  };

  const loadPackageMethods = async () => {
    if (!socketClient) return;
    try {
      const response: any = await socketClient.apiRequest('get_package_installation_methods', {});
      if (response.success && Array.isArray(response.data)) {
        setPackageMethods(response.data);
      }
    } catch (err) {
      showMessage('error', 'Lataus epäonnistui');
    }
  };

  useEffect(() => {
    if (socketClient && connectionStatus.connected) {
      loadProductMethods();
      loadPackageMethods();
    }
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

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'product' ? 'active' : ''}`}
          onClick={() => setActiveTab('product')}
        >
          🔧 Tuotteen asennustavat ({productMethods.length})
        </button>
        <button
          className={`tab ${activeTab === 'package' ? 'active' : ''}`}
          onClick={() => setActiveTab('package')}
        >
          📦 Paketin asennustavat ({packageMethods.length})
        </button>
      </div>

      {activeTab === 'product' && (
        <div className="tab-content">
          <h2>Tuotteen asennustavat</h2>
          <div className="methods-list">
            {productMethods.length === 0 ? (
              <p>Ei asennustapoja</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Koodi</th>
                    <th>Nimi</th>
                    <th>Kuvaus</th>
                  </tr>
                </thead>
                <tbody>
                  {productMethods.map(m => (
                    <tr key={m.method_code}>
                      <td>{m.method_code}</td>
                      <td><strong>{m.method_name}</strong></td>
                      <td>{m.description || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === 'package' && (
        <div className="tab-content">
          <h2>Paketin asennustavat</h2>
          <div className="methods-list">
            {packageMethods.length === 0 ? (
              <p>Ei asennustapoja</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nimi</th>
                    <th>Tunnit</th>
                    <th>Kuvaus</th>
                  </tr>
                </thead>
                <tbody>
                  {packageMethods.map(m => (
                    <tr key={m.id}>
                      <td>{m.method_id}</td>
                      <td><strong>{m.method_name}</strong></td>
                      <td>{m.standard_hours} h</td>
                      <td>{m.description || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
