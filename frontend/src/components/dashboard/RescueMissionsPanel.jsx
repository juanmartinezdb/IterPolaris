// frontend/src/components/dashboard/RescueMissionsPanel.jsx
import React, { useState, useEffect, useCallback, useContext } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../../contexts/UserContext';
import { getContrastColor } from '../../utils/colorUtils';
import Modal from '../common/Modal'; // For potential edit modal for pool missions
import PoolMissionForm from '../missions/pool/PoolMissionForm'; // For editing pool missions
import '../../styles/dashboard.css'; 
import '../../styles/missions-shared.css'; 

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function RescueMissionsPanel({ config, activeTagFilters, title }) {
    const { currentUser, isLoadingProfile, refreshUserStatsAndEnergy } = useContext(UserContext);
    const [rescueItems, setRescueItems] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [infoMessage, setInfoMessage] = useState('');
    const navigate = useNavigate();

    const [showEditPoolMissionModal, setShowEditPoolMissionModal] = useState(false);
    const [missionToEdit, setMissionToEdit] = useState(null);

    const clearInfoMessage = useCallback(() => {
        setTimeout(() => setInfoMessage(''), 3000);
    }, []);

    const fetchRescueItems = useCallback(async () => {
        if (!currentUser || isLoadingProfile) {
            setRescueItems([]);
            return;
        }
        setIsLoading(true);
        setError(null);
        const token = localStorage.getItem('authToken');
        const params = new URLSearchParams();
        if (activeTagFilters && activeTagFilters.length > 0) {
            activeTagFilters.forEach(tagId => params.append('tags', tagId));
        }
        params.append('limit', '7');

        try {
            const response = await axios.get(`${API_BASE_URL}/dashboard/rescue-missions`, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: params
            });
            setRescueItems(response.data || []);
        } catch (err) {
            setError(err.response?.data?.error || "Failed to fetch items for rescue.");
            setRescueItems([]);
        } finally {
            setIsLoading(false);
        }
    }, [currentUser, activeTagFilters, isLoadingProfile]);

    useEffect(() => {
        fetchRescueItems();
    }, [fetchRescueItems]);

    const handleRescueScheduledMission = (item) => {
        const token = localStorage.getItem('authToken');
        axios.patch(`${API_BASE_URL}/scheduled-missions/${item.id}/status`, { status: 'PENDING' }, { headers: { 'Authorization': `Bearer ${token}` }})
            .then(() => {
                setInfoMessage(`"${item.title}" is now pending and can be rescheduled.`);
                fetchRescueItems(); 
                refreshUserStatsAndEnergy(); 
                clearInfoMessage();
                // Consider navigating or prompting user for calendar
                // navigate(`/calendar?date=${item.original_start_datetime.split('T')[0]}`);
            })
            .catch(err => {
                setError(err.response?.data?.error || "Failed to rescue scheduled mission.");
                clearInfoMessage();
            });
    };

    const handleRescuePoolMission = (item) => {
        const token = localStorage.getItem('authToken');
        axios.patch(`${API_BASE_URL}/pool-missions/${item.id}/focus`, { focus_status: 'ACTIVE' }, { headers: { 'Authorization': `Bearer ${token}` }})
            .then(() => {
                setInfoMessage(`"${item.title}" set to Active focus in Mission Pool.`);
                fetchRescueItems(); 
                clearInfoMessage();
                // navigate('/pool-missions'); // Optionally navigate
            })
            .catch(err => {
                setError(err.response?.data?.error || "Failed to rescue pool mission.");
                clearInfoMessage();
            });
    };
    
    const handleEditPoolMissionFromRescue = (item) => {
        // The item here is from the rescue list, may need to fetch full details if partial
        // For now, assume 'item' has enough to pre-fill PoolMissionForm
        const fullItemDetails = {
            id: item.id,
            title: item.title,
            description: item.description || '',
            energy_value: item.energy_value,
            points_value: item.points_value,
            quest_id: item.quest_id,
            tags: item.tags || [], // Ensure tags is an array
            focus_status: 'ACTIVE', // When editing from rescue, default to making it active
            status: 'PENDING' // It must be pending to be in rescue (if deferred)
        };
        setMissionToEdit(fullItemDetails);
        setShowEditPoolMissionModal(true);
    };
    
    const handlePoolMissionFormSubmit = () => {
        setShowEditPoolMissionModal(false);
        setMissionToEdit(null);
        fetchRescueItems(); // Refresh rescue list
        refreshUserStatsAndEnergy();
        setInfoMessage("Pool Mission updated and activated!");
        clearInfoMessage();
    };


    const panelTitle = title || "Rescue Missions";

    return (
        <div className="dashboard-panel rescue-missions-panel">
            <h3>{panelTitle}</h3>
            {infoMessage && <p className="auth-success-message" style={{fontSize: '0.85em', padding: '0.5rem', margin: '0 0 0.5rem 0'}}>{infoMessage}</p>}
            {isLoading && <p>Searching for missions to rescue...</p>}
            {error && <p className="error-message" style={{ textAlign: 'center' }}>{error}</p>}
            {!isLoading && rescueItems.length === 0 && !error && (
                <p className="empty-state-message">No missions currently need rescuing!</p>
            )}
            {rescueItems.length > 0 && (
                <ul className="upcoming-items-list panel-list-condensed">
                    {rescueItems.map(item => {
                        const itemQuestColor = item.quest_color || 'var(--color-text-on-dark-muted)';
                        const textColor = getContrastColor(itemQuestColor);
                        const itemTypeDisplay = item.type === 'SCHEDULED_MISSION' ? 'Skipped Mission' : 'Deferred Task';
                        
                        let rescueAction, rescueText, rescueTitle;
                        if (item.type === 'SCHEDULED_MISSION') {
                            rescueAction = () => handleRescueScheduledMission(item);
                            rescueText = "Set Pending";
                            rescueTitle = "Mark as Pending to Reschedule";
                        } else if (item.type === 'POOL_MISSION') {
                            rescueAction = () => handleRescuePoolMission(item);
                            rescueText = "Set Active";
                            rescueTitle = "Set to Active Focus";
                        }

                        return (
                            <li key={`${item.type}-${item.id}`} className="upcoming-item" style={{ borderLeftColor: itemQuestColor, opacity: 0.9 }}>
                                <div className="upcoming-item-main">
                                    <div className="upcoming-item-info">
                                        <span className="upcoming-item-type-badge" style={{ backgroundColor: itemQuestColor, color: textColor, fontSize: '0.7em' }}>
                                            {itemTypeDisplay}
                                        </span>
                                        <span className="upcoming-item-title" title={item.title} style={{textDecoration: item.type === 'SCHEDULED_MISSION' ? 'line-through' : 'none'}}>
                                            {item.title}
                                        </span>
                                    </div>
                                    <div className="upcoming-item-actions">
                                        {item.type === 'POOL_MISSION' && (
                                            <button
                                                onClick={() => handleEditPoolMissionFromRescue(item)}
                                                className="action-btn"
                                                title="Edit & Activate"
                                                style={{borderColor: 'var(--color-accent-gold)', color: 'var(--color-accent-gold)', fontSize: '1em'}}
                                            >✎</button>
                                        )}
                                        <button
                                            onClick={rescueAction}
                                            className="action-btn rescue-action-btn" 
                                            title={rescueTitle}
                                            style={{minWidth: '70px', borderRadius: 'var(--border-radius-button)', padding: '0.2rem 0.4rem'}}
                                        >{rescueText}</button>
                                    </div>
                                </div>
                                 <div className="upcoming-item-meta-row" style={{paddingLeft: 'calc(0.2em + 4px + 0.6rem)', fontSize: '0.8em'}}>
                                    {item.quest_name && (
                                         <span 
                                            className="quest-name-badge-sm" 
                                            style={{ 
                                                backgroundColor: itemQuestColor, color: textColor,
                                                borderColor: textColor === 'var(--color-text-on-accent, #0A192F)' ? 'var(--color-text-on-dark-muted)' : 'transparent'
                                            }}
                                            title={`Quest: ${item.quest_name}`}
                                        >
                                            {item.quest_name}
                                        </span>
                                    )}
                                    {item.original_start_datetime && item.type === 'SCHEDULED_MISSION' && (
                                        <span style={{marginLeft: item.quest_name ? '0.5rem' : '0', fontStyle: 'italic'}}>
                                            (Was: {new Date(item.original_start_datetime).toLocaleDateString()})
                                        </span>
                                    )}
                                </div>
                                {item.tags && item.tags.length > 0 && (
                                    <div className="upcoming-item-tags-container" style={{paddingLeft: 'calc(0.2em + 4px + 0.6rem)'}}>
                                        {item.tags.map(tag => (
                                            <span key={tag.id} className="tag-badge-sm">{tag.name}</span>
                                        ))}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
             {showEditPoolMissionModal && missionToEdit && (
                <Modal title="Edit & Activate Pool Mission" onClose={() => {setShowEditPoolMissionModal(false); setMissionToEdit(null);}}>
                    <PoolMissionForm
                        missionToEdit={missionToEdit}
                        onFormSubmit={handlePoolMissionFormSubmit}
                        onCancel={() => {setShowEditPoolMissionModal(false); setMissionToEdit(null);}}
                    />
                </Modal>
            )}
        </div>
    );
}

export default RescueMissionsPanel;