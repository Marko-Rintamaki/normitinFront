import React, { useState, useEffect } from 'react';
import type { ProductSearchResult } from '../types/api';
import './PackageModal.css';

interface PackageModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: ProductSearchResult | null;
  onSave: (packageData: {
    description: string;
    notes?: string;
  }) => void;
}

export const PackageModal: React.FC<PackageModalProps> = ({
  isOpen,
  onClose,
  product,
  onSave
}) => {
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');

  // Aseta oletusarvot kun modal avautuu
  useEffect(() => {
    if (isOpen && product) {
      setDescription(product.general_name || '');
      setNotes('');
    }
  }, [isOpen, product]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!description.trim()) {
      alert('Kuvaus on pakollinen');
      return;
    }

    onSave({
      description: description.trim(),
      notes: notes.trim() || undefined
    });

    // Reset form
    setDescription('');
    setNotes('');
    onClose();
  };

  const handleClose = () => {
    setDescription('');
    setNotes('');
    onClose();
  };

  if (!isOpen || !product) return null;

  return (
    <div className="package-modal-overlay" onClick={handleClose}>
      <div className="package-modal" onClick={(e) => e.stopPropagation()}>
        <div className="package-modal-header">
          <h3>Luo uusi paketti</h3>
          <button className="close-btn" onClick={handleClose}>×</button>
        </div>

        <div className="package-modal-body">
          <div className="product-info">
            <h4>Päätuote</h4>
            <p><strong>Tuotekoodi:</strong> {product.product_code}</p>
            <p><strong>Nimi:</strong> {product.general_name}</p>
            <p><strong>Toimittaja:</strong> {product.supplier_name}</p>
            <p><strong>Pakettinumero:</strong> {product.product_code} <em>(automaattinen)</em></p>
          </div>

          <form onSubmit={handleSubmit} className="package-form">
            <div className="form-group">
              <label htmlFor="description">
                Kuvaus *
              </label>
              <input
                id="description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Paketin kuvaus"
                className="form-control"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="notes">
                Lisätiedot
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Vapaamuotoisia lisätietoja paketista"
                className="form-control"
                rows={3}
              />
            </div>

            <div className="form-actions">
              <button 
                type="button" 
                onClick={handleClose}
                className="btn btn-secondary"
              >
                Peruuta
              </button>
              <button 
                type="submit"
                className="btn btn-primary"
              >
                Luo paketti
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};