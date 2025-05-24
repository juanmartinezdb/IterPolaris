// frontend/src/components/tags/TagFilter.jsx
import React, { useState, useEffect, useContext } from 'react'; // useContext añadido
import axios from 'axios';
import { UserContext } from '../../contexts/UserContext'; // Para obtener todos los tags si es necesario
import '../../styles/tags.css'; 

const API_TAGS_URL = import.meta.env.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL}/tags` : 'http://localhost:5000/api/tags';

function TagFilter({ pinnedTagIdsToShow, selectedTags, onFilterChange, onConfigOpen }) {
    const [allUserTags, setAllUserTags] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const { currentUser } = useContext(UserContext); // Para forzar recarga si el usuario cambia

    useEffect(() => {
        const fetchUserTags = async () => {
            setIsLoading(true);
            const token = localStorage.getItem('authToken');
            if (!token || !currentUser) { // No cargar si no hay token o usuario
                setAllUserTags([]);
                setIsLoading(false);
                return;
            }
            try {
                const response = await axios.get(API_TAGS_URL, {
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                setAllUserTags(response.data || []);
            } catch (error) {
                console.error('TagFilter: Failed to fetch tags:', error);
                setAllUserTags([]); 
            } finally {
                setIsLoading(false);
            }
        };
        fetchUserTags();
    }, [currentUser]); // Recargar si el usuario cambia (ej. login/logout)
    
    const handleCheckboxChange = (tagId) => {
        if (onFilterChange) {
            onFilterChange(tagId); 
        }
    };
    
    if (isLoading) {
        return <div className="tag-filter-sidebar"><p>Loading tags...</p></div>;
    }
    
    let tagsToDisplayInFilter = allUserTags;
    // Si hay tags pineados, mostrar solo esos. Sino, mostrar todos.
    if (pinnedTagIdsToShow && pinnedTagIdsToShow.length > 0) {
        const pinnedSet = new Set(pinnedTagIdsToShow);
        tagsToDisplayInFilter = allUserTags.filter(tag => pinnedSet.has(tag.id));
    }
    // Opcional: Ordenar los tags (ej. alfabéticamente)
    tagsToDisplayInFilter.sort((a, b) => a.name.localeCompare(b.name));


    if (allUserTags.length === 0) { // Cambiado a allUserTags para el mensaje de "no tags creados"
        return (
            <div className="tag-filter-sidebar">
                <h4>Filter by Tag</h4>
                <p style={{fontSize: '0.85em', color: 'var(--color-text-on-dark-muted)'}}>
                    No tags created. <a href="/tags" style={{color: 'var(--color-accent-gold)'}}>Manage Tags</a>
                </p>
            </div>
        );
    }
    if (tagsToDisplayInFilter.length === 0 && pinnedTagIdsToShow && pinnedTagIdsToShow.length > 0) {
        // Hay tags creados, pero ninguno de los pineados está disponible o no se ha pineado ninguno.
         return (
            <div className="tag-filter-sidebar">
                 <div className="tag-filter-header">
                    <h4>Filter by Tag</h4>
                    {onConfigOpen && (
                        <button onClick={onConfigOpen} className="sidebar-configure-btn" title="Configure Pinned Tags">⚙️</button>
                    )}
                </div>
                <p style={{fontSize: '0.85em', color: 'var(--color-text-on-dark-muted)'}}>
                    No pinned tags to display.
                </p>
            </div>
        );
    }


    return (
        <div className="tag-filter-sidebar">
            <div className="tag-filter-header">
                <h4>Filter by Tag</h4>
                {onConfigOpen && (
                    <button 
                        onClick={onConfigOpen} 
                        className="sidebar-configure-btn"
                        title="Configure Pinned Tags"
                    >
                        ⚙️
                    </button>
                )}
            </div>
            {tagsToDisplayInFilter.length === 0 && (!pinnedTagIdsToShow || pinnedTagIdsToShow.length === 0) && (
                 <p style={{fontSize: '0.85em', color: 'var(--color-text-on-dark-muted)'}}>
                    All your tags are shown. <span onClick={onConfigOpen} style={{color: 'var(--color-accent-gold)', cursor: 'pointer', textDecoration: 'underline' }}>Configure pinned tags</span> to customize this list.
                </p>
            )}
            <ul className="tag-filter-list">
                {tagsToDisplayInFilter.map(tag => (
                    <li key={tag.id} className="tag-filter-item">
                        <label title={tag.name}>
                            <input 
                                type="checkbox"
                                value={tag.id}
                                checked={selectedTags ? selectedTags.includes(tag.id) : false}
                                onChange={() => handleCheckboxChange(tag.id)}
                            />
                            <span className="tag-filter-name">{tag.name}</span>
                        </label>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default TagFilter;