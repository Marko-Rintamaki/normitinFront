import React, { useEffect, useRef } from 'react';
import type { ProductSearchResult } from '../types/api';
import './ProductContextMenu.css';

interface ProductContextMenuProps {
  x: number;
  y: number;
  product: ProductSearchResult;
  onClose: () => void;
  onAddInstallationMethod: (product: ProductSearchResult) => void;
  onCreatePackage: (product: ProductSearchResult) => void;
  onReplaceProduct: (product: ProductSearchResult) => void;
}

export const ProductContextMenu: React.FC<ProductContextMenuProps> = ({
  x,
  y,
  product,
  onClose,
  onAddInstallationMethod,
  onCreatePackage,
  onReplaceProduct
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [onClose]);

  const handleAddInstallation = () => {
    onAddInstallationMethod(product);
    onClose();
  };

  const handleCreatePackage = () => {
    onCreatePackage(product);
    onClose();
  };

  const handleReplaceProduct = () => {
    onReplaceProduct(product);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="product-context-menu"
      style={{ 
        left: x, 
        top: y,
        position: 'fixed',
        zIndex: 1000
      }}
    >
      <div className="context-menu-header">
        <h4>{product.product_code}</h4>
        <p>{product.general_name}</p>
        <p className="supplier">{product.supplier_name}</p>
      </div>
      
      <div className="context-menu-actions">
        <button 
          className="context-menu-item"
          onClick={handleCreatePackage}
        >
          <span className="icon">📦</span>
          Luo paketti
        </button>
        
        <button 
          className="context-menu-item"
          onClick={handleAddInstallation}
        >
          <span className="icon">🔧</span>
          Lisää asennustapa
        </button>
        
        <button 
          className="context-menu-item"
          onClick={handleReplaceProduct}
        >
          <span className="icon">🔄</span>
          Korvaa tuote
        </button>
        
        <button 
          className="context-menu-item"
          onClick={() => {
            // TODO: Näytä olemassa olevat asennustavat
            onClose();
          }}
        >
          <span className="icon">📋</span>
          Näytä asennustavat
        </button>
      </div>
    </div>
  );
};