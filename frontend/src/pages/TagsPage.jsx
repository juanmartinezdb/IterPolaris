// frontend/src/pages/TagsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import TagList from '../components/tags/TagList';
import TagForm from '../components/tags/TagForm';
import ConfirmationDialog from '../components/common/ConfirmationDialog';
import '../styles/tags.css';

const API_TAGS_URL = `${import.meta.env.VITE_API_BASE_URL}/tags`;

function TagsPage() {
    const [tags, setTags] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const [showForm, setShowForm] = useState(false);
    const [editingTag, setEditingTag] = useState(null);

    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [tagToDelete, setTagToDelete] = useState(null);

    const fetchTags = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        const token = localStorage.getItem('authToken');
        try {
            const response = await axios.get(API_TAGS_URL, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setTags(response.data || []);
        } catch (err) {
            console.error("Failed to fetch tags:", err);
            setError(err.response?.data?.error || "Failed to fetch tags. Please try again.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTags();
    }, [fetchTags]);

    const handleOpenCreateForm = () => {
        setEditingTag(null);
        setShowForm(true);
    };

    const handleOpenEditForm = (tag) => {
        setEditingTag(tag);
        setShowForm(true);
    };

    const handleFormClose = () => {
        setShowForm(false);
        setEditingTag(null);
    };

    const handleFormSubmit = async () => {
        fetchTags();
        handleFormClose();
    };

    const handleDeleteRequest = (tag) => {
        setTagToDelete(tag);
        setShowConfirmDialog(true);
    };

    const handleConfirmDelete = async () => {
        if (!tagToDelete) return;
        const token = localStorage.getItem('authToken');
        setIsLoading(true); // Puede ser útil para el diálogo también
        try {
            await axios.delete(`${API_TAGS_URL}/${tagToDelete.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setTagToDelete(null);
            setShowConfirmDialog(false);
            fetchTags();
        } catch (err) {
            console.error("Failed to delete tag:", err);
            setError(err.response?.data?.error || "Failed to delete tag. Please try again.");
            setShowConfirmDialog(false); 
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancelDelete = () => {
        setTagToDelete(null);
        setShowConfirmDialog(false);
    };
    
    if (isLoading && !showForm && !showConfirmDialog) { // Muestra loading solo si no hay otros modales activos
        return <div className="page-container"><p>Loading Tags...</p></div>;
    }


    return (
        <div className="tags-page-container">
            <h2>Manage Your Tags</h2>

            {!showForm && (
                <button onClick={handleOpenCreateForm} className="add-tag-button">
                    Add New Tag
                </button>
            )}

            {showForm && (
                <TagForm
                    tagToEdit={editingTag}
                    onFormSubmit={handleFormSubmit}
                    onCancel={handleFormClose}
                />
            )}
            
            {error && <p className="auth-error-message" style={{textAlign: 'center', marginTop: '1rem'}}>{error}</p>}


            <h3>Your Current Tags:</h3>
            <TagList
                tags={tags}
                onEditTag={handleOpenEditForm}
                onDeleteTag={handleDeleteRequest}
            />

            {showConfirmDialog && tagToDelete && (
                <ConfirmationDialog
                    message={`Are you sure you want to delete the Tag "${tagToDelete.name}"? This will remove it from all associated missions and habits.`}
                    onConfirm={handleConfirmDelete}
                    onCancel={handleCancelDelete}
                    confirmButtonText="Delete Tag"
                />
            )}
        </div>
    );
}

export default TagsPage;