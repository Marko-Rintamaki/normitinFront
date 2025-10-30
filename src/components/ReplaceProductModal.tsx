import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import type { ProductSearchResult } from '../types/api';
import './ReplaceProductModal.css';

interface ReplaceProductModalProps {
  isOpen: boolean;
  product: ProductSearchResult | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const ReplaceProductModal: React.FC<ReplaceProductModalProps> = ({
  isOpen,
  product,
  onClose,
  onSuccess
}) => {
  const { socketClient } = useSocket();
  const [newProductLine, setNewProductLine] = useState('');
  const [newProductCode, setNewProductCode] = useState('');
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Reset modal when it opens/closes
  useEffect(() => {
    if (isOpen) {
      setNewProductLine('');
      setNewProductCode('');
      setSearchResults([]);
      setSearchQuery('');
      setError(null);
    }
  }, [isOpen]);

  // Auto-search with debounce
  useEffect(() => {
    if (!searchQuery.trim() || !isOpen) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await socketClient?.searchProducts(searchQuery.trim(), {
          limit: 20,
          activeOnly: true
        });
        
        if (response?.success && response.data?.products) {
          // Filter out the current product from search results
          const filtered = response.data.products.filter(
            p => !(p.product_line === product?.product_line && p.product_code === product?.product_code)
          );
          setSearchResults(filtered);
        }
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, socketClient, isOpen, product]);

  const handleProductSelect = (selectedProduct: ProductSearchResult) => {
    setNewProductLine(selectedProduct.product_line);
    setNewProductCode(selectedProduct.product_code);
    setSearchResults([]);
    setSearchQuery('');
  };

  const handleReplace = async () => {
    if (!product || !newProductLine || !newProductCode) {
      setError('Valitse korvaava tuote');
      return;
    }

    if (product.product_line === newProductLine && product.product_code === newProductCode) {
      setError('Uusi tuote ei voi olla sama kuin vanha tuote');
      return;
    }

    if (!confirm(
      `Haluatko varmasti korvata tuotteen ${product.product_line}:${product.product_code} tuotteella ${newProductLine}:${newProductCode}?\n\n` +
      `Tämä päivittää kaikki viittaukset vanhasta tuotteesta uuteen tuotteeseen järjestelmässä.`
    )) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await socketClient?.apiRequest('replace_product_smart', {
        old_product_line: product.product_line,
        old_product_code: product.product_code,
        new_product_line: newProductLine,
        new_product_code: newProductCode,
        actor: 'frontend_user'
      }) as { 
        success: boolean; 
        data?: { 
          strategy?: string;
          has_installation_methods?: boolean;
          is_package_main_product?: boolean;
          operations?: {
            copied_installation_methods?: number;
            copied_package_structure?: number;
            replaced_in_package_products?: number;
            replaced_in_package_installation_method_products?: number;
            replaced_in_package_alternative_products?: number;
          }
        }; 
        message?: string 
      };

      if (response?.success) {
        const data = response.data;
        const strategy = data?.strategy || 'unknown';
        const operations = data?.operations;
        
        let message = `Tuote korvattu onnistuneesti!\n\nStrategia: ${strategy === 'preserve_and_copy' ? 'Säilytä ja kopioi' : 'Korvaa paketeissa'}\n\n`;
        
        if (strategy === 'preserve_and_copy') {
          message += `Vanha tuote säilytetty paketeissa.\n`;
          if (operations?.copied_installation_methods) {
            message += `Kopioitu ${operations.copied_installation_methods} asennustapaa\n`;
          }
          if (operations?.copied_package_structure) {
            message += `Kopioitu pakettiraken ne (${operations.copied_package_structure} kohdetta)\n`;
          }
        } else if (strategy === 'replace_in_packages') {
          message += `Tuote korvattu paketeissa:\n`;
          if (operations?.replaced_in_package_products) {
            message += `- Paketit: ${operations.replaced_in_package_products}\n`;
          }
          if (operations?.replaced_in_package_installation_method_products) {
            message += `- Paketin asennustavat: ${operations.replaced_in_package_installation_method_products}\n`;
          }
          if (operations?.replaced_in_package_alternative_products) {
            message += `- Vaihtoehdot: ${operations.replaced_in_package_alternative_products}\n`;
          }
        }
        
        alert(message);
        
        onSuccess();
        onClose();
      } else {
        throw new Error(response?.message || 'Korvaaminen epäonnistui');
      }
    } catch (err) {
      console.error('Replace failed:', err);
      setError(err instanceof Error ? err.message : 'Korvaaminen epäonnistui');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !product) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content replace-product-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🔄 Korvaa tuote</h2>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="current-product-info">
            <h3>Korvattava tuote:</h3>
            <div className="product-details">
              <p><strong>Tuotekoodi:</strong> {product.product_line}:{product.product_code}</p>
              <p><strong>Nimi:</strong> {product.general_name}</p>
              <p><strong>Toimittaja:</strong> {product.supplier_name}</p>
            </div>
          </div>

          <div className="arrow-divider">⬇️</div>

          <div className="new-product-section">
            <h3>Korvaava tuote:</h3>
            
            <div className="search-box">
              <label>Hae tuotetta:</label>
              <input
                type="text"
                placeholder="Hae tuotekoodi tai nimi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
                autoComplete="off"
              />
              
              {searching && <div className="search-spinner">Haetaan...</div>}
              
              {searchResults.length > 0 && (
                <div className="search-results-dropdown">
                  {searchResults.map((result) => (
                    <div
                      key={`${result.product_line}-${result.product_code}`}
                      className="search-result-item"
                      onClick={() => handleProductSelect(result)}
                    >
                      <div className="result-code">{result.product_line}:{result.product_code}</div>
                      <div className="result-name">{result.general_name}</div>
                      <div className="result-supplier">{result.supplier_name}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {newProductCode && (
              <div className="selected-product">
                <p><strong>Valittu tuote:</strong></p>
                <p>{newProductLine}:{newProductCode}</p>
              </div>
            )}
          </div>

          {error && (
            <div className="error-message">
              ⚠️ {error}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button 
            className="btn btn-secondary" 
            onClick={onClose}
            disabled={loading}
          >
            Peruuta
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleReplace}
            disabled={loading || !newProductCode}
          >
            {loading ? 'Korvaaminen käynnissä...' : 'Korvaa tuote'}
          </button>
        </div>
      </div>
    </div>
  );
};
