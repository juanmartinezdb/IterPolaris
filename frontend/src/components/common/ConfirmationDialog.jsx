import React from 'react';
import '../../styles/dialog.css'; // Crearemos este archivo CSS

function ConfirmationDialog({ message, onConfirm, onCancel, confirmButtonText = "Confirm", cancelButtonText = "Cancel" }) {
    // Prevenir scroll del fondo cuando el modal está abierto
    React.useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

    return (
        <div className="dialog-overlay">
            <div className="dialog-content">
                <p className="dialog-message">{message}</p>
                <div className="dialog-actions">
                    <button onClick={onCancel} className="dialog-button cancel">
                        {cancelButtonText}
                    </button>
                    <button onClick={onConfirm} className="dialog-button confirm">
                        {confirmButtonText}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ConfirmationDialog;