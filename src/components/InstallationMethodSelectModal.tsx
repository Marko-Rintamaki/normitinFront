import { useState } from 'react';
import './InstallationMethodSelectModal.css';

interface InstallationMethod {
  method_id: number;
  method_name: string;
  standard_hours?: number;
}

interface InstallationMethodSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (methodId: number) => void;
  methods: InstallationMethod[];
}

export const InstallationMethodSelectModal = ({ 
  isOpen, 
  onClose, 
  onSelect, 
  methods 
}: InstallationMethodSelectModalProps) => {
  const [selectedMethodId, setSelectedMethodId] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleSelect = () => {
    if (selectedMethodId !== null) {
      onSelect(selectedMethodId);
      setSelectedMethodId(null);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content installation-method-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Valitse asennustapa</h2>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>
        
        <div className="modal-body">
          {methods.length === 0 ? (
            <div className="modal-empty">
              <p>Ei asennustapoja. Lisää ensin asennustapa pakettiin.</p>
            </div>
          ) : (
            <>
              <div className="method-selection-list">
                {methods.map((method) => (
                  <div 
                    key={method.method_id}
                    className={`method-selection-item ${selectedMethodId === method.method_id ? 'selected' : ''}`}
                    onClick={() => setSelectedMethodId(method.method_id)}
                  >
                    <div className="method-info">
                      <strong>{method.method_name}</strong>
                      <span className="method-details">
                        ID: {method.method_id}
                        {method.standard_hours !== undefined && ` • ${method.standard_hours}h`}
                      </span>
                    </div>
                    <div className="method-radio">
                      <input 
                        type="radio" 
                        checked={selectedMethodId === method.method_id}
                        onChange={() => setSelectedMethodId(method.method_id)}
                      />
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="modal-actions">
                <button 
                  className="btn btn-secondary" 
                  onClick={onClose}
                >
                  Peruuta
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={handleSelect}
                  disabled={selectedMethodId === null}
                >
                  Jatka tuotevalintaan →
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
