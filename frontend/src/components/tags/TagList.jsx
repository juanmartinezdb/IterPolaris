// frontend/src/components/tags/TagList.jsx
import React from 'react';
import '../../styles/tags.css';

function TagList({ tags, onEditTag, onDeleteTag }) {
    if (!tags || tags.length === 0) {
        return <p style={{ textAlign: 'center', marginTop: '2rem', fontFamily: 'var(--font-secondary)' }}>No Tags found. Create tags to organize your missions!</p>;
    }

    return (
        <ul className="tag-list">
            {tags.map((tag) => (
                <li key={tag.id} className="tag-item">
                    <span className="tag-name">{tag.name}</span>
                    <div className="tag-actions">
                        <button 
                            onClick={() => onEditTag(tag)}
                            aria-label={`Edit Tag ${tag.name}`}
                        >
                            Edit
                        </button>
                        <button 
                            onClick={() => onDeleteTag(tag)}
                            className="delete-btn"
                            aria-label={`Delete Tag ${tag.name}`}
                        >
                            Delete
                        </button>
                    </div>
                </li>
            ))}
        </ul>
    );
}

export default TagList;