import { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import './SettingsPage.css';

interface InstallationMethod {
  id: number;
  product_line: string;
  method_code: number;
  method_name: string;
  description: string;
  legacy_id: number | null;
  created: string;
}

interface PackageInstallationMethod {
  id: number;
  product_line: string;
  method_code: number;
  method_name: string;
  description: string;
  created: string;
}

export const SettingsPage = () => {
  const { socketClient, connectionStatus } = useSocket();
  const [productMethods, setProductMethods] = useState<InstallationMethod[]>([]);
  const [packageMethods, setPackageMethods] = useState<PackageInstallationMethod[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; method: InstallationMethod } | null>(null);
  const [editingMethod, setEditingMethod] = useState<InstallationMethod | PackageInstallationMethod | null>(null);
  const [editingType, setEditingType] = useState<'product' | 'package' | null>(null);

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

  // Suljetaan kontekstivalikko kun klikataan muualle
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const handleAddProduct = () => {
    setEditingMethod({
      id: 0,
      product_line: 'I',
      method_code: 0,
      method_name: '',
      description: '',
      legacy_id: null,
      created: ''
    });
    setEditingType('product');
  };

  const handleAddPackage = () => {
    setEditingMethod({
      id: 0,
      product_line: 'I',
      method_code: 0,
      method_name: '',
      description: '',
      created: ''
    });
    setEditingType('package');
  };

  const handleEdit = (method: InstallationMethod | PackageInstallationMethod, type: 'product' | 'package') => {
    setEditingMethod(method);
    setEditingType(type);
  };

  const handleDelete = async (method: InstallationMethod | PackageInstallationMethod, type: 'product' | 'package') => {
    if (!confirm(`Poistetaanko asennustapa "${method.method_name}"?`)) return;
    
    try {
      const action = type === 'product' ? 'delete_product_installation_method' : 'delete_package_installation_method';
      await socketClient?.apiRequest(action, { id: method.id });
      showMessage('success', 'Asennustapa poistettu');
      if (type === 'product') {
        loadProductMethods();
      } else {
        loadPackageMethods();
      }
    } catch (err) {
      console.error('Poisto epäonnistui:', err);
      showMessage('error', 'Asennustavan poisto epäonnistui');
    }
  };

  const handleSave = async () => {
    if (!editingMethod) return;

    try {
      const isNew = editingMethod.id === 0;
      const action = editingType === 'product' 
        ? (isNew ? 'add_product_installation_method' : 'update_product_installation_method')
        : (isNew ? 'add_package_installation_method' : 'update_package_installation_method');

      await socketClient?.apiRequest(action, {...editingMethod} as unknown as Record<string, unknown>);
      showMessage('success', isNew ? 'Asennustapa lisätty' : 'Asennustapa päivitetty');
      setEditingMethod(null);
      setEditingType(null);
      
      if (editingType === 'product') {
        loadProductMethods();
      } else {
        loadPackageMethods();
      }
    } catch (err) {
      console.error('Tallennus epäonnistui:', err);
      showMessage('error', 'Asennustavan tallennus epäonnistui');
    }
  };

  const handleRightClick = (e: React.MouseEvent, method: InstallationMethod) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, method });
  };

  const handleLinkToPackage = async (packageMethodId: number) => {
    if (!contextMenu) return;
    
    try {
      await socketClient?.apiRequest('update_product_installation_method', {
        ...contextMenu.method,
        legacy_id: packageMethodId
      });
      showMessage('success', 'Legacy ID linkki luotu');
      setContextMenu(null);
      loadProductMethods();
    } catch (err) {
      console.error('Linkitys epäonnistui:', err);
      showMessage('error', 'Legacy ID linkitys epäonnistui');
    }
  };

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
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <span className="badge">{productMethods.length} kpl</span>
              <button className="btn-add" onClick={handleAddProduct}>➕ Lisää</button>
            </div>
          </div>
          <div className="methods-list">
            {productMethods.length === 0 ? (
              <p className="empty-message">Ei asennustapoja</p>
            ) : (
              <table className="methods-table">
                <thead>
                  <tr>
                    <th>Linja</th>
                    <th>Koodi</th>
                    <th>Nimi</th>
                    <th>Kuvaus</th>
                    <th>Linkki</th>
                    <th>Toiminnot</th>
                  </tr>
                </thead>
                <tbody>
                  {productMethods.map(m => (
                    <tr key={m.id} onContextMenu={(e) => handleRightClick(e, m)}>
                      <td>{m.product_line}</td>
                      <td>{m.method_code}</td>
                      <td><strong>{m.method_name}</strong></td>
                      <td>{m.description || '-'}</td>
                      <td>
                        {m.legacy_id ? (
                          <span className="legacy-link" title={`Linkki pakettiin ID ${m.legacy_id}`}>
                            🔗 {m.legacy_id}
                          </span>
                        ) : (
                          <span className="no-link">-</span>
                        )}
                      </td>
                      <td>
                        <button className="btn-edit" onClick={() => handleEdit(m, 'product')} title="Muokkaa">✏️</button>
                        <button className="btn-delete" onClick={() => handleDelete(m, 'product')} title="Poista">🗑️</button>
                      </td>
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
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <span className="badge">{packageMethods.length} kpl</span>
              <button className="btn-add" onClick={handleAddPackage}>➕ Lisää</button>
            </div>
          </div>
          <div className="methods-list">
            {packageMethods.length === 0 ? (
              <p className="empty-message">Ei asennustapoja</p>
            ) : (
              <table className="methods-table">
                <thead>
                  <tr>
                    <th>Linja</th>
                    <th>Koodi</th>
                    <th>Nimi</th>
                    <th>Kuvaus</th>
                    <th>Toiminnot</th>
                  </tr>
                </thead>
                <tbody>
                  {packageMethods.map(m => (
                    <tr key={m.id}>
                      <td>{m.product_line}</td>
                      <td>{m.method_code}</td>
                      <td><strong>{m.method_name}</strong></td>
                      <td>{m.description || '-'}</td>
                      <td>
                        <button className="btn-edit" onClick={() => handleEdit(m, 'package')} title="Muokkaa">✏️</button>
                        <button className="btn-delete" onClick={() => handleDelete(m, 'package')} title="Poista">🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* MODAALI LOMAKE */}
      {editingMethod && (
        <div className="modal-overlay" onClick={() => setEditingMethod(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{editingMethod.id === 0 ? 'Lisää' : 'Muokkaa'} {editingType === 'product' ? 'tuotteen' : 'paketin'} asennustapa</h3>
            <div className="form-group">
              <label>Linja:</label>
              <select 
                value={editingMethod.product_line} 
                onChange={(e) => setEditingMethod({...editingMethod, product_line: e.target.value})}
              >
                <option value="I">I</option>
                <option value="L">L</option>
              </select>
            </div>
            <div className="form-group">
              <label>Koodi:</label>
              <input 
                type="number" 
                value={editingMethod.method_code} 
                onChange={(e) => setEditingMethod({...editingMethod, method_code: parseInt(e.target.value) || 0})}
              />
            </div>
            <div className="form-group">
              <label>Nimi:</label>
              <input 
                type="text" 
                value={editingMethod.method_name} 
                onChange={(e) => setEditingMethod({...editingMethod, method_name: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Kuvaus:</label>
              <textarea 
                value={editingMethod.description} 
                onChange={(e) => setEditingMethod({...editingMethod, description: e.target.value})}
              />
            </div>
            <div className="modal-buttons">
              <button className="btn-save" onClick={handleSave}>💾 Tallenna</button>
              <button className="btn-cancel" onClick={() => setEditingMethod(null)}>❌ Peruuta</button>
            </div>
          </div>
        </div>
      )}

      {/* KONTEKSTIVALIKKO - LEGACY ID LINKITYS */}
      {contextMenu && (
        <div 
          className="context-menu" 
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <div className="context-menu-header">
            Linkitä pakettiin: {contextMenu.method.method_name}
          </div>
          {packageMethods.map(pm => (
            <div 
              key={pm.id} 
              className="context-menu-item"
              onClick={() => handleLinkToPackage(pm.id)}
            >
              🔗 {pm.method_name} (ID: {pm.id})
            </div>
          ))}
          {contextMenu.method.legacy_id && (
            <div 
              className="context-menu-item remove"
              onClick={() => handleLinkToPackage(0)}
            >
              ❌ Poista linkki
            </div>
          )}
        </div>
      )}
    </div>
  );
};
