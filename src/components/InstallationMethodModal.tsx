import React, { useState, useEffect, useCallback } from 'react';
import type { ProductSearchResult } from '../types/api';
import type { SocketClient } from '../services/socket';
import './InstallationMethodModal.css';

interface InstallationMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: ProductSearchResult | null;
  socketClient: SocketClient;
  onSave: (installationData: {
    methodCode: number;
    standardHours: number;
    notes?: string;
  }) => void;
}

interface InstallationMethod {
  id: number;
  method_name: string;
  method_code: number;
  description?: string;
}

export const InstallationMethodModal: React.FC<InstallationMethodModalProps> = ({
  isOpen,
  onClose,
  product,
  socketClient,
  onSave
}) => {
  const [installationMethods, setInstallationMethods] = useState<InstallationMethod[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState<number | null>(null);
  const [normiTime, setNormiTime] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInstallationMethods = useCallback(async () => {
    try {
      setLoading(true);
      const response = await socketClient.getInstallationMethods();
      
      if (response.success && response.data) {
        setInstallationMethods(response.data);
      } else {
        throw new Error(response.error || 'Failed to load installation methods');
      }
    } catch (err) {
      setError('Asennustapojen lataaminen epäonnistui');
      console.error('Error loading installation methods:', err);
    } finally {
      setLoading(false);
    }
  }, [socketClient]);

  useEffect(() => {
    if (isOpen) {
      loadInstallationMethods();
      // Reset form
      setSelectedMethodId(null);
      setNormiTime(0);
      setNotes('');
      setError(null);
    }
  }, [isOpen, socketClient, loadInstallationMethods]);

  const handleSave = () => {
    if (!selectedMethodId || normiTime <= 0) {
      setError('Valitse asennustapa ja syötä normiaika');
      return;
    }

    onSave({
      methodCode: selectedMethodId,
      standardHours: normiTime,
      notes: notes.trim() || undefined
    });

    onClose();
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  if (!isOpen || !product) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content installation-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Lisää asennustapa</h2>
          <button className="modal-close" onClick={handleClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="product-info">
            <h3>{product.product_code}</h3>
            <p>{product.general_name}</p>
            <p className="supplier">{product.supplier_name}</p>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="installationMethod">Asennustapa *</label>
                        <select
              className="form-control"
              value={selectedMethodId || ''}
              onChange={(e) => setSelectedMethodId(e.target.value ? parseInt(e.target.value, 10) : null)}
              disabled={loading}
            >
              <option value="">Valitse asennustapa...</option>
              {installationMethods.map(method => (
                <option key={method.id} value={method.method_code}>
                  {method.method_name}
                  {method.description && ` - ${method.description}`}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="normiTime">Normiaika (tuntia) *</label>
            <input
              type="number"
              id="normiTime"
              value={normiTime || ''}
              onChange={(e) => setNormiTime(Number(e.target.value))}
              min="0"
              step="0.1"
              placeholder="Esim. 0.5 (= 30 min)"
            />
            <small className="help-text">
              Syötä aika tunteina. Esim: 0,5 = 30 minuuttia, 1,25 = 1 tunti 15 minuuttia
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="notes">Huomiot</label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Lisätiedot asennuksesta..."
            />
          </div>
        </div>

        <div className="modal-footer">
          <button 
            className="btn btn-secondary"
            onClick={handleClose}
          >
            Peruuta
          </button>
          <button 
            className="btn btn-primary"
            onClick={handleSave}
            disabled={loading || !selectedMethodId || normiTime <= 0}
          >
            {loading ? 'Tallentaa...' : 'Tallenna'}
          </button>
        </div>
      </div>
    </div>
  );
};