import { useState } from 'react';
import './AddInstallationMethodModal.css';

interface InstallationMethod {
  method_code: number;
  method_name: string;
  product_line?: string;
  description?: string;
}

interface AddInstallationMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (methodCode: number, standardHours: number) => void;
  availableMethods: InstallationMethod[];
}

export const AddInstallationMethodModal = ({ isOpen, onClose, onAdd, availableMethods }: AddInstallationMethodModalProps) => {
  const [methodCode, setMethodCode] = useState<number | null>(null);
  const [standardHours, setStandardHours] = useState('1');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!methodCode || methodCode === 0) {
      alert('Asennustapa on pakollinen');
      return;
    }

    const hours = parseFloat(standardHours);
    if (isNaN(hours) || hours < 0) {
      alert('Vakiotuntien täytyy olla numero (vähintään 0)');
      return;
    }

    onAdd(methodCode, hours);
    
    // Nollaa kentät
    setMethodCode(null);
    setStandardHours('1');
  };

  const handleClose = () => {
    setMethodCode(null);
    setStandardHours('1');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content add-installation-method-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Lisää asennustapa</h2>
          <button className="modal-close-btn" onClick={handleClose}>✕</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label htmlFor="methodName">
                Asennustapa <span className="required">*</span>
              </label>
              <select
                id="methodName"
                className="form-control"
                value={methodCode ?? ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setMethodCode(value === '' ? null : Number(value));
                }}
                autoFocus
              >
                <option value="">-- Valitse asennustapa --</option>
                {availableMethods.map((method) => (
                  <option key={method.method_code} value={method.method_code}>
                    {method.method_name}
                  </option>
                ))}
              </select>
              <small className="form-text">Valitse tuotteelle määritelty asennustapa</small>
            </div>

            <div className="form-group">
              <label htmlFor="standardHours">Vakiotunnit</label>
              <input
                id="standardHours"
                type="number"
                className="form-control"
                value={standardHours}
                onChange={(e) => setStandardHours(e.target.value)}
                min="0"
                step="any"
              />
              <small className="form-text">Arvioitu asennusaika tunneissa (voit käyttää desimaaleja, esim. 1.333)</small>
            </div>
          </div>

          <div className="modal-actions">
            <button 
              type="button"
              className="btn btn-secondary" 
              onClick={handleClose}
            >
              Peruuta
            </button>
            <button 
              type="submit"
              className="btn btn-primary"
            >
              Lisää asennustapa
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
