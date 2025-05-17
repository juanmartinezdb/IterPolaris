// frontend/src/components/tags/TagFilter.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../../styles/tags.css'; // Para .tag-filter-sidebar, etc.

const API_TAGS_URL = import.meta.env.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL}/tags` : 'http://localhost:5000/api/tags';

// Este estado de los tags seleccionados debería vivir más arriba (Context o en el componente Layout principal)
// y pasarse como props, o usar un gestor de estado global.
// Por ahora, para demostración, lo manejaremos localmente si no hay un prop onFilterChange.
function TagFilter({ availableTags, selectedTags, onFilterChange, onConfigOpen }) {
    const [userTags, setUserTags] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    // selectedTags y onFilterChange vendrán de un estado global/contexto en la Tarea 9

    useEffect(() => {
        // Si no se pasan availableTags, se cargan aquí.
        // En la Tarea 9, el Layout principal podría cargar esto y pasarlo.
        if (!availableTags) {
            const fetchUserTags = async () => {
                setIsLoading(true);
                const token = localStorage.getItem('authToken');
                try {
                    const response = await axios.get(API_TAGS_URL, {
                        headers: { 'Authorization': `Bearer ${token}` },
                    });
                    setUserTags(response.data || []);
                } catch (error) {
                    console.error('Failed to fetch tags for filter:', error);
                    setUserTags([]); // Evitar error si falla la carga
                } finally {
                    setIsLoading(false);
                }
            };
            fetchUserTags();
        } else {
            setUserTags(availableTags);
        }
    }, [availableTags]);
    
    const handleCheckboxChange = (tagId) => {
        if (onFilterChange) {
            onFilterChange(tagId); // La lógica de añadir/quitar estará en el gestor de estado global
        }
    };

    // PRD: "A configuration setting...will allow users to select which of their Tags appear in this quick filter list"
    // Para MVP, mostraremos todos los tags del usuario. La configuración vendrá en Tarea 9.

    if (isLoading) {
        return <div className="tag-filter-sidebar"><p>Loading tags...</p></div>;
    }
    
    if (userTags.length === 0) {
        return (
            <div className="tag-filter-sidebar">
                <h4>Filter by Tag</h4>
                <p style={{fontSize: '0.85em', color: 'var(--color-text-on-dark-muted)'}}>No tags created yet.</p>
                 {/* Enlace a la página de Tags si onConfigOpen no está definido para el MVP */}
                {!onConfigOpen && <a href="/tags" style={{fontSize: '0.85em', color: 'var(--color-accent-gold)'}}>Manage Tags</a>}
                {onConfigOpen && (
                    <button onClick={onConfigOpen} style={{fontSize: '0.8em', /* ... otros estilos */}}>
                        Configure Tags
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="tag-filter-sidebar">
            <h4>Filter by Tag</h4>
            {/* TODO Tarea 9: Añadir botón "Configure" que lleve a la página de settings para seleccionar qué tags mostrar aquí */}
            <ul className="tag-filter-list">
                {userTags.map(tag => (
                    <li key={tag.id} className="tag-filter-item">
                        <label>
                            <input 
                                type="checkbox"
                                value={tag.id}
                                checked={selectedTags ? selectedTags.includes(tag.id) : false} // selectedTags vendrá del estado global
                                onChange={() => handleCheckboxChange(tag.id)}
                            />
                            <span>{tag.name}</span>
                        </label>
                    </li>
                ))}
            </ul>
             {onConfigOpen && (
                <button onClick={onConfigOpen} style={{fontSize: '0.8em', marginTop: '0.5rem', background: 'none', border: '1px solid var(--color-text-on-dark-muted)', color: 'var(--color-text-on-dark-muted)', cursor: 'pointer' }}>
                    Configure Pinned Tags
                </button>
            )}
        </div>
    );
}

export default TagFilter;