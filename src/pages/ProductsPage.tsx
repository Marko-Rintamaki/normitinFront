import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import type { ProductSearchResult } from '../types/api';
import './ProductsPage.css';

export const ProductsPage = () => {
  const { socketClient, connectionStatus } = useSocket();
  const [products, setProducts] = useState<ProductSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState('general_name');
  const [totalProducts, setTotalProducts] = useState(0);
  
  // Toimittajat ja tuotelinjat - ladataan aina näkyviin
  const [availableSuppliers, setAvailableSuppliers] = useState<{supplier_code: string; supplier_name: string}[]>([]);
  const [availableProductLines, setAvailableProductLines] = useState<string[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [loadingProductLines, setLoadingProductLines] = useState(false);
  
  // Hakutoiminto
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  // Ladataan toimittajavalinnat localStoragesta
  const loadSavedSuppliers = (): string[] => {
    try {
      const saved = localStorage.getItem('normitin_selected_suppliers');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  };
  
  const [searchFilters, setSearchFilters] = useState({
    suppliers: loadSavedSuppliers(), // Ladataan tallennettuja valintoja
    productLines: [] as string[], // Tuotelinjat
    activeOnly: null as boolean | null
  });

  const loadProducts = useCallback(async (query?: string) => {
    if (!socketClient || !connectionStatus.connected) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const searchParams = {
        limit: 10000  // Nostetaan limit isoksi että saadaan kaikki tuotelinjat
      } as {
        limit: number;
        query?: string;
        supplier?: string;
        productLine?: string;
        suppliers?: string[];
        productLines?: string[];
        activeOnly?: boolean;
      };

      if (query && query.trim()) {
        // Hakutila
        searchParams.query = query.trim();
      } else {
        // Selailutila - käytetään tyhjä hakusana jotta saadaan kaikki tuotteet
        console.log('🔍 Frontend Debug: Loading all products with search_products (empty query)...');
        searchParams.query = ''; // Tyhjä hakusana hakee kaikki
      }
      
      // Lähetetään suodattimet backendiin
      if (searchFilters.activeOnly !== null) {
        searchParams.activeOnly = searchFilters.activeOnly;
      }
      
      if (searchFilters.suppliers.length > 0) {
        // Lähetetään kaikki valitut toimittajat
        searchParams.suppliers = searchFilters.suppliers;
      }
      
      if (searchFilters.productLines.length > 0) {
        // Lähetetään kaikki valitut tuotelinjat
        searchParams.productLines = searchFilters.productLines;
      }
      
      const response = await socketClient.searchProducts(searchParams.query, searchParams);
      
      if (response.success && response.data) {
        setProducts(response.data.products || []);
        setTotalProducts(response.data.pagination?.total || 0);
      } else {
        throw new Error(response.message || 'Failed to load products');
      }
    } catch (error) {
      console.error('Error loading products:', error);
      setError(error instanceof Error ? error.message : 'Failed to load products');
      setProducts([]);
    } finally {
      setLoading(false);
      setIsSearching(false);
    }
  }, [socketClient, connectionStatus.connected, searchFilters]);

    // Hae saatavilla olevat toimittajat suppliers-taulusta
  const loadSuppliers = useCallback(async () => {
    if (!socketClient || !connectionStatus.connected) return;
    
    try {
      setLoadingSuppliers(true);
      
      const response = await socketClient.getSuppliers();
      
      if (response.success && response.data) {
        setAvailableSuppliers(response.data);
      }
    } catch (error) {
      console.error('Error loading suppliers:', error);
    } finally {
      setLoadingSuppliers(false);
    }
  }, [socketClient, connectionStatus.connected]);

  // Hae saatavilla olevat tuotelinjat tietokannasta
  const loadProductLines = useCallback(async () => {
    if (!socketClient || !connectionStatus.connected) return;
    
    try {
      setLoadingProductLines(true);
      
      const response = await socketClient.getProductLines();
      
      if (response.success && response.data) {
        setAvailableProductLines(response.data);
      }
    } catch (error) {
      console.error('Error loading product lines:', error);
    } finally {
      setLoadingProductLines(false);
    }
  }, [socketClient, connectionStatus.connected]);

  // Toimittajien checkbox-hallinta localStorage-tallennuksella
  const toggleSupplier = (supplier: {supplier_code: string; supplier_name: string}) => {
    const newSuppliers = searchFilters.suppliers.includes(supplier.supplier_name)
      ? searchFilters.suppliers.filter(s => s !== supplier.supplier_name)
      : [...searchFilters.suppliers, supplier.supplier_name];
    
    // Tallennetaan localStorage:iin
    localStorage.setItem('normitin_selected_suppliers', JSON.stringify(newSuppliers));
    
    setSearchFilters(prev => ({
      ...prev,
      suppliers: newSuppliers
    }));
  };

  // Tuotelinjojen checkbox-hallinta
  const toggleProductLine = (productLine: string) => {
    setSearchFilters(prev => ({
      ...prev,
      productLines: prev.productLines.includes(productLine)
        ? prev.productLines.filter(pl => pl !== productLine)
        : [...prev.productLines, productLine]
    }));
  };

  useEffect(() => {
    if (!hasSearched) {
      loadProducts();
    }
    // Hae toimittajat ja tuotelinjat aina kun komponentti latautuu
    loadSuppliers();
    loadProductLines();
  }, [loadProducts, loadSuppliers, loadProductLines, hasSearched]);

  // Reagoi suodattimien muutoksiin - käynnistä uusi haku
  useEffect(() => {
    if (hasSearched) {
      // Jos on hakutilassa, käynnistä haku uudelleen hakusanalla
      loadProducts(searchQuery);
    } else {
      // Jos on selailutilassa, käynnistä yleishaku
      loadProducts();
    }
  }, [searchFilters, hasSearched, loadProducts, searchQuery]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) {
      setError('Syötä hakusana');
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    await loadProducts(searchQuery);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setHasSearched(false);
    setSearchFilters({
      suppliers: [],
      productLines: [],
      activeOnly: null
    });
    loadProducts();
  };

  const updateSearchFilter = (key: string, value: string | boolean | null) => {
    setSearchFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const getFilteredProducts = () => {
    // Suodatus tapahtuu nyt backendissä, tässä vain järjestetään tulokset
    return [...products].sort((a, b) => {
      switch (sortBy) {
        case 'general_name':
          return (a.general_name || '').localeCompare(b.general_name || '');
        case 'product_code':
          return a.product_code.localeCompare(b.product_code);
        case 'supplier_name':
          return a.supplier_name.localeCompare(b.supplier_name);
        case 'manufacturer':
          return (a.manufacturer || '').localeCompare(b.manufacturer || '');
        default:
          return 0;
      }
    });
  };

  const filteredProducts = getFilteredProducts();

  if (loading && products.length === 0) {
    return (
      <div className="products-page">
        <div className="page-header">
          <h1>Tuotteet</h1>
        </div>
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Ladataan tuotteita...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="products-page">
      <div className="page-header">
        <h1>Tuotteet</h1>
        <p className="page-subtitle">
          {hasSearched 
            ? `Hakutulokset - ${totalProducts} tuotetta`
            : `Tuotteiden selaus ja haku - ${totalProducts} tuotetta`
          }
        </p>
      </div>

      {/* Hakukenttä */}
      <div className="search-section">
        <form onSubmit={handleSearch} className="search-form">
          <div className="search-input-group">
            <input
              type="text"
              placeholder="Hae tuotteita nimen, koodin tai teknisen nimen perusteella..."
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
      </div>

      {/* Suodattimet - aina näkyvissä */}
      <div className="filters-section">
        <h3>Suodattimet</h3>
        <div className="filters-grid">
          <div className="filter-group">
            <label>Toimittajat:</label>
            {loadingSuppliers ? (
              <p>Ladataan toimittajia...</p>
            ) : (
              <div className="supplier-checkboxes">
                {availableSuppliers.map(supplier => (
                  <label key={supplier.supplier_code} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={searchFilters.suppliers.includes(supplier.supplier_name)}
                      onChange={() => toggleSupplier(supplier)}
                      className="checkbox"
                    />
                    <span className="checkbox-text">{supplier.supplier_name}</span>
                    <span className="supplier-count">
                      ({products.filter(p => p.supplier_name === supplier.supplier_name).length})
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="filter-group">
            <label>Tuotelinjat:</label>
            {loadingProductLines ? (
              <p>Ladataan tuotelinjoja...</p>
            ) : (
              <div className="supplier-checkboxes">
                {availableProductLines.map(productLine => (
                  <label key={productLine} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={searchFilters.productLines.includes(productLine)}
                      onChange={() => toggleProductLine(productLine)}
                      className="checkbox"
                    />
                    <span className="checkbox-text">{productLine}</span>
                    <span className="supplier-count">
                      ({products.filter(p => p.product_line === productLine).length})
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {hasSearched && (
            <div className="filter-group">
              <label htmlFor="active-search-filter">Tila:</label>
              <select
                id="active-search-filter"
                value={searchFilters.activeOnly === null ? '' : searchFilters.activeOnly.toString()}
                onChange={(e) => updateSearchFilter('activeOnly', e.target.value === '' ? null : e.target.value === 'true')}
                className="form-control"
              >
                <option value="">Kaikki</option>
                <option value="true">Vain aktiiviset</option>
                <option value="false">Vain ei-aktiiviset</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Selaussuodattimet - näytetään vain selailutilassa */}
      {!hasSearched && (
        <div className="products-controls">
          <div className="control-group">
            <label htmlFor="filter">Suodata:</label>
            <select
              id="filter"
              value={searchFilters.activeOnly === null ? 'all' : searchFilters.activeOnly === true ? 'active' : 'inactive'}
              onChange={(e) => {
                const value = e.target.value;
                updateSearchFilter('activeOnly', value === 'all' ? null : value === 'active');
              }}
              className="form-control"
            >
              <option value="all">Kaikki tuotteet</option>
              <option value="active">Aktiiviset</option>
              <option value="inactive">Ei aktiiviset</option>
            </select>
          </div>

          <div className="control-group">
            <label htmlFor="sort">Järjestä:</label>
            <select
              id="sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="form-control"
            >
              <option value="general_name">Tuotenimi</option>
              <option value="product_code">Tuotekoodi</option>
              <option value="supplier_name">Toimittaja</option>
              <option value="manufacturer">Valmistaja</option>
            </select>
          </div>

          <button
            onClick={() => loadProducts()}
            className="btn btn-secondary refresh-btn"
            disabled={loading}
          >
            🔄 Päivitä
          </button>
        </div>
      )}

      {/* Virhe-ilmoitus */}
      {error && (
        <div className="alert alert-danger">
          <strong>Virhe:</strong> {error}
        </div>
      )}

      {/* Yhteysongelma */}
      {!connectionStatus.connected && (
        <div className="alert alert-warning">
          <strong>Varoitus:</strong> Ei yhteyttä palvelimeen.
        </div>
      )}

      {/* Tuotelistaus */}
      {filteredProducts.length === 0 ? (
        <div className="empty-state">
          <h3>Ei tuotteita</h3>
          <p>
            {loading 
              ? 'Ladataan tuotteita...'
              : hasSearched && searchQuery
                ? `Hakusanalla "${searchQuery}" ei löytynyt tuotteita.`
                : 'Tuotteita ei löytynyt valituilla suodattimilla.'
            }
          </p>
          {hasSearched && (
            <ul>
              <li>Tarkista hakusanan oikeinkirjoitus</li>
              <li>Kokeile lyhyempää hakusanaa</li>
              <li>Poista hakusuodattimia</li>
            </ul>
          )}
        </div>
      ) : (
        <div className="products-table-container">
          <table className="products-table">
            <thead>
              <tr>
                <th>Tuotenumero</th>
                <th>Nimi</th>
                <th>Tekninen nimi</th>
                <th>Toimittaja</th>
                <th>Valmistaja</th>
                <th>Yksikkö</th>
                <th>Aktiivinen</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr key={`${product.product_line}-${product.product_code}`} className="product-row">
                  <td className="product-number">
                    <span className="product-line">{product.product_line}</span>
                    <span className="product-code">{product.product_code}</span>
                  </td>
                  <td className="product-name">
                    {product.general_name || '-'}
                  </td>
                  <td className="technical-name">
                    {product.technical_name || '-'}
                  </td>
                  <td className="supplier">
                    {product.supplier_name}
                  </td>
                  <td className="manufacturer">
                    {product.manufacturer || '-'}
                  </td>
                  <td className="unit">
                    {product.unit || '-'}
                  </td>
                  <td className="status">
                    <span className={`status-badge ${product.active ? 'active' : 'inactive'}`}>
                      {product.active ? 'Kyllä' : 'Ei'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="products-summary">
        <p>
          {hasSearched 
            ? `Hakutulokset: ${filteredProducts.length}/${totalProducts} tuotetta`
            : `Näytetään ${filteredProducts.length} tuotetta ${totalProducts} tuotteesta`
          }
        </p>
      </div>
    </div>
  );
};