import { useState, useEffect, useCallback, useMemo, useRef, memo, Fragment } from 'react';
import { useSocket } from '../context/SocketContext';
import { ProductContextMenu } from '../components/ProductContextMenu';
import { InstallationMethodModal } from '../components/InstallationMethodModal';
import type { ProductSearchResult } from '../types/api';
import './ProductsPage.css';

// Memoisoitu hakukenttä-komponentti - ei renderöidy uudelleen turhaan
const SearchInput = memo<{
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClear: () => void;
  activeOnly: boolean | null;
  onActiveOnlyChange: (value: boolean | null) => void;
}>(({ value, onChange, onSubmit, onClear, activeOnly, onActiveOnlyChange }) => {
  return (
    <form onSubmit={onSubmit} className="search-form">
      <div className="search-input-container">
        <input
          type="text"
          placeholder="🔍 Hae tuotteita... (hakutulokset päivittyvät reaaliajassa)"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="search-input-with-clear"
          autoComplete="off"
          spellCheck="false"
        />
        <button 
          type="button" 
          onClick={onClear}
          className={`search-clear-btn ${!value ? 'disabled' : ''}`}
          title="Tyhjennä hakukenttä"
          disabled={!value}
        >
          ✕
        </button>
        <select
          value={activeOnly === null ? 'all' : activeOnly ? 'active' : 'inactive'}
          onChange={(e) => {
            const val = e.target.value;
            onActiveOnlyChange(val === 'all' ? null : val === 'active');
          }}
          className="search-active-filter"
          title="Näytä vain aktiiviset tuotteet"
        >
          <option value="all">Kaikki tuotteet</option>
          <option value="active">Vain aktiiviset</option>
          <option value="inactive">Vain epäaktiiviset</option>
        </select>
      </div>
    </form>
  );
});

SearchInput.displayName = 'SearchInput';

