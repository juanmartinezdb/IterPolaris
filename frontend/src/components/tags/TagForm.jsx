// frontend/src/components/tags/TagForm.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../../styles/tags.css'; // Usaremos los estilos definidos en tags.css

const API_TAGS_URL = import.meta.env.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL}/tags` : 'http://localhost:5000/api/tags';

function TagForm({ tagToEdit, onFormSubmit, onCancel }) {
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const isEditing = !!tagToEdit;

    useEffect(() => {
        if (isEditing) {
            setName(tagToEdit.name || '');
        } else {
            setName('');
        }
    }, [tagToEdit, isEditing]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        if (!name.trim()) {
            setError('Tag name is required.');
            setIsLoading(false);
            return;
        }
        if (name.trim().length > 50) {
            setError('Tag name cannot exceed 50 characters.');
            setIsLoading(false);
            return;
        }

        const tagData = { name: name.trim() };
        const token = localStorage.getItem('authToken');
        const config = {
            headers: { 'Authorization': `Bearer ${token}` }
        };

        try {
            if (isEditing) {
                await axios.put(`${API_TAGS_URL}/${tagToEdit.id}`, tagData, config);
            } else {
                await axios.post(API_TAGS_URL, tagData, config);
            }
            onFormSubmit(); // Llama a la función para recargar y cerrar el form
        } catch (err) {
            console.error("Failed to save tag:", err);
            setError(err.response?.data?.error || `Failed to ${isEditing ? 'update' : 'create'} tag.`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="tag-form">
            <h3>{isEditing ? 'Edit Tag' : 'Create New Tag'}</h3>
            {error && <p className="error-message">{error}</p>} {/* Reutilizar clase de error o una específica */}
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="tag-name">Tag Name:</label>
                    <input
                        type="text"
                        id="tag-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g., Work, Health, Urgent"
                        required
                        disabled={isLoading}
                    />
                </div>
                <div className="form-actions">
                    <button type="button" onClick={onCancel} className="cancel-btn" disabled={isLoading}>
                        Cancel
                    </button>
                    <button type="submit" className="submit-btn" disabled={isLoading}>
                        {isLoading ? (isEditing ? 'Saving...' : 'Creating...') : (isEditing ? 'Save Changes' : 'Create Tag')}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default TagForm;