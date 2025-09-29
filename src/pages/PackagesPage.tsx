import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import './PackagesPage.css';

interface Package {
  package_id: string;
  package_name: string;
  description?: string;
  package_product_line: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export const PackagesPage = () => {
  const { socketClient, connectionStatus } = useSocket();
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('package_name');

  const loadPackages = useCallback(async () => {
    if (!socketClient || !connectionStatus.connected) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Hae paketit backend:ista
      const response = await socketClient.apiRequest('get_packages', {
        limit: 100,
        offset: 0
      }) as any;
      
      if (response.success && response.data) {
        setPackages(response.data || []);
      } else {
        throw new Error(response.message || 'Failed to load packages');
      }
    } catch (error) {
      console.error('Error loading packages:', error);
      setError(error instanceof Error ? error.message : 'Failed to load packages');
      setPackages([]);
    } finally {
      setLoading(false);
    }
  }, [socketClient, connectionStatus.connected]);

  useEffect(() => {
    loadPackages();
  }, [loadPackages]);

  const getFilteredPackages = () => {
    let filtered = [...packages];

    // Suodata hakusanan perusteella
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(pkg => 
        pkg.package_name.toLowerCase().includes(query) ||
        pkg.package_id.toLowerCase().includes(query) ||
        (pkg.description && pkg.description.toLowerCase().includes(query)) ||
        pkg.package_product_line.toLowerCase().includes(query)
      );
    }

    // Järjestä paketit
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'package_name':
          return a.package_name.localeCompare(b.package_name);
        case 'package_id':
          return a.package_id.localeCompare(b.package_id);
        case 'package_product_line':
          return a.package_product_line.localeCompare(b.package_product_line);
        case 'created_at':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        default:
          return 0;
      }
    });
  };

  const filteredPackages = getFilteredPackages();

  if (loading && packages.length === 0) {
    return (
      <div className="packages-page">
        <div className="page-header">
          <h1>Paketit</h1>
        </div>
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Ladataan paketteja...</p>
        </div>
      </div>
    );
  }

  if (error && packages.length === 0) {
    return (
      <div className="packages-page">
        <div className="page-header">
          <h1>Paketit</h1>
        </div>
        <div className="error-message">
          <h3>Virhe pakettien latauksessa</h3>
          <p>{error}</p>
          <button 
            onClick={loadPackages} 
            className="btn btn-primary"
          >
            Yritä uudelleen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="packages-page">
      <div className="page-header">
        <h1>Paketit</h1>
        <p className="page-subtitle">
          Tuotepakettien hallinta ja selailu
        </p>
      </div>

      <div className="packages-controls">
        <div className="search-group">
          <input
            type="text"
            placeholder="Hae paketteja..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-control search-input"
          />
        </div>

        <div className="control-group">
          <label htmlFor="sort">Järjestä:</label>
          <select
            id="sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="form-control"
          >
            <option value="package_name">Paketin nimi</option>
            <option value="package_id">Paketti ID</option>
            <option value="package_product_line">Tuotelinja</option>
            <option value="created_at">Luontiaika</option>
          </select>
        </div>

        <button
          onClick={loadPackages}
          className="btn btn-secondary refresh-btn"
          disabled={loading}
        >
          🔄 Päivitä
        </button>
      </div>

      {error && (
        <div className="alert alert-warning">
          <strong>Varoitus:</strong> {error}
        </div>
      )}

      {!connectionStatus.connected && (
        <div className="alert alert-warning">
          <strong>Varoitus:</strong> Ei yhteyttä palvelimeen.
        </div>
      )}

      {filteredPackages.length === 0 ? (
        <div className="empty-state">
          <h3>Ei paketteja</h3>
          <p>
            {loading 
              ? 'Ladataan paketteja...'
              : searchQuery 
                ? `Hakusanalla "${searchQuery}" ei löytynyt paketteja.`
                : 'Paketteja ei löytynyt.'
            }
          </p>
        </div>
      ) : (
        <div className="packages-grid">
          {filteredPackages.map((pkg) => (
            <div key={pkg.package_id} className="package-card">
              <div className="package-header">
                <h3 className="package-name">
                  {pkg.package_name}
                </h3>
                <span className="package-id">
                  {pkg.package_id}
                </span>
              </div>
              
              <div className="package-details">
                <div className="detail-row">
                  <span className="label">Tuotelinja:</span>
                  <span className="value">{pkg.package_product_line}</span>
                </div>
                
                {pkg.description && (
                  <div className="detail-row">
                    <span className="label">Kuvaus:</span>
                    <span className="value">{pkg.description}</span>
                  </div>
                )}
                
                <div className="detail-row">
                  <span className="label">Luotu:</span>
                  <span className="value">
                    {new Date(pkg.created_at).toLocaleDateString('fi-FI')}
                  </span>
                </div>
                
                {pkg.created_by && (
                  <div className="detail-row">
                    <span className="label">Tekijä:</span>
                    <span className="value">{pkg.created_by}</span>
                  </div>
                )}
              </div>
              
              <div className="package-actions">
                <button className="btn btn-primary btn-small">
                  📋 Näytä tuotteet
                </button>
                <button className="btn btn-secondary btn-small">
                  ✏️ Muokkaa
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="packages-summary">
        <p>Näytetään {filteredPackages.length} pakettia {packages.length} paketista</p>
      </div>
    </div>
  );
};