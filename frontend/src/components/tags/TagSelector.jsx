// frontend/src/components/tags/TagSelector.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../../styles/tags.css'; // Para .tag-selector-*, etc.

const API_TAGS_URL = import.meta.env.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL}/tags` : 'http://localhost:5000/api/tags';

function TagSelector({ selectedTagIds = [], onSelectedTagsChange, entityType, entityId }) {
    const [availableTags, setAvailableTags] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // Cargar todos los tags del usuario
    useEffect(() => {
        const fetchAllUserTags = async () => {
            setIsLoading(true);
            setError('');
            const token = localStorage.getItem('authToken');
            try {
                const response = await axios.get(API_TAGS_URL, {
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                setAvailableTags(response.data || []);
            } catch (err) {
                console.error('Failed to fetch available tags:', err);
                setError('Could not load tags.');
                setAvailableTags([]);
            } finally {
                setIsLoading(false);
            }
        };
        fetchAllUserTags();
    }, []);
    
    const handleTagClick = (tagId) => {
        const currentlySelected = new Set(selectedTagIds);
        if (currentlySelected.has(tagId)) {
            currentlySelected.delete(tagId);
        } else {
            currentlySelected.add(tagId);
        }
        onSelectedTagsChange(Array.from(currentlySelected));
    };

    if (isLoading) {
        return <div className="tag-selector-container"><p>Loading tags...</p></div>;
    }
    if (error) {
        return <div className="tag-selector-container"><p className="error-message">{error}</p></div>;
    }
    if (availableTags.length === 0) {
         return <div className="tag-selector-container"><p>No tags available. <a href="/tags" style={{color: 'var(--color-accent-gold)'}}>Create some first!</a></p></div>;
    }


    return (
        <div className="tag-selector-container">
            <label>Tags:</label>
            <div className="tag-selector-available-tags">
                {availableTags.map(tag => (
                    <span
                        key={tag.id}
                        className={`tag-selector-tag ${selectedTagIds.includes(tag.id) ? 'selected' : ''}`}
                        onClick={() => handleTagClick(tag.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleTagClick(tag.id);}}
                    >
                        {tag.name}
                    </span>
                ))}
            </div>
            {selectedTagIds.length > 0 && (
                <div className="tag-selector-selected-tags-preview">
                    Selected: {availableTags.filter(t => selectedTagIds.includes(t.id)).map(t => <span key={t.id}>{t.name}</span>)}
                </div>
            )}
        </div>
    );
}

export default TagSelector;