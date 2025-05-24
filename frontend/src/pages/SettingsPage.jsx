// frontend/src/pages/SettingsPage.jsx
import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { UserContext } from '../contexts/UserContext';
import '../styles/settings.css'; // Crearemos este archivo CSS

const API_TAGS_URL = `${import.meta.env.VITE_API_BASE_URL}/tags`;
const API_USER_SETTINGS_URL = `${import.meta.env.VITE_API_BASE_URL}/auth/me/settings`;

function SettingsPage() {
    const { currentUser, fetchUserProfile } = useContext(UserContext);
    const [userTags, setUserTags] = useState([]);
    const [pinnedTagIds, setPinnedTagIds] = useState([]);
    const [isLoadingTags, setIsLoadingTags] = useState(false);
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Cargar todos los tags del usuario
    useEffect(() => {
        const loadUserTags = async () => {
            if (!currentUser) return;
            setIsLoadingTags(true);
            const token = localStorage.getItem('authToken');
            try {
                const response = await axios.get(API_TAGS_URL, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                setUserTags(response.data || []);
            } catch (err) {
                console.error("SettingsPage: Failed to load user tags", err);
                setError("Could not load your tags.");
            } finally {
                setIsLoadingTags(false);
            }
        };
        loadUserTags();
    }, [currentUser]);

    // Inicializar pinnedTagIds desde currentUser.settings
    useEffect(() => {
        if (currentUser?.settings?.sidebar_pinned_tag_ids) {
            setPinnedTagIds(currentUser.settings.sidebar_pinned_tag_ids);
        } else {
            setPinnedTagIds([]); // Default a vacío si no hay settings o la key no existe
        }
    }, [currentUser?.settings?.sidebar_pinned_tag_ids]);

    const handlePinnedTagChange = (tagId) => {
        setPinnedTagIds(prev =>
            prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
        );
        setSuccessMessage(''); // Clear success message on change
    };

    const handleSaveChanges = async () => {
        setIsSavingSettings(true);
        setError('');
        setSuccessMessage('');
        const token = localStorage.getItem('authToken');
        try {
            const payload = {
                settings: {
                    sidebar_pinned_tag_ids: pinnedTagIds
                }
                // avatar_url no se maneja aquí por ahora, se hará en ProfilePage
            };
            await axios.put(API_USER_SETTINGS_URL, payload, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setSuccessMessage("Sidebar tag preferences saved successfully!");
            // Refrescar el perfil del usuario para que UserContext obtenga los nuevos settings
            await fetchUserProfile(); 
        } catch (err) {
            console.error("SettingsPage: Failed to save settings", err);
            setError(err.response?.data?.error || "Failed to save settings.");
        } finally {
            setIsSavingSettings(false);
        }
    };

    if (!currentUser) {
        return <div className="page-container settings-page"><p>Loading user data...</p></div>;
    }

    return (
        <div className="page-container settings-page">
            <h2>Settings</h2>

            {error && <p className="error-message">{error}</p>}
            {successMessage && <p className="success-message">{successMessage}</p>}

            <section className="settings-section">
                <h3>Sidebar Tag Filters</h3>
                <p className="settings-description">
                    Select which of your tags you'd like to have readily available for filtering in the sidebar.
                    If none are selected, all your tags will be available in the sidebar filter.
                </p>
                {isLoadingTags ? (
                    <p>Loading your tags...</p>
                ) : userTags.length === 0 ? (
                    <p>You don't have any tags yet. <a href="/tags">Create some tags</a> to customize your sidebar.</p>
                ) : (
                    <div className="pinned-tags-list">
                        {userTags.map(tag => (
                            <label key={tag.id} className="pinned-tag-item">
                                <input
                                    type="checkbox"
                                    checked={pinnedTagIds.includes(tag.id)}
                                    onChange={() => handlePinnedTagChange(tag.id)}
                                    disabled={isSavingSettings}
                                />
                                <span>{tag.name}</span>
                            </label>
                        ))}
                    </div>
                )}
                <button 
                    onClick={handleSaveChanges} 
                    disabled={isSavingSettings || isLoadingTags}
                    className="settings-save-button"
                >
                    {isSavingSettings ? "Saving..." : "Save Sidebar Tag Preferences"}
                </button>
            </section>
            
            {/* Placeholder for Avatar Change - Tarea 9.4 */}
            <section className="settings-section">
                <h3>Profile Customization</h3>
                 <p className="settings-description">
                    Manage your profile details and avatar.
                    {/* Link a ProfilePage o incluir campos aquí */}
                 </p>
                 <p><em>Avatar upload and profile editing will be available on the Profile page.</em></p>
            </section>

        </div>
    );
}

export default SettingsPage;