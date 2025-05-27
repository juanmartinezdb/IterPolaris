// frontend/src/pages/QuestsOverviewPage.jsx
import React, { useState, useEffect, useCallback, useContext } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { UserContext } from '../contexts/UserContext';
import { getContrastColor } from '../utils/colorUtils';
import '../styles/quests.css'; // Re-use some styles for consistency

const API_QUESTS_URL = `${import.meta.env.VITE_API_BASE_URL}/quests`;

function QuestsOverviewPage({ activeTagFilters }) { // activeTagFilters might be used later if quests can be tagged
    const [quests, setQuests] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const { currentUser } = useContext(UserContext);

    const fetchQuests = useCallback(async () => {
        if (!currentUser) {
            setIsLoading(false);
            setQuests([]);
            return;
        }
        setIsLoading(true);
        setError('');
        const token = localStorage.getItem('authToken');
        try {
            // Note: The PRD and current backend for GET /api/quests does not support tag filtering directly on Quests themselves.
            // If quests were to be filtered by tags associated with their *missions*, this would be a complex backend change.
            // For now, we fetch all quests for the user.
            const response = await axios.get(API_QUESTS_URL, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            // Sort by default first, then by name
            const sortedQuests = (response.data || []).sort((a, b) => {
                if (a.is_default_quest && !b.is_default_quest) return -1;
                if (!a.is_default_quest && b.is_default_quest) return 1;
                return a.name.localeCompare(b.name);
            });
            setQuests(sortedQuests);
        } catch (err) {
            console.error("Failed to fetch quests for overview:", err);
            setError(err.response?.data?.error || "Failed to load your Quests.");
            setQuests([]);
        } finally {
            setIsLoading(false);
        }
    }, [currentUser]);

    useEffect(() => {
        fetchQuests();
    }, [fetchQuests]);

    // Styling for quest items can be similar to QuestItem.jsx or a new simplified version
    const questItemStyle = (questColor) => ({
        borderLeft: `5px solid ${questColor || 'var(--color-accent-gold)'}`,
        backgroundColor: 'var(--color-bg-elevated)',
        padding: '1rem 1.5rem',
        marginBottom: '1rem',
        borderRadius: 'var(--border-radius-input)',
        display: 'block', // To make the whole item clickable via Link
        textDecoration: 'none',
        color: 'var(--color-text-on-dark)',
        transition: 'var(--transition-swift)',
    });
    const questItemHoverStyle = {
        transform: 'translateY(-2px)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
    };


    if (isLoading) {
        return <div className="page-container quests-page-container"><p>Loading your Quests...</p></div>;
    }
    if (error) {
        return <div className="page-container quests-page-container"><p className="auth-error-message">{error}</p></div>;
    }

    return (
        <div className="page-container quests-page-container">
            {quests.length === 0 ? (
                <p style={{ textAlign: 'center', marginTop: '2rem' }}>
                    You haven't created any Quests yet. 
                    <Link to="/quests" style={{ color: 'var(--color-accent-gold)', marginLeft: '0.5rem' }}>
                        Manage Quests
                    </Link>
                </p>
            ) : (
                <ul className="quest-list" style={{ listStyle: 'none', padding: 0 }}>
                    {quests.map(quest => (
                        <li key={quest.id}>
                            <Link 
                                to={`/quests/${quest.id}`} 
                                style={questItemStyle(quest.color)}
                                onMouseOver={(e) => e.currentTarget.style.transform = questItemHoverStyle.transform}
                                onMouseOut={(e) => e.currentTarget.style.transform = 'none'}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h3 className="quest-name" style={{ margin: 0, color: getContrastColor(quest.color) === 'var(--color-text-on-accent, #0A192F)' ? 'var(--color-text-on-dark, #EAEAEA)' : 'var(--color-text-on-dark, #EAEAEA)' }}>
                                        {quest.name}
                                        {quest.is_default_quest && (
                                            <span className="quest-default-badge" style={{fontSize: '0.7em', marginLeft: '0.5em'}}>DEFAULT</span>
                                        )}
                                    </h3>
                                    <span style={{fontSize: '0.9em', color: 'var(--color-accent-gold)'}}>➔</span>
                                </div>
                                {quest.description && (
                                    <p className="quest-description" style={{fontSize: '0.85em', opacity: 0.8, marginTop: '0.25rem', marginBottom: 0}}>
                                        {quest.description.length > 100 ? `${quest.description.substring(0, 97)}...` : quest.description}
                                    </p>
                                )}
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default QuestsOverviewPage;