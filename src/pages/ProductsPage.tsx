import { useState, useEffect, useCallback, useMemo, useRef, memo, Fragment } from 'react';
import { useSocket } from '../context/SocketContext';
import { ProductContextMenu } from '../components/ProductContextMenu';
import { InstallationMethodModal } from '../components/InstallationMethodModal';
import { PackageModal } from '../components/PackageModal';
import { ReplaceProductModal } from '../components/ReplaceProductModal';
import type { ProductSearchResult } from '../types/api';
import './ProductsPage.css';

// Memoisoitu hakukenttä-komponentti - ei renderöidy uudelleen turhaan
const SearchInput = memo<{
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClear: () => void;
}>(({ value, onChange, onSubmit, onClear }) => {
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
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [totalProducts, setTotalProducts] = useState(0);
  
  // Backend-pohjainen sivutus (infinite scroll)
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentOffset, setCurrentOffset] = useState(0);
  const tableBodyRef = useRef<HTMLDivElement>(null);
  const ITEMS_PER_PAGE = 100; // Haetaan 100 tuotetta kerralla backendistä
  
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

  const [packageModal, setPackageModal] = useState<{
    isOpen: boolean;
    product: ProductSearchResult | null;
  }>({
    isOpen: false,
    product: null
  });

  const [replaceProductModal, setReplaceProductModal] = useState<{
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

  // Kaikki paketit ladattu muistiin kerran  
  const [allPackagesLoaded, setAllPackagesLoaded] = useState(false);
  const [allPackages, setAllPackages] = useState<Array<{
    package_id?: string;
    package_name: string;
    package_product_line: string;
    package_number: string;
    memo?: string;
    created?: string;
  }>>([]);
  
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
    activeOnly: null as boolean | null,
    hasReferences: null as boolean | null,
    replacementStatus: undefined as string | undefined,
    updatedAfter: undefined as string | undefined,
    hasInstallationMethod: null as boolean | null // null = kaikki, true = vain asennustavalla, false = ilman asennustapaa
  });

  // Dropdownien avaus/sulku tila
  const [dropdownOpen, setDropdownOpen] = useState({
    suppliers: false,
    productLines: false
  });

  const loadProducts = useCallback(async (query?: string, append = false) => {
    if (!socketClient || !connectionStatus.connected) return;
    
    try {
      if (!append) {
        setLoading(true);
        setCurrentOffset(0);
      } else {
        setIsLoadingMore(true);
      }
      setError(null);
      
      const offset = append ? currentOffset : 0;
      
      const searchParams = {
        limit: ITEMS_PER_PAGE,  // 100 tuotetta kerralla
        offset: offset
      } as {
        limit: number;
        offset: number;
        query?: string;
        supplier?: string;
        productLine?: string;
        suppliers?: string[];
        productLines?: string[];
        activeOnly?: boolean;
        hasReferences?: boolean;
        replacementStatus?: string;
        updatedAfter?: string;
        hasInstallationMethod?: boolean;
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
      
      if (searchFilters.hasReferences !== null) {
        searchParams.hasReferences = searchFilters.hasReferences;
      }
      
      if (searchFilters.replacementStatus !== undefined) {
        searchParams.replacementStatus = searchFilters.replacementStatus;
        console.log('🔍 Replacement status filter:', searchFilters.replacementStatus);
      }
      
      if (searchFilters.updatedAfter !== undefined) {
        searchParams.updatedAfter = searchFilters.updatedAfter;
        console.log('🔍 Updated after filter:', searchFilters.updatedAfter);
      }
      
      if (searchFilters.hasInstallationMethod !== null) {
        searchParams.hasInstallationMethod = searchFilters.hasInstallationMethod;
        console.log('🔍 Installation method filter:', searchFilters.hasInstallationMethod);
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
      
      console.log('🔍 Search params sent to backend:', searchParams);
      console.log('🔍 Products received:', response.data?.products.length);
      
      if (response.success && response.data) {
        if (append) {
          // Lisätään uudet tuotteet vanhojen perään
          setProducts(prev => [...prev, ...(response.data?.products || [])]);
        } else {
          // Korvataan kaikki tuotteet
          setProducts(response.data.products || []);
        }
        setTotalProducts(response.data.pagination?.total || 0);
        setHasMore(response.data.pagination?.hasMore || false);
        setCurrentOffset(offset + (response.data.products?.length || 0));
      } else {
        throw new Error(response.message || 'Failed to load products');
      }
    } catch (error) {
      console.error('Error loading products:', error);
      setError(error instanceof Error ? error.message : 'Failed to load products');
      if (!append) {
        setProducts([]);
      }
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
    }
  }, [socketClient, connectionStatus.connected, searchFilters, currentOffset, ITEMS_PER_PAGE]);

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
    // Ladataan data järjestyksessä initial loadissa
    const initializeData = async () => {
      if (!socketClient || !connectionStatus.connected) return;
      
      try {
        // 1. Lataa toimittajat ja tuotelinjat ensin (tarvitaan suodattimiin)
        await Promise.all([
          loadSuppliers(),
          loadProductLines()
        ]);
        
        // 2. Lataa asennustavat ja paketit taustalla
        Promise.all([
          loadAllInstallationsOnce(),
          loadAllPackagesOnce()
        ]);
        
        // 3. Lataa tuotteet vasta kun suodattimet on valmiit
        if (!hasSearched) {
          loadProducts();
        }
      } catch (error) {
        console.error('Initialization error:', error);
      }
    };
    
    initializeData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socketClient, connectionStatus.connected]); // Vain kerran kun yhteys on valmis

  // Lataa kaikki asennustavat muistiin kerran
  const loadAllInstallationsOnce = async () => {
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

  // Lataa kaikki paketit muistiin kerran
  const loadAllPackagesOnce = async () => {
    if (!socketClient || allPackagesLoaded) return;
    
    try {
      console.log('📦 Ladataan kaikki paketit muistiin...');
      const response = await socketClient.getAllPackages();
      
      if (response && response.success && Array.isArray(response.data)) {
        setAllPackages(response.data);
        setAllPackagesLoaded(true);
        console.log(`✅ Ladattu ${response.data.length} pakettia muistiin`);
        console.log('📦 Pakettidata:', response.data);
      } else {
        console.log('ℹ️ Pakettien lataus: ei dataa tai epäonnistui:', response);
      }
    } catch (error) {
      console.error('Kaikkien pakettien lataus epäonnistui:', error);
    }
  };

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

  // Lataa kaikki paketit muistiin
  const refreshAllPackages = useCallback(async () => {
    if (!socketClient) return;
    
    try {
      console.log('🔄 Päivitetään kaikki paketit...');
      const response = await socketClient.getAllPackages();
      
      if (response && response.success && Array.isArray(response.data)) {
        setAllPackages(response.data);
        setAllPackagesLoaded(true);
        console.log(`✅ Päivitetty ${response.data.length} pakettia muistiin`);
      }
    } catch (error) {
      console.error('Pakettien päivitys epäonnistui:', error);
    }
  }, [socketClient]);

  // Reagoi suodattimien muutoksiin - käynnistä uusi haku (debounced)
  useEffect(() => {
    // Älä tee hakua heti komponentin mountissa
    if (!socketClient || !connectionStatus.connected) return;
    
    // Debounce: odota 300ms ennen haun käynnistämistä
    const timer = setTimeout(() => {
      if (hasSearched) {
        // Jos on hakutilassa, käynnistä haku uudelleen tallennetulla hakusanalla
        loadProducts(currentSearchQuery);
      } else {
        // Jos on selailutilassa, käynnistä yleishaku
        loadProducts();
      }
    }, 300);
    
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchFilters]); // Vain kun filtterit muuttuvat

  // Sulje dropdownit kun klikataan muualle
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown-filter')) {
        setDropdownOpen({ suppliers: false, productLines: false });
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
  }, [products]);

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
      activeOnly: null,
      hasReferences: null,
      replacementStatus: undefined,
      updatedAfter: undefined,
      hasInstallationMethod: null
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

  const handleCreatePackage = (product: ProductSearchResult) => {
    setPackageModal({
      isOpen: true,
      product
    });
  };

  const handleReplaceProduct = (product: ProductSearchResult) => {
    setReplaceProductModal({
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

  const handlePackageModalClose = () => {
    setPackageModal({
      isOpen: false,
      product: null
    });
  };

  const handleReplaceProductModalClose = () => {
    setReplaceProductModal({
      isOpen: false,
      product: null
    });
  };

  const handlePackageSave = async (packageData: {
    description: string;
    notes?: string;
  }) => {
    try {
      if (!packageModal.product) return;

      console.log('Tallentaa paketti:', {
        product: packageModal.product.product_code,
        ...packageData
      });

      const response = await socketClient?.createPackage({
        package_name: packageData.description,
        description: packageData.notes,
        product_line: packageModal.product.product_line,
        product_code: packageModal.product.product_code
      });

      if (response?.success) {
        console.log('Paketti tallennettu onnistuneesti!');
        // Päivitä paketit jotta uusi paketti näkyy sinisellä
        await refreshAllPackages();
        alert('Paketti luotu onnistuneesti!');
        handlePackageModalClose();
      } else {
        throw new Error(response?.error || 'Tallentaminen epäonnistui');
      }
      
    } catch (error) {
      console.error('Paketin tallennus epäonnistui:', error);
      alert(`Virhe: ${error instanceof Error ? error.message : 'Tuntematon virhe'}`);
    }
  };

  const handleReplaceProductSuccess = async () => {
    // Päivitä tuotelista korvaamisen jälkeen
    if (hasSearched) {
      await loadProducts(currentSearchQuery);
    } else {
      await loadProducts();
    }
    // Päivitä myös asennustavat ja paketit
    await refreshAllInstallations();
    await refreshAllPackages();
  };

  // Tarkistaa onko tuotteella asennustapoja muistista ladatusta datasta
  const productHasInstallations = useCallback((product: ProductSearchResult): boolean => {
    return allInstallations.some(installation => 
      installation.product_line === product.product_line && 
      installation.product_code === product.product_code
    );
  }, [allInstallations]);

  // Tarkistaa onko tuotteesta olemassa paketti muistista ladatusta datasta
  const productHasPackage = useCallback((product: ProductSearchResult): boolean => {
    const hasPackage = allPackages.some(pkg => 
      pkg.package_product_line === product.product_line && 
      pkg.package_number === product.product_code
    );
    
    // Debug-loki
    if (hasPackage) {
      console.log(`📦 Tuotteella ${product.product_line}-${product.product_code} on paketti!`);
    }
    
    return hasPackage;
  }, [allPackages]);

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
    setInstallationModal({
      isOpen: true,
      product: product
    });
    console.log('📱 Modal state:', { installationModal: { isOpen: true, product } });
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

  // Käsittelee sarakkeen klikkauksen järjestämistä varten
  const handleColumnClick = (columnName: string) => {
    if (sortBy === columnName) {
      // Jos sama sarake, vaihda järjestyssuunta
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Jos eri sarake, aseta uusi sarake ja nouseva järjestys
      setSortBy(columnName);
      setSortOrder('asc');
    }
  };

  // POISTETTU: Automaattinen asennustapojen lataus kaikille tuotteille
  // Tämä aiheutti liikaa tietokantayhteyksiä ja kaatoi järjestelmän

  // Tuotteet suoraan backendistä - järjestetään vain frontendissä
  const filteredProducts = useMemo(() => {
    // Järjestä tuotteet (backend hoitaa haun ja suodatuksen)
    return [...products].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'general_name':
          comparison = (a.general_name || '').localeCompare(b.general_name || '');
          break;
        case 'product_code':
          comparison = a.product_code.localeCompare(b.product_code);
          break;
        case 'supplier_name':
          comparison = a.supplier_name.localeCompare(b.supplier_name);
          break;
        case 'manufacturer':
          comparison = (a.manufacturer || '').localeCompare(b.manufacturer || '');
          break;
        default:
          comparison = 0;
      }
      
      // Käännetään järjestys jos laskeva
      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }, [products, sortBy, sortOrder]);

  // Scroll handler hakee lisää tuotteita backendistä
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;
    
    // Kun scrollataan 80% loppuun ja on vielä lisää dataa, haetaan lisää backendistä
    if (scrollPercentage > 0.8 && !isLoadingMore && hasMore && !loading) {
      loadProducts(currentSearchQuery || undefined, true); // append = true
    }
  }, [isLoadingMore, hasMore, loading, loadProducts, currentSearchQuery]);

  // Reset offset kun filtterit tai haku muuttuvat
  useEffect(() => {
    setCurrentOffset(0);
    setHasMore(true);
  }, [searchQuery, searchFilters]);

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
          <div className="search-card-compact">
            <SearchInput
              value={searchQuery}
              onChange={handleSearchQueryChange}
              onSubmit={handleSearchSubmit}
              onClear={clearSearch}
            />
        
            {/* Suodattimet kompaktisti samalla rivillä */}
            <div className="filters-row">
              <div className="filter-compact">
                {loadingSuppliers ? (
                  <span className="loading-text">Ladataan...</span>
                ) : (
                  <div className="dropdown-filter">
                    <button 
                      className="dropdown-toggle-compact"
                      onClick={() => setDropdownOpen(prev => ({ ...prev, suppliers: !prev.suppliers }))}
                      type="button"
                    >
                      {searchFilters.suppliers.length === 0 
                        ? 'Toimittajat' 
                        : `Toimittajat (${searchFilters.suppliers.length})`}
                      <span className="dropdown-arrow">{dropdownOpen.suppliers ? '▲' : '▼'}</span>
                    </button>
                    {dropdownOpen.suppliers && (
                      <div className="dropdown-menu" onClick={(e) => e.stopPropagation()}>
                        {availableSuppliers.map(supplier => (
                          <label key={supplier.supplier_code} className="dropdown-item">
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
                )}
              </div>

              <div className="filter-compact">
                {loadingProductLines ? (
                  <span className="loading-text">Ladataan...</span>
                ) : (
                  <div className="dropdown-filter">
                    <button 
                      className="dropdown-toggle-compact"
                      onClick={() => setDropdownOpen(prev => ({ ...prev, productLines: !prev.productLines }))}
                      type="button"
                    >
                      {searchFilters.productLines.length === 0 
                        ? 'Tuotelinjat' 
                        : `Tuotelinjat (${searchFilters.productLines.length})`}
                      <span className="dropdown-arrow">{dropdownOpen.productLines ? '▲' : '▼'}</span>
                    </button>
                    {dropdownOpen.productLines && (
                      <div className="dropdown-menu" onClick={(e) => e.stopPropagation()}>
                        {availableProductLines.map(productLine => (
                          <label key={productLine} className="dropdown-item">
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
                )}
              </div>

              <div className="filter-compact">
                <select
                  value={searchFilters.hasReferences === null ? 'all' : searchFilters.hasReferences ? 'with' : 'without'}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSearchFilters(prev => ({
                      ...prev,
                      hasReferences: val === 'all' ? null : val === 'with'
                    }));
                  }}
                  className="select-compact"
                  title="Suodata tuotteet riippuvuuksien mukaan"
                >
                  <option value="all">Riippuvuudet</option>
                  <option value="with">Vain riippuvuudet</option>
                  <option value="without">Ei riippuvuuksia</option>
                </select>
              </div>

              <div className="filter-compact">
                <select
                  value={searchFilters.activeOnly === null ? 'all' : searchFilters.activeOnly ? 'active' : 'inactive'}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSearchFilters(prev => ({
                      ...prev,
                      activeOnly: val === 'all' ? null : val === 'active'
                    }));
                  }}
                  className="select-compact"
                  title="Suodata aktiiviset/passiiviset tuotteet"
                >
                  <option value="all">Kaikki tuotteet</option>
                  <option value="active">Vain aktiiviset</option>
                  <option value="inactive">Vain epäaktiiviset</option>
                </select>
              </div>

              <div className="filter-compact">
                <select
                  value={searchFilters.hasInstallationMethod === null ? 'all' : searchFilters.hasInstallationMethod ? 'with' : 'without'}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSearchFilters(prev => ({
                      ...prev,
                      hasInstallationMethod: val === 'all' ? null : val === 'with'
                    }));
                  }}
                  className="select-compact"
                  title="Suodata tuotteet asennustapojen mukaan"
                >
                  <option value="all">Kaikki tuotteet</option>
                  <option value="with">Vain asennustavalla</option>
                  <option value="without">Ilman asennustapaa</option>
                </select>
              </div>

              <div className="filter-compact">
                <select
                  value={searchFilters.replacementStatus || 'all'}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSearchFilters(prev => ({
                      ...prev,
                      replacementStatus: val === 'all' ? undefined : val
                    }));
                  }}
                  className="select-compact"
                  title="Suodata tuotteet korvausstatuksen mukaan"
                >
                  <option value="all">Kaikki</option>
                  <option value="not_replaced">Ei korvatut</option>
                  <option value="replaced">Korvatut</option>
                </select>
              </div>

              <div className="filter-compact">
                <input
                  type="date"
                  value={searchFilters.updatedAfter || ''}
                  onChange={(e) => {
                    setSearchFilters(prev => ({
                      ...prev,
                      updatedAfter: e.target.value || undefined
                    }));
                  }}
                  className="select-compact"
                  title="Näytä tuotteet jotka on muokattu tästä päivästä alkaen"
                  placeholder="Muokattu alkaen..."
                />
              </div>

              <div className="results-count-compact">
                {hasSearched 
                  ? `${totalProducts} hakutulosta`
                  : `${totalProducts} tuotetta`
                }
              </div>
            </div>
          </div>
        </div>

        {/* Järjestämisvalikon siirretty otsikkoriville - klikkaa sarakkeita järjestääksesi */}

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
                <div 
                  className={`header-cell product-number-col sortable ${sortBy === 'product_code' ? 'active' : ''}`}
                  onClick={() => handleColumnClick('product_code')}
                  title={sortBy === 'product_code' 
                    ? `Klikkaa vaihtaaksesi järjestyksen (nyt ${sortOrder === 'asc' ? 'nouseva' : 'laskeva'})`
                    : "Klikkaa järjestääksesi tuotekoodin mukaan"
                  }
                >
                Tuotenumero {sortBy === 'product_code' && (sortOrder === 'asc' ? '↑' : '↓')}
              </div>
              <div 
                className={`header-cell product-name-col sortable ${sortBy === 'general_name' ? 'active' : ''}`}
                onClick={() => handleColumnClick('general_name')}
                title={sortBy === 'general_name' 
                  ? `Klikkaa vaihtaaksesi järjestyksen (nyt ${sortOrder === 'asc' ? 'nouseva' : 'laskeva'})`
                  : "Klikkaa järjestääksesi nimen mukaan"
                }
              >
                Nimi {sortBy === 'general_name' && (sortOrder === 'asc' ? '↑' : '↓')}
              </div>
              <div className="header-cell technical-name-col">Tekninen nimi</div>
              <div 
                className={`header-cell supplier-col sortable ${sortBy === 'supplier_name' ? 'active' : ''}`}
                onClick={() => handleColumnClick('supplier_name')}
                title={sortBy === 'supplier_name' 
                  ? `Klikkaa vaihtaaksesi järjestyksen (nyt ${sortOrder === 'asc' ? 'nouseva' : 'laskeva'})`
                  : "Klikkaa järjestääksesi toimittajan mukaan"
                }
              >
                Toimittaja {sortBy === 'supplier_name' && (sortOrder === 'asc' ? '↑' : '↓')}
              </div>
              <div 
                className={`header-cell manufacturer-col sortable ${sortBy === 'manufacturer' ? 'active' : ''}`}
                onClick={() => handleColumnClick('manufacturer')}
                title={sortBy === 'manufacturer' 
                  ? `Klikkaa vaihtaaksesi järjestyksen (nyt ${sortOrder === 'asc' ? 'nouseva' : 'laskeva'})`
                  : "Klikkaa järjestääksesi valmistajan mukaan"
                }
              >
                Valmistaja {sortBy === 'manufacturer' && (sortOrder === 'asc' ? '↑' : '↓')}
              </div>
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
            {filteredProducts.map((product) => {
              const productKey = `${product.product_line}-${product.product_code}`;
              const isExpanded = expandedRows.has(productKey);
              const installations = installationData[productKey] || [];
              // Käytetään muistista ladattua dataa visuaalisiin indikaattoreihin
              const hasInstallations = productHasInstallations(product);
              const installationCount = getProductInstallationCount(product);
              const hasPackage = productHasPackage(product);
              
              // Debug: Näytetään tila konsolissa
              if (hasInstallations) {
                console.log(`🟢 Tuote ${product.product_line}-${product.product_code} on asennustapoja (${installationCount} kpl) - nuoli pitäisi olla vihreä`);
              }
              if (hasPackage) {
                console.log(`🎨 Tuote ${product.product_line}-${product.product_code} renderöidään sinisellä (has-package: true)`);
              }
              
              return (
                <Fragment key={productKey}>
                  <div 
                    className={`product-row ${hasPackage ? 'has-package' : ''}`}
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
                      {product.replacement_status === 'replaced' && (
                        <span className="status-badge replaced" title={`Korvattu tuotteella: ${product.replaced_by_product_line}-${product.replaced_by_product_code}`}>
                          Korvattu
                        </span>
                      )}
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
              ? `Hakutulokset: ${filteredProducts.length} tuotetta (${totalProducts} yhteensä)`
              : `Näytetään ${filteredProducts.length} tuotetta (${totalProducts} yhteensä)`
            }
            {hasMore && ' - scrollaa nähdäksesi lisää'}
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
          onCreatePackage={handleCreatePackage}
          onReplaceProduct={handleReplaceProduct}
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

      {/* Package Modal */}
      {packageModal.product && (
        <PackageModal
          isOpen={packageModal.isOpen}
          product={packageModal.product}
          onClose={handlePackageModalClose}
          onSave={handlePackageSave}
        />
      )}

      {/* Replace Product Modal */}
      {replaceProductModal.product && (
        <ReplaceProductModal
          isOpen={replaceProductModal.isOpen}
          product={replaceProductModal.product}
          onClose={handleReplaceProductModalClose}
          onSuccess={handleReplaceProductSuccess}
        />
      )}
            
      </div>
    </div>
  );
};