export const ProductsPage = () => {
  const { socketClient, connectionStatus } = useSocket();
  const [products, setProducts] = useState<ProductSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState('general_name');
  const [totalProducts, setTotalProducts] = useState(0);
  
  // Virtualisointi ja lazy loading
  const [displayedCount, setDisplayedCount] = useState(50); // Aloitetaan 50 tuotteella
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const tableBodyRef = useRef<HTMLDivElement>(null);
  const ITEMS_PER_LOAD = 50;
  
  // Toimittajat ja tuotelinjat - ladataan aina näkyviin
  const [availableSuppliers, setAvailableSuppliers] = useState<{supplier_code: string; supplier_name: string}[]>([]);
  const [availableProductLines, setAvailableProductLines] = useState<string[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [loadingProductLines, setLoadingProductLines] = useState(false);
  
  // Hakutoiminto
  const [searchQuery, setSearchQuery] = useState('');
  const [currentSearchQuery, setCurrentSearchQuery] = useState(''); // Tallentaa viimeksi haetun queryn
  const [hasSearched, setHasSearched] = useState(false);
  
  // Context menu ja modal
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    product: ProductSearchResult;
  } | null>(null);
  const [installationModal, setInstallationModal] = useState<{
    isOpen: boolean;
    product: ProductSearchResult | null;
  }>({
    isOpen: false,
    product: null
  });
  
  // Expanded rivien hallinta asennustapojen näyttämiseksi
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [installationData, setInstallationData] = useState<{
    [key: string]: Array<{
      product_line: string;
      product_code: string;
      method_code: number;
      standard_hours: string;
      is_default: boolean;
      method_name: string;
      method_description?: string;
    }>;
  }>({});

  // Kaikki asennustavat ladattu muistiin kerran
  const [allInstallationsLoaded, setAllInstallationsLoaded] = useState(false);
  const [allInstallations, setAllInstallations] = useState<Array<{
    product_line: string;
    product_code: string;
    method_code: number;
    standard_hours: number;
    method_name: string;
    method_description?: string;
  }>>([]);

  // Asennustapojen lisäys/muokkaus
  const [showInstallationModal, setShowInstallationModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductSearchResult | null>(null);
  
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

  // Lataa kaikki asennustavat muistiin kerran sovelluksen käynnistyessä
  useEffect(() => {
    const loadAllInstallations = async () => {
      if (!socketClient || allInstallationsLoaded) return;
      
      try {
        console.log('🔧 Ladataan kaikki asennustavat muistiin...');
        const response = await socketClient.getAllProductInstallations();
        
        if (response && response.success && Array.isArray(response.data)) {
          setAllInstallations(response.data);
          setAllInstallationsLoaded(true);
          console.log(`✅ Ladattu ${response.data.length} asennustapaa muistiin`);
        } else {
          console.error('❌ Kaikkien asennustapojen lataus epäonnistui:', response);
        }
      } catch (error) {
        console.error('Kaikkien asennustapojen lataus epäonnistui:', error);
      }
    };

    loadAllInstallations();
  }, [socketClient, allInstallationsLoaded]);

  // Päivittää kaikki asennustavat uudelleen (esim. lisäyksen/poiston jälkeen)
  const refreshAllInstallations = useCallback(async () => {
    if (!socketClient) return;
    
    try {
      console.log('🔄 Päivitetään kaikki asennustavat...');
      const response = await socketClient.getAllProductInstallations();
      
      if (response && response.success && Array.isArray(response.data)) {
        setAllInstallations(response.data);
        console.log(`✅ Päivitetty ${response.data.length} asennustapaa muistiin`);
      }
    } catch (error) {
      console.error('Asennustapojen päivitys epäonnistui:', error);
    }
  }, [socketClient]);

  // Reagoi suodattimien muutoksiin - käynnistä uusi haku
  useEffect(() => {
    if (hasSearched) {
      // Jos on hakutilassa, käynnistä haku uudelleen tallennetulla hakusanalla
      loadProducts(currentSearchQuery);
    } else {
      // Jos on selailutilassa, käynnistä yleishaku
      loadProducts();
    }
  }, [searchFilters, hasSearched, loadProducts, currentSearchQuery]); // ✅ Käytetään currentSearchQuery

  // Säädä header-padding scrollbarin mukaan
  useEffect(() => {
    const adjustHeaderPadding = () => {
      const tableBody = tableBodyRef.current;
      if (tableBody) {
        const hasScrollbar = tableBody.scrollHeight > tableBody.clientHeight;
        const header = document.querySelector('.table-header') as HTMLElement;
        if (header) {
          // Pienemmät arvot vähentämään tyhjää tilaa oikealla
          const scrollbarWidth = hasScrollbar ? 10.5 : 0; // Vähennetty 17 -> 12
          const gapCompensation = 0; // Poistettu gap kompensaatio
          header.style.paddingRight = `${scrollbarWidth + gapCompensation}px`;
        }
      }
    };

    // Säädä heti
    adjustHeaderPadding();
    
    // Säädä kun sisältö muuttuu
    const timer = setTimeout(adjustHeaderPadding, 100);
    
    return () => clearTimeout(timer);
  }, [products, displayedCount]);

  // Debounced automaattinen haku - 500ms viive kirjoittamisen lopettamisen jälkeen
  useEffect(() => {
    // Älä tee hakua jos kenttä on tyhjä
    if (!searchQuery.trim()) {
      // Jos kenttä tyhjennettiin ja oli aiemmin hakutilassa, palaa selailutilaan
      if (hasSearched) {
        setHasSearched(false);
        setCurrentSearchQuery('');
        loadProducts(); // Lataa kaikki tuotteet
      }
      return;
    }

    // Debounce: odota 200ms ennen haun käynnistämistä (nopea viive)
    const searchTimer = setTimeout(async () => {
      console.log('Automaattinen haku käynnistyy:', searchQuery.trim());
      setCurrentSearchQuery(searchQuery.trim());
      setHasSearched(true);
      await loadProducts(searchQuery.trim());
    }, 200); // Vähennetty entisestään

    // Peruuta edellinen timer jos käyttäjä jatkaa kirjoittamista
    return () => clearTimeout(searchTimer);
  }, [searchQuery, loadProducts, hasSearched]); // Lisätään hasSearched dependencies

  // Memoisoidut callback-funktiot hakukentälle
  const handleSearchQueryChange = useCallback((newValue: string) => {
    setSearchQuery(newValue);
  }, []);

  const handleActiveOnlyChange = useCallback((newValue: boolean | null) => {
    setSearchFilters(prev => ({
      ...prev,
      activeOnly: newValue
    }));
  }, []);

  const handleSearchSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    // Haku tapahtuu nyt automaattisesti, tämä on varmuuden vuoksi
    if (!searchQuery.trim()) {
      setError('Syötä hakusana');
      return;
    }
    // Jos käyttäjä painaa Enter, käynnistä haku heti
    setCurrentSearchQuery(searchQuery.trim());
    setHasSearched(true);
    await loadProducts(searchQuery.trim());
  }, [searchQuery, loadProducts]);

  const clearSearch = () => {
    setSearchQuery('');
    setCurrentSearchQuery(''); // ✅ Tyhjennä myös tallennettu hakusana
    setHasSearched(false);
    setSearchFilters({
      suppliers: [],
      productLines: [],
      activeOnly: null
    });
    loadProducts();
  };

  // Context menu käsittelijät
  const handleProductRightClick = (event: React.MouseEvent, product: ProductSearchResult) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      product
    });
  };

  const handleContextMenuClose = () => {
    setContextMenu(null);
  };

  const handleAddInstallationMethod = (product: ProductSearchResult) => {
    setInstallationModal({
      isOpen: true,
      product
    });
  };

  const handleInstallationModalClose = () => {
    setInstallationModal({
      isOpen: false,
      product: null
    });
  };

  const handleInstallationSave = async (installationData: {
    methodCode: number;
    standardHours: number;
    notes?: string;
  }) => {
    try {
      if (!installationModal.product) return;

      console.log('Tallentaa asennustapa:', {
        product: installationModal.product.product_code,
        ...installationData
      });

      const response = await socketClient?.addProductInstallation({
        productCode: installationModal.product.product_code,
        productLine: installationModal.product.product_line,
        methodCode: installationData.methodCode,
        standardHours: installationData.standardHours,
        isDefault: false
      });

      if (response?.success) {
        console.log('Asennustapa tallennettu onnistuneesti!');
        // Päivitä sekä tuotekohtaiset että kaikki asennustavat
        await refreshAllInstallations();
        await loadProductInstallations(installationModal.product);
      } else {
        throw new Error(response?.error || 'Tallentaminen epäonnistui');
      }
      
    } catch (error) {
      console.error('Asennustavan tallennus epäonnistui:', error);
      // TODO: Näytä virheilmoitus käyttäjälle
      alert(`Virhe: ${error instanceof Error ? error.message : 'Tuntematon virhe'}`);
    }
  };

  // Tarkistaa onko tuotteella asennustapoja muistista ladatusta datasta
  const productHasInstallations = useCallback((product: ProductSearchResult): boolean => {
    return allInstallations.some(installation => 
      installation.product_line === product.product_line && 
      installation.product_code === product.product_code
    );
  }, [allInstallations]);

  // Laskee tuotteen asennustapojen määrän muistista ladatusta datasta
  const getProductInstallationCount = useCallback((product: ProductSearchResult): number => {
    return allInstallations.filter(installation => 
      installation.product_line === product.product_line && 
      installation.product_code === product.product_code
    ).length;
  }, [allInstallations]);

  // Rivien avaaminen/sulkeminen asennustapojen näyttämiseksi
  const toggleRowExpansion = async (product: ProductSearchResult) => {
    const productKey = `${product.product_line}-${product.product_code}`;
    const newExpandedRows = new Set(expandedRows);
    
    if (expandedRows.has(productKey)) {
      // Suljetaan rivi
      newExpandedRows.delete(productKey);
      setExpandedRows(newExpandedRows);
    } else {
      // Avataan rivi ja ladataan asennustavat
      newExpandedRows.add(productKey);
      setExpandedRows(newExpandedRows);
      await loadProductInstallations(product);
    }
  };

  // Lataa tuotteen asennustavat
  const loadProductInstallations = useCallback(async (product: ProductSearchResult) => {
    if (!socketClient) return;

    try {
      console.log('🔧 Haetaan asennustavat tuotteelle:', product.product_code, product.product_line);
      
      const response = await socketClient.getProductInstallations({
        productCode: product.product_code,
        productLine: product.product_line
      });

      console.log('📦 API vastaus asennustavoille:', response);

      if (response.success && response.data) {
        const productKey = `${product.product_line}-${product.product_code}`;
        console.log('✅ Tallennetaan asennustavat avaimelle:', productKey, 'data:', response.data);
        console.log('🔍 Ensimmäinen asennustapa:', response.data[0]);
        setInstallationData(prev => ({
          ...prev,
          [productKey]: (response.data || []) as unknown as Array<{
            product_line: string;
            product_code: string;
            method_code: number;
            standard_hours: string;
            is_default: boolean;
            method_name: string;
            method_description?: string;
          }>
        }));
      } else {
        console.log('❌ API vastaus ei sisältänyt dataa tai ei onnistunut:', response);
      }
    } catch (error) {
      console.error('Asennustapojen lataus epäonnistui:', error);
    }
  }, [socketClient]);

  // Lisää asennustapa tuotteelle
  const addInstallationMethod = (product: ProductSearchResult) => {
    console.log('➕ Avataan asennustapa-modal tuotteelle:', product.product_code);
    setEditingProduct(product);
    setShowInstallationModal(true);
    console.log('📱 Modal state:', { showInstallationModal: true, editingProduct: product });
  };

  // Poista asennustapa tuotteelta
  const removeInstallationMethod = async (product: ProductSearchResult, methodCode: number) => {
    if (!socketClient) return;

    if (!confirm('Haluatko varmasti poistaa tämän asennustavan?')) {
      return;
    }

    try {
      console.log('🗑️ Poistetaan asennustapa:', product.product_line, product.product_code, methodCode);
      
      const response = await socketClient.apiRequest('remove_product_installation', {
        productLine: product.product_line,
        productCode: product.product_code,
        methodCode: methodCode
      });

      console.log('📦 Poisto-vastaus:', response);

      if (response && (response as { success: boolean }).success) {
        console.log('✅ Asennustapa poistettu onnistuneesti');
        // Päivitä sekä tuotekohtaiset että kaikki asennustavat
        await refreshAllInstallations();
        await loadProductInstallations(product);
      } else {
        console.error('❌ Asennustavan poisto epäonnistui:', response);
        alert('Asennustavan poisto epäonnistui');
      }
    } catch (error) {
      console.error('Asennustavan poisto epäonnistui:', error);
      alert('Asennustavan poisto epäonnistui: ' + (error as Error).message);
    }
  };

  // Tuotteet järjestettyinä - kaikki haku ja suodatus tapahtuu palvelimella
  const filteredProducts = useMemo(() => {
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
  }, [products, sortBy]);

  // POISTETTU: Automaattinen asennustapojen lataus kaikille tuotteille
  // Tämä aiheutti liikaa tietokantayhteyksiä ja kaatoi järjestelmän

  // Virtualisointi - näytetään vain tietty määrä tuotteita
  const visibleProducts = useMemo(() => {
    return filteredProducts.slice(0, displayedCount);
  }, [filteredProducts, displayedCount]);

  // Scroll handler lisää tuotteita tarpeen mukaan
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;
    
    // Kun scrollataan 80% loppuun, ladataan lisää
    if (scrollPercentage > 0.8 && !isLoadingMore && displayedCount < filteredProducts.length) {
      setIsLoadingMore(true);
      
      // Simuloidaan loading delay
      setTimeout(() => {
        setDisplayedCount(prev => Math.min(prev + ITEMS_PER_LOAD, filteredProducts.length));
        setIsLoadingMore(false);
      }, 200);
    }
  }, [isLoadingMore, displayedCount, filteredProducts.length, ITEMS_PER_LOAD]);

  // Reset displayed count kun filtterit muuttuvat
  useEffect(() => {
    setDisplayedCount(ITEMS_PER_LOAD);
  }, [searchQuery, searchFilters, ITEMS_PER_LOAD]);

  // Näytä loading vain alussa kun ei ole vielä haettu mitään
  if (loading && products.length === 0 && !hasSearched) {
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
      <div className="container-fluid">
        {/* Hakukenttä */}
        <div className="search-section">
          <div className="search-card">
            <div className="search-header">
              <h1 className="search-title">🔍 Tuotteiden haku</h1>
              <p className="search-subtitle">
                {hasSearched 
                  ? `Hakutulokset - ${totalProducts} tuotetta löydetty`
                  : `Tuoteluettelo - ${totalProducts} tuotetta saatavilla`
                }
              </p>
            </div>
            <SearchInput
              value={searchQuery}
              onChange={handleSearchQueryChange}
              onSubmit={handleSearchSubmit}
              onClear={clearSearch}
              activeOnly={searchFilters.activeOnly}
              onActiveOnlyChange={handleActiveOnlyChange}
            />
        
        {/* Suodattimet samassa kortissa */}
        <div className="filters-section">
          <h3>🔧 Suodattimet</h3>
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
        </div> {/* filters-section */}
      </div> {/* search-card */}
      </div> {/* search-section */}

      {/* Selaussuodattimet - näytetään vain selailutilassa */}
      {!hasSearched && (
        <div className="products-controls">
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
              : hasSearched && currentSearchQuery
                ? `Hakusanalla "${currentSearchQuery}" ei löytynyt tuotteita.`
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
          {/* Kiinteät otsikot */}
          <div className="table-header">
            <div className="header-row">
              <div className="header-cell product-number-col">Tuotenumero</div>
              <div className="header-cell product-name-col">Nimi</div>
              <div className="header-cell technical-name-col">Tekninen nimi</div>
              <div className="header-cell supplier-col">Toimittaja</div>
              <div className="header-cell manufacturer-col">Valmistaja</div>
              <div className="header-cell unit-col">Yksikkö</div>
              <div className="header-cell status-col">Aktiivinen</div>
            </div>
          </div>
          
          {/* Scrollattava sisältöalue */}
          <div 
            className="table-body" 
            ref={tableBodyRef}
            onScroll={handleScroll}
          >
            {visibleProducts.map((product) => {
              const productKey = `${product.product_line}-${product.product_code}`;
              const isExpanded = expandedRows.has(productKey);
              const installations = installationData[productKey] || [];
              // Käytetään muistista ladattua dataa visuaalisiin indikaattoreihin
              const hasInstallations = productHasInstallations(product);
              const installationCount = getProductInstallationCount(product);
              
              return (
                <Fragment key={productKey}>
                  <div 
                    className="product-row"
                    onContextMenu={(e) => handleProductRightClick(e, product)}
                  >
                    <div className="product-cell product-number-col">
                      <div className="expand-btn-container">
                        <button
                          className={`expand-btn ${isExpanded ? 'expanded' : ''} ${hasInstallations ? 'has-installations' : ''}`}
                          onClick={() => toggleRowExpansion(product)}
                          title={hasInstallations ? `Näytä asennustavat (${installationCount} kpl)` : "Näytä asennustavat"}
                        >
                          {isExpanded ? '▼' : '▶'}
                        </button>
                        {hasInstallations && (
                          <span className="installations-count">{installationCount}</span>
                        )}
                      </div>
                      <div className="product-number-content">
                        <span className="product-line">{product.product_line}</span>
                        <span className="product-code">{product.product_code}</span>
                      </div>
                    </div>
                    <div className="product-cell product-name-col">
                      {product.general_name || '-'}
                    </div>
                    <div className="product-cell technical-name-col">
                      {product.technical_name || '-'}
                    </div>
                    <div className="product-cell supplier-col">
                      {product.supplier_name}
                    </div>
                    <div className="product-cell manufacturer-col">
                      {product.manufacturer || '-'}
                    </div>
                    <div className="product-cell unit-col">
                      {product.unit || '-'}
                    </div>
                    <div className="product-cell status-col">
                      <span className={`status-badge ${product.active ? 'active' : 'inactive'}`}>
                        {product.active ? 'Kyllä' : 'Ei'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Asennustavat-rivi */}
                  {isExpanded && (
                    <div className="product-installations-row">
                      <div className="installations-content">
                        <div className="installations-header">
                          <h4>Asennustavat tuotteelle {product.product_code}:</h4>
                          <button
                            className="add-installation-btn"
                            onClick={() => addInstallationMethod(product)}
                            title="Lisää asennustapa"
                          >
                            + Lisää asennustapa
                          </button>
                        </div>
                        {(() => {
                          console.log('🎨 Renderöidään asennustavat tuotteelle:', productKey, 'installations:', installations);
                          return null;
                        })()}
                        {installations.length > 0 ? (
                          <div className="installations-list">
                            {installations.map((installation) => (
                              <div key={installation.method_code} className="installation-item">
                                <span className="installation-method">{installation.method_name}</span>
                                <span className="installation-time">{installation.standard_hours}h</span>
                                {installation.method_description && (
                                  <span className="installation-notes">{installation.method_description}</span>
                                )}
                                <button
                                  className="remove-installation-btn"
                                  onClick={() => removeInstallationMethod(product, installation.method_code)}
                                  title="Poista asennustapa"
                                >
                                  🗑️
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="no-installations-wrapper">
                            <p className="no-installations">Ei asennustapoja määritelty</p>
                            <button
                              className="add-first-installation-btn"
                              onClick={() => addInstallationMethod(product)}
                            >
                              Lisää ensimmäinen asennustapa
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </Fragment>
              );
            })}
            
            {/* Loading indicator */}
            {isLoadingMore && (
              <div className="loading-more">
                <div className="spinner-small"></div>
                <span>Ladataan lisää tuotteita...</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="products-summary">
        <p>
          {hasSearched 
            ? `Hakutulokset: ${visibleProducts.length}/${filteredProducts.length} tuotetta näytetään (${totalProducts} yhteensä)`
            : `Näytetään ${visibleProducts.length}/${filteredProducts.length} tuotetta (${totalProducts} yhteensä)`
          }
        </p>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ProductContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          product={contextMenu.product}
          onClose={handleContextMenuClose}
          onAddInstallationMethod={handleAddInstallationMethod}
        />
      )}

      {/* Installation Method Modal */}
      {socketClient && (
        <InstallationMethodModal
          isOpen={installationModal.isOpen}
          product={installationModal.product}
          socketClient={socketClient}
          onClose={handleInstallationModalClose}
          onSave={handleInstallationSave}
        />
      )}
            
      </div> {/* container-fluid */}
    </div> {/* products-page */}
      {/* Installation Method Modal */}
      {(() => {
        console.log('🔍 Modal render check:', { 
          showInstallationModal, 
          editingProduct: !!editingProduct, 
          socketClient: !!socketClient 
        });
        return null;
      })()}
      {showInstallationModal && editingProduct && socketClient && (
        <InstallationMethodModal
          isOpen={showInstallationModal}
          onClose={() => {
            console.log('❌ Suljetaan asennustapa-modal');
            setShowInstallationModal(false);
            setEditingProduct(null);
          }}
          onSave={async (installationData) => {
            console.log('💾 Tallennetaan asennustapa:', installationData);
            try {
              const response = await socketClient.apiRequest('add_product_installation', {
                productLine: editingProduct.product_line,
                productCode: editingProduct.product_code,
                methodCode: installationData.methodCode,
                standardHours: installationData.standardHours,
                notes: installationData.notes
              });

              console.log('📦 Tallennusvastaus:', response);

              if (response && (response as { success: boolean }).success) {
                console.log('✅ Asennustapa tallennettu onnistuneesti');
                // Päivitä asennustavat kun tallennus on valmis
                await loadProductInstallations(editingProduct);
              } else {
                console.error('❌ Asennustavan tallennus epäonnistui:', response);
                alert('Asennustavan tallennus epäonnistui');
                return; // Älä sulje modaalia jos tallennus epäonnistui
              }
            } catch (error) {
              console.error('Asennustavan tallennus epäonnistui:', error);
              alert('Asennustavan tallennus epäonnistui: ' + (error as Error).message);
              return; // Älä sulje modaalia jos tallennus epäonnistui
            }

            setShowInstallationModal(false);
            setEditingProduct(null);
          }}
          product={editingProduct}
          socketClient={socketClient}
        />
      )}
    </div>
  );
};