import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { ProductSearchModal } from '../components/ProductSearchModal';
import { InstallationMethodSelectModal } from '../components/InstallationMethodSelectModal';
import { AddInstallationMethodModal } from '../components/AddInstallationMethodModal';
import './PackagesPage.css';

interface Package {
  package_id?: string;
  package_name: string;
  package_product_line: string;
  package_number: string;
  memo?: string;
  created?: string;
}

interface Product {
  product_line: string;
  product_code: string;
  general_name: string;
  technical_name?: string;
  supplier_name?: string;
  manufacturer?: string;
  active?: boolean;
}

export const PackagesPage = () => {
  const { socketClient, connectionStatus } = useSocket();
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('package_name');
  
  // Valittu paketti ja sen tiedot
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [packageAlternatives, setPackageAlternatives] = useState<unknown[]>([]);
  const [packageProducts, setPackageProducts] = useState<unknown[]>([]);
  const [packageInstallations, setPackageInstallations] = useState<unknown[]>([]);
  const [packageInstallationProducts, setPackageInstallationProducts] = useState<unknown[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [availableInstallationMethods, setAvailableInstallationMethods] = useState<unknown[]>([]);
  
  // Modal-tilat
  const [showAlternativeModal, setShowAlternativeModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showInstallationProductModal, setShowInstallationProductModal] = useState(false);
  const [showInstallationMethodSelectModal, setShowInstallationMethodSelectModal] = useState(false);
  const [showAddInstallationMethodModal, setShowAddInstallationMethodModal] = useState(false);
  const [selectedInstallationMethodId, setSelectedInstallationMethodId] = useState<number | null>(null);

  const loadPackages = useCallback(async () => {
    if (!socketClient || !connectionStatus.connected) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Hae paketit backend:ista
      const response = await socketClient.getAllPackages();
      
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

  // Lataa valitun paketin yksityiskohtaiset tiedot
  const loadPackageDetails = useCallback(async (pkg: Package) => {
    if (!socketClient || !pkg.package_product_line || !pkg.package_number) return;
    
    try {
      setDetailsLoading(true);
      setSelectedPackage(pkg);
      
      // Lataa kaikki paketin tiedot rinnakkain
      const [alternativesRes, productsRes, installationsRes, installationProductsRes] = await Promise.all([
        socketClient.apiRequest('get_package_alternative_products', {
          package_product_line: pkg.package_product_line,
          package_number: pkg.package_number
        }),
        socketClient.apiRequest('get_package_products', {
          package_product_line: pkg.package_product_line,
          package_number: pkg.package_number
        }),
        socketClient.apiRequest('get_package_installation_methods', {
          package_product_line: pkg.package_product_line,
          package_number: pkg.package_number
        }),
        socketClient.apiRequest('get_package_installation_method_products', {
          package_product_line: pkg.package_product_line,
          package_number: pkg.package_number
        })
      ]);
      
      setPackageAlternatives(removeDuplicateProducts((alternativesRes as { data?: unknown[] })?.data || []));
      setPackageProducts(removeDuplicateProducts((productsRes as { data?: unknown[] })?.data || []));
      setPackageInstallations((installationsRes as { data?: unknown[] })?.data || []);
      setPackageInstallationProducts(removeDuplicateProducts((installationProductsRes as { data?: unknown[] })?.data || []));
      
    } catch (error) {
      console.error('Error loading package details:', error);
    } finally {
      setDetailsLoading(false);
    }
  }, [socketClient]);

  // Funktio duplikaattien poistamiseksi product_line+product_code perusteella
  const removeDuplicateProducts = (products: unknown[]) => {
    const productMap = new Map<string, unknown>();
    
    products.forEach((product: unknown) => {
      const prod = product as { product_line?: string; product_code?: string; active?: boolean };
      const key = `${prod.product_line}-${prod.product_code}`;
      
      if (!productMap.has(key)) {
        productMap.set(key, product);
      } else {
        // Jos löytyy jo tuote samalla avaimella, pidä aktiivinen tuote
        const existing = productMap.get(key) as { active?: boolean };
        if (prod.active && !existing.active) {
          productMap.set(key, product);
        }
        // Jos molemmat ovat aktiivisia tai ei-aktiivisia, pidä ensimmäinen
      }
    });
    
    return Array.from(productMap.values());
  };

  // CRUD functions for package components
  const addPackageProduct = () => {
    if (!selectedPackage) return;
    setShowProductModal(true);
  };

    const handleSelectProductForPackage = useCallback(async (product: Product, quantity?: number) => {
    if (!selectedPackage || !socketClient) return;

    if (!quantity || quantity < 1) {
      alert('Virhe: Määrä täytyy olla vähintään 1');
      return;
    }

    try {
      const response = await socketClient.apiRequest('add_product_to_package', {
        package_product_line: selectedPackage.package_product_line,
        package_number: selectedPackage.package_number,
        product_line: product.product_line,
        product_code: product.product_code,
        quantity: quantity
      }) as { success: boolean; error?: string };
      
      if (response.success) {
        loadPackageDetails(selectedPackage);
        setShowProductModal(false);
      } else {
        alert('Virhe tuotteen lisäämisessä: ' + (response.error || 'Tuntematon virhe'));
      }
    } catch (error) {
      console.error('Error adding product to package:', error);
      alert('Virhe tuotteen lisäämisessä');
    }
  }, [selectedPackage, socketClient, loadPackageDetails]);

  const removePackageProduct = async (productLine: string, productCode: string) => {
    if (!selectedPackage || !socketClient) return;
    
    if (!confirm(`Haluatko varmasti poistaa tuotteen ${productLine}-${productCode}?`)) return;
    
    try {
      const response = await socketClient.apiRequest('remove_product_from_package', {
        package_product_line: selectedPackage.package_product_line,
        package_number: selectedPackage.package_number,
        product_line: productLine,
        product_code: productCode
      }) as { success: boolean; message?: string };
      
      if (response.success) {
        await loadPackageDetails(selectedPackage);
      } else {
        alert('Virhe tuotteen poistamisessa: ' + (response.message || 'Tuntematon virhe'));
      }
    } catch (error) {
      console.error('Error removing product from package:', error);
      alert('Virhe tuotteen poistamisessa');
    }
  };

  const updatePackageProductQuantity = async (productLine: string, productCode: string, newQuantity: number) => {
    if (!selectedPackage || !socketClient) return;
    
    if (newQuantity < 1) {
      alert('Määrän täytyy olla vähintään 1');
      return;
    }
    
    try {
      // Käytetään samaa add_product_to_package API:a, joka päivittää määrän ON CONFLICT:ssa
      const response = await socketClient.apiRequest('add_product_to_package', {
        package_product_line: selectedPackage.package_product_line,
        package_number: selectedPackage.package_number,
        product_line: productLine,
        product_code: productCode,
        quantity: newQuantity
      }) as { success: boolean; error?: string };
      
      if (response.success) {
        await loadPackageDetails(selectedPackage);
      } else {
        alert('Virhe määrän päivittämisessä: ' + (response.error || 'Tuntematon virhe'));
      }
    } catch (error) {
      console.error('Error updating product quantity:', error);
      alert('Virhe määrän päivittämisessä');
    }
  };

  const addPackageAlternative = () => {
    if (!selectedPackage) return;
    setShowAlternativeModal(true);
  };

  const handleSelectAlternativeProduct = async (product: { product_line: string; product_code: string }) => {
    if (!selectedPackage || !socketClient) return;
    
    try {
      const response = await socketClient.apiRequest('add_package_alternative_product', {
        package_product_line: selectedPackage.package_product_line,
        package_number: selectedPackage.package_number,
        product_line: product.product_line,
        product_code: product.product_code
      }) as { success: boolean; message?: string };
      
      if (response.success) {
        await loadPackageDetails(selectedPackage);
      } else {
        alert('Virhe vaihtoehtoisen tuotteen lisäämisessä: ' + (response.message || 'Tuntematon virhe'));
      }
    } catch (error) {
      console.error('Error adding alternative product:', error);
      alert('Virhe vaihtoehtoisen tuotteen lisäämisessä');
    }
  };

  const removePackageAlternative = async (productLine: string, productCode: string) => {
    if (!selectedPackage || !socketClient) return;
    
    if (!confirm(`Haluatko varmasti poistaa vaihtoehtoisen tuotteen ${productLine}-${productCode}?`)) return;
    
    try {
      const response = await socketClient.apiRequest('remove_package_alternative_product', {
        package_product_line: selectedPackage.package_product_line,
        package_number: selectedPackage.package_number,
        product_line: productLine,
        product_code: productCode
      }) as { success: boolean; message?: string };
      
      if (response.success) {
        await loadPackageDetails(selectedPackage);
      } else {
        alert('Virhe vaihtoehtoisen tuotteen poistamisessa: ' + (response.message || 'Tuntematon virhe'));
      }
    } catch (error) {
      console.error('Error removing alternative product:', error);
      alert('Virhe vaihtoehtoisen tuotteen poistamisessa');
    }
  };

  const addPackageInstallationMethod = () => {
    if (!selectedPackage) return;
    setShowAddInstallationMethodModal(true);
  };

  const handleAddInstallationMethod = async (methodCode: number, standardHours: number) => {
    if (!selectedPackage || !socketClient) return;
    
    try {
      const response = await socketClient.apiRequest('add_package_installation_method', {
        package_product_line: selectedPackage.package_product_line,
        package_number: selectedPackage.package_number,
        method_code: methodCode,
        standard_hours: standardHours
      }) as { success: boolean; message?: string };
      
      if (response.success) {
        await loadPackageDetails(selectedPackage);
        setShowAddInstallationMethodModal(false);
      } else {
        alert('Virhe asennustavan lisäämisessä: ' + (response.message || 'Tuntematon virhe'));
      }
    } catch (error) {
      console.error('Error adding installation method:', error);
      alert('Virhe asennustavan lisäämisessä');
    }
  };

  const removePackageInstallationMethod = async (methodCode: number) => {
    if (!selectedPackage || !socketClient) return;
    
    if (!confirm(`Haluatko varmasti poistaa asennustavan (koodi: ${methodCode})?`)) return;
    
    try {
      const response = await socketClient.apiRequest('remove_package_installation_method', {
        package_product_line: selectedPackage.package_product_line,
        package_number: selectedPackage.package_number,
        method_code: methodCode
      }) as { success: boolean; message?: string };
      
      if (response.success) {
        await loadPackageDetails(selectedPackage);
      } else {
        alert('Virhe asennustavan poistamisessa: ' + (response.message || 'Tuntematon virhe'));
      }
    } catch (error) {
      console.error('Error removing installation method:', error);
      alert('Virhe asennustavan poistamisessa');
    }
  };

  const updatePackageInstallationMethod = async (methodCode: number, standardHours: number) => {
    if (!selectedPackage || !socketClient) return;
    
    try {
      const response = await socketClient.apiRequest('update_package_installation_method', {
        package_product_line: selectedPackage.package_product_line,
        package_number: selectedPackage.package_number,
        method_code: methodCode,
        standard_hours: standardHours
      }) as { success: boolean; message?: string };
      
      if (response.success) {
        await loadPackageDetails(selectedPackage);
      } else {
        alert('Virhe asennustavan päivittämisessä: ' + (response.message || 'Tuntematon virhe'));
      }
    } catch (error) {
      console.error('Error updating installation method:', error);
      alert('Virhe asennustavan päivittämisessä');
    }
  };

  const addInstallationMethodProduct = () => {
    if (!selectedPackage) return;
    
    // Tarkista että paketilla on asennustapoja
    if (packageInstallations.length === 0) {
      alert('Lisää ensin asennustapa pakettiin');
      return;
    }
    
    // Avaa asennustavan valintamodaali
    setShowInstallationMethodSelectModal(true);
  };

  const removeInstallationMethodProduct = async (methodName: string, productLine: string, productCode: string) => {
    if (!selectedPackage || !socketClient) return;
    
    if (!confirm(`Haluatko varmasti poistaa tuotteen ${productLine}-${productCode} asennustavasta ${methodName}?`)) return;
    
    try {
      const response = await socketClient.apiRequest('remove_package_installation_method_product', {
        package_product_line: selectedPackage.package_product_line,
        package_number: selectedPackage.package_number,
        method_name: methodName,
        product_line: productLine,
        product_code: productCode
      }) as { success: boolean; message?: string };
      
      if (response.success) {
        await loadPackageDetails(selectedPackage);
      } else {
        alert('Virhe asennustavan tuotteen poistamisessa: ' + (response.message || 'Tuntematon virhe'));
      }
    } catch (error) {
      console.error('Error removing installation method product:', error);
      alert('Virhe asennustavan tuotteen poistamisessa');
    }
  };

  useEffect(() => {
    if (!socketClient || !connectionStatus.connected) return;
    
    // Load packages
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await socketClient.getAllPackages();
        
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
    };
    
    // Load available installation methods
    const loadMethods = async () => {
      try {
        console.log('🔍 Loading package installation methods catalog...');
        const response = await socketClient.apiRequest('get_all_package_installation_method_definitions', {}) as { success: boolean; data?: unknown[] };
        
        console.log('📦 Installation methods response:', response);
        
        if (response.success && response.data) {
          console.log('✅ Loaded methods:', response.data.length, 'methods');
          setAvailableInstallationMethods(response.data);
        } else {
          console.warn('⚠️ No methods data in response');
        }
      } catch (error) {
        console.error('❌ Error loading installation methods:', error);
      }
    };
    
    loadData();
    loadMethods();
  }, [socketClient, connectionStatus.connected]);

  const getFilteredPackages = () => {
    let filtered = [...packages];

    // Suodata hakusanan perusteella
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(pkg => 
        pkg.package_name.toLowerCase().includes(query) ||
        (pkg.package_id && pkg.package_id.toLowerCase().includes(query)) ||
        (pkg.memo && pkg.memo.toLowerCase().includes(query)) ||
        pkg.package_product_line.toLowerCase().includes(query) ||
        pkg.package_number.toLowerCase().includes(query)
      );
    }

    // Järjestä paketit
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'package_name':
          return a.package_name.localeCompare(b.package_name);
        case 'package_id':
          return (a.package_id || '').localeCompare(b.package_id || '');
        case 'package_number':
          return a.package_number.localeCompare(b.package_number);
        case 'package_product_line':
          return a.package_product_line.localeCompare(b.package_product_line);
        case 'created':
          if (!a.created || !b.created) return 0;
          return new Date(b.created).getTime() - new Date(a.created).getTime();
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

      <div className="packages-layout">
        {/* Vasen puoli: Pakettien haku ja listaus */}
        <div className="packages-left-panel">
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
                <option value="package_number">Pakettinumero</option>
                <option value="package_product_line">Tuotelinja</option>
                <option value="created">Luontiaika</option>
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

          {/* Pakettien lista */}
          <div className="packages-list">
            {loading && packages.length === 0 ? (
              <div className="loading-spinner">
                <div className="spinner"></div>
                <p>Ladataan paketteja...</p>
              </div>
            ) : filteredPackages.length === 0 ? (
              <div className="empty-state">
                <h3>Ei paketteja</h3>
                <p>
                  {searchQuery 
                    ? `Hakusanalla "${searchQuery}" ei löytynyt paketteja.`
                    : 'Paketteja ei löytynyt.'
                  }
                </p>
              </div>
            ) : (
              <div className="packages-table-container">
                {/* Kiinteät otsikot */}
                <div className="table-header">
                  <div className="header-row">
                    <div className="header-cell package-number-col sortable" onClick={() => setSortBy('package_number')}>
                      Pakettinumero {sortBy === 'package_number' && '↑'}
                    </div>
                    <div className="header-cell package-name-col sortable" onClick={() => setSortBy('package_name')}>
                      Nimi {sortBy === 'package_name' && '↑'}
                    </div>
                  </div>
                </div>
                
                {/* Scrollattava sisältöalue */}
                <div className="table-body">
                  {filteredPackages.map((pkg) => (
                    <div 
                      key={pkg.package_id || pkg.package_number} 
                      className={`package-row ${selectedPackage?.package_number === pkg.package_number ? 'selected' : ''}`}
                      onClick={() => loadPackageDetails(pkg)}
                    >
                      <div className="package-cell package-number-col">
                        <div className="package-number-content">
                          <span className="package-line">{pkg.package_product_line}</span>
                          <span className="package-separator">-</span>
                          <span className="package-code">{pkg.package_number}</span>
                        </div>
                      </div>
                      <div className="package-cell package-name-col">
                        {pkg.package_name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="packages-summary">
              <p>Näytetään {filteredPackages.length} pakettia {packages.length} paketista</p>
            </div>
          </div>
        </div>

        {/* Oikea puoli: Valitun paketin tiedot */}
        <div className="packages-right-panel">
          {selectedPackage ? (
            <div className="package-details-panel">
              <div className="panel-header">
                <h2>Paketti: {selectedPackage.package_name}</h2>
                <span className="package-number">{selectedPackage.package_number}</span>
              </div>

              {detailsLoading ? (
                <div className="loading-spinner">
                  <div className="spinner"></div>
                  <p>Ladataan paketin tietoja...</p>
                </div>
              ) : (
                <div className="details-vertical">
                  {/* Paketin vaihtoehtoiset päätuotteet */}
                  <div className="detail-section">
                    <div className="detail-section-header">
                      <h3>Vaihtoehtoiset päätuotteet</h3>
                      <button className="btn btn-primary btn-sm" onClick={addPackageAlternative} title="Lisää vaihtoehtoinen päätuote">
                        + Lisää
                      </button>
                    </div>
                    <div className="detail-content">
                      {packageAlternatives.length === 0 ? (
                        <p className="empty-message">Ei vaihtoehtoisia päätuotteita</p>
                      ) : (
                        <table className="detail-table">
                          <thead>
                            <tr>
                              <th>Tuotenumero</th>
                              <th>Nimi</th>
                              <th style={{ width: '60px', textAlign: 'center' }}>Poista</th>
                            </tr>
                          </thead>
                          <tbody>
                            {packageAlternatives.map((alt: unknown, index: number) => {
                              const alternative = alt as { product_line?: string; product_code?: string; general_name?: string };
                              return (
                                <tr key={index}>
                                  <td className="product-number-cell">
                                    {alternative.product_line}-{alternative.product_code}
                                  </td>
                                  <td>{alternative.general_name || 'Ei nimeä'}</td>
                                  <td style={{ textAlign: 'center' }}>
                                    <button 
                                      className="btn btn-danger btn-sm" 
                                      onClick={() => removePackageAlternative(alternative.product_line || '', alternative.product_code || '')}
                                      title="Poista"
                                    >
                                      ✕
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  {/* Paketin tuotteet */}
                  <div className="detail-section">
                    <div className="detail-section-header">
                      <h3>Paketin tuotteet</h3>
                      <button className="btn btn-primary btn-sm" onClick={addPackageProduct} title="Lisää tuote">
                        + Lisää
                      </button>
                    </div>
                    <div className="detail-content">
                      {packageProducts.length === 0 ? (
                        <p className="empty-message">Ei tuotteita paketissa</p>
                      ) : (
                        <table className="detail-table">
                          <thead>
                            <tr>
                              <th>Tuotenumero</th>
                              <th>Nimi</th>
                              <th style={{ width: '80px' }}>Määrä</th>
                              <th style={{ width: '60px', textAlign: 'center' }}>Poista</th>
                            </tr>
                          </thead>
                          <tbody>
                            {packageProducts.map((product: unknown, index: number) => {
                              const prod = product as { product_line?: string; product_code?: string; general_name?: string; quantity?: number };
                              return (
                                <tr key={index}>
                                  <td className="product-number-cell">
                                    {prod.product_line}-{prod.product_code}
                                  </td>
                                  <td>{prod.general_name || 'Ei nimeä'}</td>
                                  <td>
                                    <input 
                                      type="number" 
                                      className="editable-input"
                                      defaultValue={prod.quantity || 1}
                                      min="1"
                                      title="Muokkaa määrää"
                                      onBlur={(e) => {
                                        const newQuantity = parseFloat(e.target.value);
                                        if (!isNaN(newQuantity) && newQuantity !== prod.quantity) {
                                          updatePackageProductQuantity(prod.product_line || '', prod.product_code || '', newQuantity);
                                        }
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.currentTarget.blur();
                                        }
                                      }}
                                    />
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    <button 
                                      className="btn btn-danger btn-sm" 
                                      onClick={() => removePackageProduct(prod.product_line || '', prod.product_code || '')}
                                      title="Poista"
                                    >
                                      ✕
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  {/* Paketin asennustavat */}
                  <div className="detail-section">
                    <div className="detail-section-header">
                      <h3>Paketin asennustavat</h3>
                      <button className="btn btn-primary btn-sm" onClick={addPackageInstallationMethod} title="Lisää asennustapa">
                        + Lisää
                      </button>
                    </div>
                    <div className="detail-content">
                      {packageInstallations.length === 0 ? (
                        <p className="empty-message">Ei asennustapoja</p>
                      ) : (
                        <table className="detail-table">
                          <thead>
                            <tr>
                              <th>Asennustavan ID</th>
                              <th>Nimi</th>
                              <th style={{ width: '100px' }}>Normitunti</th>
                              <th style={{ width: '60px', textAlign: 'center' }}>Poista</th>
                            </tr>
                          </thead>
                          <tbody>
                            {packageInstallations.map((installation: unknown, index: number) => {
                              const inst = installation as { method_id?: number; method_code?: number; method_name?: string; standard_hours?: number; is_default?: boolean };
                              const methodCode = inst.method_code || inst.method_id || 0;
                              return (
                                <tr key={index} style={inst.is_default ? { backgroundColor: '#e8f5e9' } : {}}>
                                  <td className="product-number-cell">
                                    {methodCode}
                                  </td>
                                  <td>
                                    {inst.method_name}
                                    {inst.is_default && ' (oletus)'}
                                  </td>
                                  <td>
                                    <input 
                                      type="number" 
                                      className="editable-input"
                                      defaultValue={inst.standard_hours || 1}
                                      min="0"
                                      step="0.5"
                                      title="Muokkaa normitunteja"
                                      onBlur={(e) => {
                                        const newHours = parseFloat(e.target.value);
                                        if (!isNaN(newHours) && newHours >= 0 && newHours !== inst.standard_hours) {
                                          updatePackageInstallationMethod(methodCode, newHours);
                                        }
                                      }}
                                    />
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    <button 
                                      className="btn btn-danger btn-sm" 
                                      onClick={() => removePackageInstallationMethod(methodCode)}
                                      title="Poista"
                                    >
                                      ✕
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  {/* Paketin asennustapojen tuotteet */}
                  <div className="detail-section">
                    <div className="detail-section-header">
                      <h3>Asennustapojen tuotteet</h3>
                      <button className="btn btn-primary btn-sm" onClick={addInstallationMethodProduct} title="Lisää asennustavan tuote">
                        + Lisää
                      </button>
                    </div>
                    <div className="detail-content">
                      {packageInstallationProducts.length === 0 ? (
                        <p className="empty-message">Ei asennustapojen tuotteita</p>
                      ) : (
                        <table className="detail-table">
                          <thead>
                            <tr>
                              <th>Asennustavan ID</th>
                              <th>Asennustavan nimi</th>
                              <th>Tuotenumero</th>
                              <th>Tuotenimi</th>
                              <th style={{ width: '80px' }}>Määrä</th>
                              <th style={{ width: '60px', textAlign: 'center' }}>Poista</th>
                            </tr>
                          </thead>
                          <tbody>
                            {packageInstallationProducts.map((instProduct: unknown, index: number) => {
                              const instProd = instProduct as { 
                                method_id?: string; 
                                method_name?: string; 
                                product_line?: string; 
                                product_code?: string; 
                                general_name?: string;
                                quantity?: number 
                              };
                              return (
                                <tr key={index}>
                                  <td className="product-number-cell">
                                    {instProd.method_id || instProd.method_name}
                                  </td>
                                  <td>{instProd.method_name}</td>
                                  <td className="product-number-cell">
                                    {instProd.product_line}-{instProd.product_code}
                                  </td>
                                  <td>{instProd.general_name || 'Ei nimeä'}</td>
                                  <td>
                                    <input 
                                      type="number" 
                                      className="editable-input"
                                      defaultValue={instProd.quantity || 1}
                                      min="1"
                                      title="Muokkaa määrää"
                                    />
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    <button 
                                      className="btn btn-danger btn-sm" 
                                      onClick={() => removeInstallationMethodProduct(instProd.method_name || '', instProd.product_line || '', instProd.product_code || '')}
                                      title="Poista"
                                    >
                                      ✕
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                </div>
              )}
            </div>
          ) : (
            <div className="no-selection">
              <h3>Valitse paketti</h3>
              <p>Klikkaa pakettia vasemmalta nähdäksesi sen yksityiskohdat</p>
            </div>
          )}
        </div>
      </div>

      {/* Modalit tuotevalintaan */}
      <ProductSearchModal
        isOpen={showAlternativeModal}
        onClose={() => setShowAlternativeModal(false)}
        onSelectProduct={handleSelectAlternativeProduct}
        title="Valitse vaihtoehtoinen päätuote"
      />
      
      <ProductSearchModal
        isOpen={showProductModal}
        onClose={() => setShowProductModal(false)}
        onSelectProduct={handleSelectProductForPackage}
        title="Valitse pakettiin lisättävä tuote"
        showQuantityInput={true}
      />
      
      <ProductSearchModal
        isOpen={showInstallationProductModal}
        onClose={() => {
          setShowInstallationProductModal(false);
          setSelectedInstallationMethodId(null);
        }}
        onSelectProduct={(product, quantity) => {
          if (!selectedPackage || !socketClient) return;
          
          if (!selectedInstallationMethodId) {
            alert('Virhe: Asennustavan ID puuttuu');
            return;
          }
          
          if (!quantity || quantity < 1) {
            alert('Virhe: Määrä täytyy olla vähintään 1');
            return;
          }
          
          socketClient.apiRequest('add_package_installation_method_product', {
            package_product_line: selectedPackage.package_product_line,
            package_number: selectedPackage.package_number,
            method_id: selectedInstallationMethodId,
            product_line: product.product_line,
            product_code: product.product_code,
            quantity: quantity
          }).then((response) => {
            const resp = response as { success: boolean; message?: string };
            if (resp.success && selectedPackage) {
              loadPackageDetails(selectedPackage);
              setShowInstallationProductModal(false);
              setSelectedInstallationMethodId(null);
            } else {
              alert('Virhe: ' + (resp.message || 'Tuntematon virhe'));
            }
          });
        }}
        title="Valitse asennustavan tuote"
        showQuantityInput={true}
      />
      
      {/* Asennustavan valintamodaali */}
      <InstallationMethodSelectModal
        isOpen={showInstallationMethodSelectModal}
        onClose={() => setShowInstallationMethodSelectModal(false)}
        onSelect={(methodId) => {
          setSelectedInstallationMethodId(methodId);
          setShowInstallationMethodSelectModal(false);
          setShowInstallationProductModal(true);
        }}
        methods={packageInstallations.map((inst: unknown) => {
          const i = inst as { method_id?: number; method_name?: string; standard_hours?: number };
          return {
            method_id: i.method_id || 0,
            method_name: i.method_name || '',
            standard_hours: i.standard_hours
          };
        })}
      />
      
      {/* Asennustavan lisäysmodaali */}
      <AddInstallationMethodModal
        isOpen={showAddInstallationMethodModal}
        onClose={() => setShowAddInstallationMethodModal(false)}
        onAdd={handleAddInstallationMethod}
        availableMethods={availableInstallationMethods.map((method: unknown) => {
          const m = method as { method_code?: number; method_name?: string };
          return {
            method_code: m.method_code || 0,
            method_name: m.method_name || ''
          };
        })}
      />
    </div>
  );
};