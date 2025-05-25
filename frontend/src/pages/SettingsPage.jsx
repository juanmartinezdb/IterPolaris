// frontend/src/pages/SettingsPage.jsx
import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { UserContext } from '../contexts/UserContext';
import '../styles/settings.css';

const API_TAGS_URL = `${import.meta.env.VITE_API_BASE_URL}/tags`;
const API_USER_SETTINGS_URL = `${import.meta.env.VITE_API_BASE_URL}/auth/me/settings`;
const API_QUESTS_URL = `${import.meta.env.VITE_API_BASE_URL}/quests`;

const BASE_PANEL_BLUEPRINTS = [
    { panel_type: "UPCOMING_MISSIONS", name: "Upcoming Items", isProjectPanel: false },
    { panel_type: "TODAY_AGENDA", name: "Today's Full Agenda", isProjectPanel: false },
    { panel_type: "MISSION_POOL", name: "Mission Pool", isProjectPanel: false },
    { panel_type: "TODAY_HABITS", name: "Today's Habits", isProjectPanel: false },
    { panel_type: "RECENT_ACTIVITY", name: "Recent Activity", isProjectPanel: false },
    { panel_type: "RESCUE_MISSIONS", name: "Rescue Missions", isProjectPanel: false },
    { panel_type: "TODAY_LOGBOOK_ENTRIES", name: "Today's Logbook", isProjectPanel: false },
    { panel_type: "HABIT_STATISTICS", name: "Habit Statistics", isProjectPanel: false },
    { panel_type: "ENERGY_STATISTICS", name: "Energy Statistics", isProjectPanel: false },
];

