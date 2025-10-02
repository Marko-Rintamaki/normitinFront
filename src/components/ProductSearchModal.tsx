import { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import './ProductSearchModal.css';

interface Product {
  product_line: string;
  product_code: string;
  general_name: string;
  technical_name?: string;
  supplier_name?: string;
  manufacturer?: string;
  active?: boolean;
}

interface ProductSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct: (product: Product, quantity?: number) => void;
  title?: string;
  showQuantityInput?: boolean;
}

export const ProductSearchModal = ({ isOpen, onClose, onSelectProduct, title = "Valitse tuote", showQuantityInput = false }: ProductSearchModalProps) => {
  const { socketClient, connectionStatus } = useSocket();
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [quantity, setQuantity] = useState('1');

  console.log('ProductSearchModal - socketClient:', !!socketClient, 'connected:', connectionStatus.connected);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setProducts([]);
    }
  }, [isOpen]);

  const searchProducts = async (query: string) => {
    if (!socketClient || !query.trim()) {
      setProducts([]);
      return;
    }

    setLoading(true);
    try {
      console.log('Searching products with query:', query);
      const response = await socketClient.searchProducts(query.trim());
      console.log('Search response:', response);
      console.log('Response.data type:', typeof response.data);
      console.log('Response.data:', response.data);
      
      if (response.success && response.data) {
        // Data voi olla objekti jossa on products-kenttä
        let results: Product[] = [];
        if (Array.isArray(response.data)) {
          results = response.data;
        } else if (response.data && typeof response.data === 'object' && 'products' in response.data) {
          results = (response.data as { products: Product[] }).products || [];
        } else if (response.data && typeof response.data === 'object' && 'results' in response.data) {
          results = (response.data as { results: Product[] }).results || [];
        }
        
        console.log('Processed results:', results.length);
        setProducts(results.slice(0, 50)); // Rajoita 50 tulokseen
      } else {
        console.log('No data in response or not successful');
        setProducts([]);
      }
    } catch (error) {
      console.error('Error searching products:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        searchProducts(searchQuery);
      } else {
        setProducts([]);
      }
    }, 300);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const handleSelectProduct = (product: Product) => {
    const qty = parseInt(quantity, 10);
    if (showQuantityInput && (!qty || qty < 1)) {
      alert('Syötä kelvollinen määrä (vähintään 1)');
      return;
    }
    onSelectProduct(product, showQuantityInput ? qty : undefined);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>
        
        <div className="modal-body">
          {!connectionStatus.connected && (
            <div className="modal-empty" style={{ color: '#dc3545', fontWeight: 'bold' }}>
              <p>⚠️ Ei yhteyttä palvelimeen. Tuotehaku ei toimi.</p>
            </div>
          )}
          
          <div className="search-input-container">
            <input
              type="text"
              placeholder="🔍 Hae tuotteita nimellä tai tuotenumerolla..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="modal-search-input"
              autoFocus
              disabled={!connectionStatus.connected}
            />
          </div>

          {showQuantityInput && (
            <div className="search-input-container" style={{ marginTop: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Määrä:
              </label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="modal-search-input"
                style={{ width: '150px' }}
                disabled={!connectionStatus.connected}
              />
            </div>
          )}

          {loading && (
            <div className="modal-loading">
              <div className="spinner"></div>
              <p>Haetaan tuotteita...</p>
            </div>
          )}

          {!loading && products.length === 0 && searchQuery.trim() && (
            <div className="modal-empty">
              <p>Ei tuloksia haulla "{searchQuery}"</p>
            </div>
          )}

          {!loading && products.length === 0 && !searchQuery.trim() && (
            <div className="modal-empty">
              <p>Aloita kirjoittamalla tuotteen nimi tai numero...</p>
            </div>
          )}

          {!loading && products.length > 0 && (
            <div className="modal-results">
              <table className="modal-results-table">
                <thead>
                  <tr>
                    <th>Tuotenumero</th>
                    <th>Nimi</th>
                    <th>Toimittaja</th>
                    <th>Aktiivinen</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product, index) => (
                    <tr 
                      key={`${product.product_line}-${product.product_code}-${index}`}
                      onClick={() => handleSelectProduct(product)}
                      className="modal-result-row"
                    >
                      <td className="product-number-cell">
                        {product.product_line}-{product.product_code}
                      </td>
                      <td>{product.general_name}</td>
                      <td>{product.supplier_name || '-'}</td>
                      <td>
                        <span className={`status-badge ${product.active ? 'active' : 'inactive'}`}>
                          {product.active ? '✓' : '✗'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
