import { useState } from 'react';
import { useSocket } from '../context/SocketContext';
import type { ProductSearchResult } from '../types/api';
import './ProductSearchPage.css';

interface SearchFilters {
  supplier: string;
  productLine: string;
  activeOnly: boolean | null;
}

export const ProductSearchPage = () => {
  const { socketClient, connectionStatus } = useSocket();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  
  const [filters, setFilters] = useState<SearchFilters>({
    supplier: '',
    productLine: '',
    activeOnly: null
  });

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) {
      setError('Syötä hakusana');
      return;
    }

    if (!socketClient || !connectionStatus.connected) {
      setError('Ei yhteyttä palvelimeen');
      return;
    }

    try {
      setIsSearching(true);
      setError(null);
      setHasSearched(true);
      
      // Käytä Socket.IO:n kautta backend API:a
      const response = await socketClient.searchProducts(searchQuery.trim(), {
        limit: 50,
        activeOnly: filters.activeOnly ?? true,
        supplier: filters.supplier || undefined,
        productLine: filters.productLine || undefined
      });
      
      if (response.success && response.data) {
        setSearchResults(response.data.products || []);
        setTotalResults(response.data.pagination?.total || 0);
      } else {
        throw new Error(response.message || 'Haku epäonnistui');
      }
    } catch (error) {
      console.error('Search error:', error);
      setError(error instanceof Error ? error.message : 'Haku epäonnistui');
      setSearchResults([]);
      setTotalResults(0);
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setError(null);
    setHasSearched(false);
    setTotalResults(0);
    setFilters({
      supplier: '',
      productLine: '',
      activeOnly: null
    });
  };

  const updateFilter = (key: keyof SearchFilters, value: string | boolean | null) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <div className="product-search-page">
      <div className="page-header">
        <h1>Tuotehaku</h1>
        <p className="page-subtitle">Hae tuotteita nimen, koodin tai teknisen nimen perusteella</p>
      </div>

      {/* Hakukenttä */}
      <form onSubmit={handleSearch} className="search-form">
        <div className="search-input-group">
          <input
            type="text"
            placeholder="Syötä hakusana (tuotenimi, koodi, tekninen nimi...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
            disabled={isSearching}
          />
          <button 
            type="submit" 
            className="btn btn-primary search-btn"
            disabled={isSearching || !connectionStatus.connected}
          >
            {isSearching ? 'Hakee...' : '🔍 Hae'}
          </button>
          {hasSearched && (
            <button 
              type="button" 
              onClick={clearSearch}
              className="btn btn-secondary clear-btn"
            >
              ✕ Tyhjennä
            </button>
          )}
        </div>
      </form>

      {/* Suodattimet */}
      <div className="search-filters">
        <h3>Suodattimet</h3>
        <div className="filters-grid">
          <div className="filter-group">
            <label htmlFor="supplier-filter">Toimittaja:</label>
            <input
              id="supplier-filter"
              type="text"
              placeholder="Toimittajan nimi"
              value={filters.supplier}
              onChange={(e) => updateFilter('supplier', e.target.value)}
              className="form-control"
            />
          </div>

          <div className="filter-group">
            <label htmlFor="product-line-filter">Tuotelinja:</label>
            <input
              id="product-line-filter"
              type="text"
              placeholder="Tuotelinja"
              value={filters.productLine}
              onChange={(e) => updateFilter('productLine', e.target.value)}
              className="form-control"
            />
          </div>

          <div className="filter-group">
            <label htmlFor="active-filter">Tila:</label>
            <select
              id="active-filter"
              value={filters.activeOnly === null ? '' : String(filters.activeOnly)}
              onChange={(e) => updateFilter('activeOnly', e.target.value === '' ? null : e.target.value === 'true')}
              className="form-control"
            >
              <option value="">Kaikki</option>
              <option value="true">Vain aktiiviset</option>
              <option value="false">Vain ei-aktiiviset</option>
            </select>
          </div>
        </div>
      </div>

      {/* Virhe-ilmoitus */}
      {error && (
        <div className="alert alert-danger">
          <strong>Virhe:</strong> {error}
        </div>
      )}

      {/* Yhteysongelma */}
      {!connectionStatus.connected && (
        <div className="alert alert-warning">
          <strong>Varoitus:</strong> Ei yhteyttä palvelimeen. Haku ei ole käytettävissä.
        </div>
      )}

      {/* Hakutulokset */}
      {hasSearched && (
        <div className="search-results">
          <div className="results-header">
            <h2>
              Hakutulokset
              {totalResults > 0 && (
                <span className="results-count">
                  ({searchResults.length}/{totalResults})
                </span>
              )}
            </h2>
            {searchQuery && (
              <p className="search-query">Hakusana: <strong>"{searchQuery}"</strong></p>
            )}
          </div>

          {isSearching ? (
            <div className="loading-spinner">
              <div className="spinner"></div>
              <p>Hakee tuotteita...</p>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="no-results">
              <h3>Ei tuloksia</h3>
              <p>Hakusanalla "{searchQuery}" ei löytynyt tuotteita.</p>
              <ul>
                <li>Tarkista hakusanan oikeinkirjoitus</li>
                <li>Kokeile lyhyempää hakusanaa</li>
                <li>Poista suodattimia</li>
              </ul>
            </div>
          ) : (
            <div className="results-grid">
              {searchResults.map((product) => (
                <div key={`${product.product_line}-${product.product_code}`} className="result-card">
                  <div className="result-header">
                    <h3 className="result-title">
                      {product.general_name || product.technical_name || 'Nimetön tuote'}
                    </h3>
                    <span className={`result-status ${product.active ? 'active' : 'inactive'}`}>
                      {product.active ? 'Aktiivinen' : 'Ei aktiivinen'}
                    </span>
                  </div>
                  
                  <div className="result-details">
                    <div className="detail-row">
                      <span className="label">Tuotekoodi:</span>
                      <span className="value highlight">{product.product_code}</span>
                    </div>
                    
                    <div className="detail-row">
                      <span className="label">Tuotelinja:</span>
                      <span className="value">{product.product_line}</span>
                    </div>
                    
                    <div className="detail-row">
                      <span className="label">Toimittaja:</span>
                      <span className="value">{product.supplier_name}</span>
                    </div>
                    
                    {product.manufacturer && (
                      <div className="detail-row">
                        <span className="label">Valmistaja:</span>
                        <span className="value">{product.manufacturer}</span>
                      </div>
                    )}
                    
                    {product.unit && (
                      <div className="detail-row">
                        <span className="label">Yksikkö:</span>
                        <span className="value">{product.unit}</span>
                      </div>
                    )}
                    
                    {product.ean_code && (
                      <div className="detail-row">
                        <span className="label">EAN:</span>
                        <span className="value">{product.ean_code}</span>
                      </div>
                    )}

                    {product.quick_code && (
                      <div className="detail-row">
                        <span className="label">Pikakoodi:</span>
                        <span className="value">{product.quick_code}</span>
                      </div>
                    )}
                  </div>
                  
                  {product.technical_name && product.technical_name !== product.general_name && (
                    <div className="result-footer">
                      <div className="technical-name">
                        <strong>Tekninen nimi:</strong> {product.technical_name}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};