function SettingsPage() {
    const { currentUser, fetchUserProfile, updateLocalCurrentUser } = useContext(UserContext);
    
    const [userTags, setUserTags] = useState([]);
    const [pinnedTagIds, setPinnedTagIds] = useState([]);
    
    const [activePanels, setActivePanels] = useState([]); 
    const [availablePanelBlueprints, setAvailablePanelBlueprints] = useState([]);

    const [userQuests, setUserQuests] = useState([]);

    const [isLoadingTags, setIsLoadingTags] = useState(false);
    const [isLoadingQuests, setIsLoadingQuests] = useState(false);
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        if (currentUser?.settings && userQuests !== null) { // Check userQuests !== null to ensure it has been fetched or attempted
            const savedPanelsConfig = currentUser.settings.dashboard_panels || [];
            
            const currentActive = savedPanelsConfig
                .filter(p => p.is_active) // This should always be true if coming from saved active panels
                .sort((a, b) => a.order - b.order)
                .map(p_active => ({
                    ...p_active, // p_active already has a UUID 'id' from backend
                    isProjectPanel: p_active.panel_type === "PROJECT_TASKS",
                    quest_name: p_active.panel_type === "PROJECT_TASKS" && p_active.quest_id && userQuests.length > 0 
                                ? userQuests.find(q => q.id === p_active.quest_id)?.name || 'Unknown Project' 
                                : null,
                }));
            setActivePanels(currentActive);

            let initialAvailable = [...BASE_PANEL_BLUEPRINTS.map(bp => ({
                id: bp.panel_type, // Blueprint ID for non-project panels is their type
                ...bp,
                quest_id: null, quest_name: null
            }))];

            (userQuests || []).forEach(quest => {
                initialAvailable.push({
                    id: `project-blueprint-${quest.id}`, // Unique ID for project panel *blueprint*
                    panel_type: "PROJECT_TASKS",
                    name: `Project: ${quest.name}`,
                    isProjectPanel: true,
                    quest_id: quest.id,
                    quest_name: quest.name
                });
            });
            
            currentActive.forEach(activeP => {
                const blueprintIdToRemove = activeP.isProjectPanel 
                    ? `project-blueprint-${activeP.quest_id}` 
                    : activeP.panel_type;
                initialAvailable = initialAvailable.filter(bp => bp.id !== blueprintIdToRemove);
            });
            setAvailablePanelBlueprints(initialAvailable.sort((a,b) => a.name.localeCompare(b.name)));
            setPinnedTagIds(currentUser.settings.sidebar_pinned_tag_ids || []);
        } else if (!currentUser && !isLoadingQuests) { // Handle case where user logs out or settings are null
             setPinnedTagIds([]);
             setActivePanels([]);
             let baseBlueprints = BASE_PANEL_BLUEPRINTS.map(bp => ({ id: bp.panel_type, ...bp, quest_id: null, quest_name: null }));
             (userQuests || []).forEach(quest => {
                baseBlueprints.push({
                    id: `project-blueprint-${quest.id}`, panel_type: "PROJECT_TASKS", name: `Project: ${quest.name}`,
                    isProjectPanel: true, quest_id: quest.id, quest_name: quest.name
                });
            });
            setAvailablePanelBlueprints(baseBlueprints.sort((a,b) => a.name.localeCompare(b.name)));
        }
    }, [currentUser, userQuests, isLoadingQuests]);


    useEffect(() => { 
        const loadUserTags = async () => { /* ... (same as before) ... */ };
        const loadUserQuests = async () => { /* ... (same as before) ... */ };
        if (currentUser) { loadUserTags(); loadUserQuests(); }
        else { setUserTags([]); setUserQuests(null); } // Reset on logout
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser]);
    // Re-add loadUserTags and loadUserQuests from previous response.
    useEffect(() => { 
        const loadUserTags = async () => {
            if (!currentUser) return; setIsLoadingTags(true);
            const token = localStorage.getItem('authToken');
            try {
                const response = await axios.get(API_TAGS_URL, { headers: { 'Authorization': `Bearer ${token}` } });
                setUserTags(response.data || []);
            } catch (err) { setError("Could not load your tags."); } 
            finally { setIsLoadingTags(false); }
        };
        if (currentUser) loadUserTags();
    }, [currentUser]);

    useEffect(() => { 
        const loadUserQuests = async () => {
            if (!currentUser) { setUserQuests([]); setIsLoadingQuests(false); return; } // Ensure quests reset if no user
            setIsLoadingQuests(true);
            const token = localStorage.getItem('authToken');
            try {
                const response = await axios.get(API_QUESTS_URL, { headers: { 'Authorization': `Bearer ${token}` } });
                setUserQuests(response.data || []);
            } catch (err) { setError("Could not load your quests."); setUserQuests([]); }
            finally { setIsLoadingQuests(false); }
        };
       loadUserQuests(); // Load quests regardless of currentUser initially, then re-filter available panels when currentUser loads
    }, [currentUser]);


    const handlePinnedTagChange = (tagId) => { /* ... (same as before) ... */ 
        setPinnedTagIds(prev => prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]);
        setSuccessMessage(''); 
        setError('');
    };

    const handleActivatePanel = (blueprintIdToActivate) => {
        const blueprint = availablePanelBlueprints.find(bp => bp.id === blueprintIdToActivate);
        if (!blueprint) { console.error("Blueprint not found for activation:", blueprintIdToActivate); return; }
        setError(''); 
        
        // Prevent activating multiple instances of the same non-project panel type
        if (!blueprint.isProjectPanel && activePanels.some(ap => ap.panel_type === blueprint.panel_type)) {
            setError(`Panel type "${blueprint.name}" is already active. Only one instance is allowed.`);
            return;
        }
        // Prevent activating a project panel for a quest that's already active
        if (blueprint.isProjectPanel && activePanels.some(ap => ap.panel_type === "PROJECT_TASKS" && ap.quest_id === blueprint.quest_id)) {
             setError(`A panel for project "${blueprint.quest_name}" is already active.`);
            return;
        }

        const newActivePanelInstance = {
            id: uuidv4(), // CRITICAL: Generate a new UUID for the active instance
            panel_type: blueprint.panel_type,
            name: blueprint.name, 
            isProjectPanel: blueprint.isProjectPanel,
            quest_id: blueprint.isProjectPanel ? blueprint.quest_id : null, // Only set quest_id if it's a project panel
            quest_name: blueprint.isProjectPanel ? blueprint.quest_name : null, 
            is_active: true, // This instance is active
            order: activePanels.length // Append to the end
        };
        setActivePanels(prev => [...prev, newActivePanelInstance]);
        setAvailablePanelBlueprints(prev => prev.filter(bp => bp.id !== blueprintIdToActivate));
        setSuccessMessage('');
    };

    const handleDeactivatePanel = (panelInstanceIdToDeactivate) => {
        const panelToDeactivate = activePanels.find(p => p.id === panelInstanceIdToDeactivate);
        if (!panelToDeactivate) { console.error("Panel instance not found for deactivation:", panelInstanceIdToDeactivate); return; }
        setError('');

        setActivePanels(prev => prev.filter(p => p.id !== panelInstanceIdToDeactivate)
                                 .map((p, index) => ({ ...p, order: index }))); 
        
        // Determine the ID of the blueprint to add back to available list
        const blueprintIdToAddBack = panelToDeactivate.isProjectPanel 
            ? `project-blueprint-${panelToDeactivate.quest_id}` 
            : panelToDeactivate.panel_type;

        // Construct the blueprint object
        const blueprintReAdd = {
            id: blueprintIdToAddBack,
            panel_type: panelToDeactivate.panel_type,
            name: panelToDeactivate.name,
            isProjectPanel: panelToDeactivate.isProjectPanel,
            quest_id: panelToDeactivate.quest_id,
            quest_name: panelToDeactivate.quest_name
        };
        
        // Only add back if not already in available (handles cases where data might be slightly out of sync)
        if (!availablePanelBlueprints.some(bp => bp.id === blueprintIdToAddBack)) {
            setAvailablePanelBlueprints(prev => [...prev, blueprintReAdd].sort((a,b) => a.name.localeCompare(b.name)));
        }
        setSuccessMessage('');
    };

    const movePanel = (panelId, direction) => { /* ... (same as before) ... */ 
        const index = activePanels.findIndex(p => p.id === panelId);
        if (index === -1) return;
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= activePanels.length) return;
        const newActivePanels = [...activePanels];
        const temp = newActivePanels[index];
        newActivePanels[index] = newActivePanels[newIndex];
        newActivePanels[newIndex] = temp;
        setActivePanels(newActivePanels.map((p, i) => ({ ...p, order: i })));
        setSuccessMessage('');
        setError('');
    };

    const handleSaveChanges = async () => { /* ... (same as before, ensure payload is correct) ... */
        setIsSavingSettings(true); setError(''); setSuccessMessage('');
        const token = localStorage.getItem('authToken');
        
        const panelsToSave = activePanels.map((p, index) => ({
            id: p.id, // This is the UUID of the active instance
            panel_type: p.panel_type,
            name: p.name,
            order: index, 
            is_active: true, // All panels in activePanels are active
            quest_id: p.isProjectPanel ? p.quest_id : null, 
        }));
        
        const payload = {
            settings: {
                sidebar_pinned_tag_ids: pinnedTagIds,
                dashboard_panels: panelsToSave
            }
        };
        
        try {
            const response = await axios.put(API_USER_SETTINGS_URL, payload, { headers: { 'Authorization': `Bearer ${token}` } });
            setSuccessMessage("Settings saved successfully!");
            // Update local context with precisely what the backend confirmed and returned
            if (response.data?.settings) { 
                 updateLocalCurrentUser({ 
                    settings: response.data.settings, 
                    // avatar_url is not changed here, but if backend returned it, include it
                    // avatar_url: response.data.avatar_url || currentUser.avatar_url 
                });
            } else { 
                await fetchUserProfile(); // Fallback to full refresh if specific settings object not returned
            }
        } catch (err) {
            const apiError = err.response?.data?.error || err.response?.data?.errors || "Failed to save settings.";
            let detailedError = typeof apiError === 'string' ? apiError : JSON.stringify(apiError);
            if (err.response?.data?.errors && typeof err.response.data.errors === 'object') {
                 detailedError = Object.entries(err.response.data.errors)
                    .map(([key, val]) => `${key.replace("dashboard_panels.", "Panel ")}: ${Array.isArray(val) ? val.join(', ') : val}`)
                    .join('; ');
            } else if (err.response?.data?.message) { // Sometimes backend might send a 'message' on error
                detailedError = err.response.data.message;
            }
            setError(`Save failed: ${detailedError}`);
            console.error("Save settings error details:", err.response?.data);
        } finally {
            setIsSavingSettings(false);
        }
    };
    
    if (!currentUser && !isLoadingQuests && !isLoadingTags) { 
      return <div className="page-container settings-page"><p>Loading user data...</p></div>;
    }

    return (
        <div className="page-container settings-page">
            <h2>Settings</h2>
            {error && <p className="error-message" style={{whiteSpace: "pre-wrap"}}>{error}</p>}
            {successMessage && <p className="success-message">{successMessage}</p>}

            <section className="settings-section">
                <h3>Sidebar Tag Filters</h3>
                <p className="settings-description">
                    Select tags to appear in the sidebar for quick filtering across the app.
                </p>
                {isLoadingTags ? <p>Loading tags...</p> : userTags.length === 0 ? (
                    <p>No tags created. <a href="/tags" style={{color: 'var(--color-accent-gold)'}}>Manage Tags</a></p>
                ) : (
                    <div className="pinned-tags-list">
                        {userTags.map(tag => (
                            <label key={tag.id} className="pinned-tag-item">
                                <input type="checkbox" checked={pinnedTagIds.includes(tag.id)} onChange={() => handlePinnedTagChange(tag.id)} disabled={isSavingSettings} />
                                <span>{tag.name}</span>
                            </label>
                        ))}
                    </div>
                )}
            </section>

            <section className="settings-section dashboard-settings-container">
                <h3>Dashboard Panel Configuration</h3>
                <p className="settings-description">
                    Choose which panels to display on your dashboard and their order.
                </p>
                <div className="panel-config-area">
                    <div className="panel-column">
                        <h4>Available Panels</h4>
                        {(isLoadingQuests && availablePanelBlueprints.length === 0) && <p>Loading panel options...</p>}
                        {!isLoadingQuests && availablePanelBlueprints.length === 0 && (
                            <p className="empty-list-message">All available panel types are currently active.</p>
                        )}
                        <ul className="panel-list">
                            {availablePanelBlueprints.map((blueprint) => (
                                <li key={blueprint.id} className="panel-item">
                                    <div className="panel-item-content">
                                        <span className="panel-name">{blueprint.name}</span>
                                        <span className="panel-type-label">
                                            ({blueprint.panel_type.replace(/_/g, ' ').toLowerCase()})
                                        </span>
                                    </div>
                                    <div className="panel-item-actions">
                                        <button onClick={() => handleActivatePanel(blueprint.id)} title="Activate Panel" className="move-active-btn">⬅️ Activate</button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                    
                    <div className="panel-column">
                        <h4>Active Dashboard Panels (Drag to Reorder - Feature Placeholder)</h4>
                         <p className="settings-description" style={{fontSize: '0.8em', fontStyle: 'italic'}}>
                            Note: Drag-and-drop reordering is planned for a future update. Use arrow buttons for now.
                        </p>
                        {activePanels.length === 0 && (
                            <p className="empty-list-message">No active panels. Activate some from the left!</p>
                        )}
                        <ul className="panel-list">
                            {activePanels.map((panel, index) => (
                                <li key={panel.id} className="panel-item">
                                    <div className="panel-item-content">
                                        <span className="panel-name">{panel.name}</span>
                                        <span className="panel-type-label">
                                            ({panel.panel_type.replace(/_/g, ' ').toLowerCase()})
                                            {panel.isProjectPanel && panel.quest_name ? ` - ${panel.quest_name}` : ''}
                                        </span>
                                    </div>
                                    <div className="panel-item-actions">
                                        <button className="order-btn" onClick={() => movePanel(panel.id, -1)} disabled={index === 0} title="Move Up">🔼</button>
                                        <button className="order-btn" onClick={() => movePanel(panel.id, 1)} disabled={index === activePanels.length - 1} title="Move Down">🔽</button>
                                        <button onClick={() => handleDeactivatePanel(panel.id)} title="Deactivate Panel" className="move-inactive-btn">Deactivate ➡️</button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </section>
            
            <button onClick={handleSaveChanges} disabled={isSavingSettings || isLoadingTags || isLoadingQuests} className="settings-save-button">
                {isSavingSettings ? "Saving Settings..." : "Save All Settings"}
            </button>
        </div>
    );
}

export default SettingsPage;