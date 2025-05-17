import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../../styles/quests.css'; // Asegúrate que los estilos para quest-form, etc., estén aquí

const API_QUESTS_URL = import.meta.env.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL}/quests` : 'http://localhost:5000/api/quests';

function QuestForm({ questToEdit, onFormSubmit, onCancel }) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [color, setColor] = useState('#B08D57'); // Default color (accent gold)
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const isEditing = !!questToEdit;

    useEffect(() => {
        if (isEditing) {
            setName(questToEdit.name || '');
            setDescription(questToEdit.description || '');
            setColor(questToEdit.color || '#B08D57');
        } else {
            // Reset para formulario de creación
            setName('');
            setDescription('');
            setColor('#B08D57');
        }
    }, [questToEdit, isEditing]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        if (!name.trim()) {
            setError('Quest name is required.');
            setIsLoading(false);
            return;
        }
        // Validación de color HEX (simple, el backend también valida)
        if (!/^#(?:[0-9a-fA-F]{3}){1,2}$/.test(color)) {
            setError('Invalid color format. Please use HEX (e.g., #RRGGBB or #RGB).');
            setIsLoading(false);
            return;
        }

        const questData = {
            name: name.trim(),
            description: description.trim() || null, // Enviar null si está vacío para que el backend lo maneje
            color: color,
        };

        const token = localStorage.getItem('authToken');
        const config = {
            headers: { 'Authorization': `Bearer ${token}` }
        };

        try {
            if (isEditing) {
                await axios.put(`${API_QUESTS_URL}/${questToEdit.id}`, questData, config);
            } else {
                await axios.post(API_QUESTS_URL, questData, config);
            }
            onFormSubmit(); // Llama a la función para recargar y cerrar el form
        } catch (err) {
            console.error("Failed to save quest:", err);
            setError(err.response?.data?.error || `Failed to ${isEditing ? 'update' : 'create'} quest.`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="quest-form">
            <h3>{isEditing ? 'Edit Quest' : 'Create New Quest'}</h3>
            {error && <p className="error-message">{error}</p>} {/* Reutilizar clase de auth o definir nueva */}
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="quest-name">Quest Name:</label>
                    <input
                        type="text"
                        id="quest-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g., Health & Fitness, Work Projects"
                        required
                        disabled={isLoading || (isEditing && questToEdit.is_default_quest && false)} // Nombre de default quest sí se puede editar
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="quest-description">Description (Optional):</label>
                    <textarea
                        id="quest-description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="A brief description of this Quest"
                        rows="3"
                        disabled={isLoading}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="quest-color">Quest Color:</label>
                    <div className="color-picker-group">
                        <input
                            type="color"
                            id="quest-color"
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            disabled={isLoading}
                        />
                        <span>{color}</span> {/* Muestra el valor HEX actual */}
                    </div>
                </div>
                <div className="form-actions">
                    <button type="button" onClick={onCancel} className="cancel-btn" disabled={isLoading}>
                        Cancel
                    </button>
                    <button type="submit" className="submit-btn" disabled={isLoading}>
                        {isLoading ? (isEditing ? 'Saving...' : 'Creating...') : (isEditing ? 'Save Changes' : 'Create Quest')}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default QuestForm;