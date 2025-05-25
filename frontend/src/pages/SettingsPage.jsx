// frontend/src/pages/SettingsPage.jsx
import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

import { UserContext } from '../contexts/UserContext';
import QuestSelector from '../components/quests/QuestSelector';
import '../styles/settings.css';

const API_TAGS_URL = `${import.meta.env.VITE_API_BASE_URL}/tags`;
const API_USER_SETTINGS_URL = `${import.meta.env.VITE_API_BASE_URL}/auth/me/settings`;
const API_QUESTS_URL = `${import.meta.env.VITE_API_BASE_URL}/quests`;

const PREDEFINED_PANEL_BLUEPRINTS = [
    // id will be panel_type for these blueprints in the 'available' list initially
    { panel_type: "UPCOMING_MISSIONS", name: "Upcoming Missions", isProjectPanel: false },
    { panel_type: "TODAY_AGENDA", name: "Today's Agenda", isProjectPanel: false },
    { panel_type: "MISSION_POOL", name: "Mission Pool", isProjectPanel: false },
    { panel_type: "TODAY_HABITS", name: "Today's Habits", isProjectPanel: false },
];

function SettingsPage() {
    const { currentUser, fetchUserProfile, updateLocalCurrentUser } = useContext(UserContext);
    
    const [userTags, setUserTags] = useState([]);
    const [pinnedTagIds, setPinnedTagIds] = useState([]);
    
    const [activePanels, setActivePanels] = useState([]); 
    const [availablePanels, setAvailablePanels] = useState([]);

    const [userQuests, setUserQuests] = useState([]);
    const [selectedQuestForNewPanel, setSelectedQuestForNewPanel] = useState('');

    const [isLoadingTags, setIsLoadingTags] = useState(false);
    const [isLoadingQuests, setIsLoadingQuests] = useState(false);
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        if (currentUser?.settings) {
            setPinnedTagIds(currentUser.settings.sidebar_pinned_tag_ids || []);
            
            const savedPanels = currentUser.settings.dashboard_panels || [];
            const currentActive = [];
            // Initialize available with predefined blueprints
            let initialAvailableBlueprints = PREDEFINED_PANEL_BLUEPRINTS.map(bp => ({
                id: bp.panel_type, // Use panel_type as the key/id for blueprints
                panel_type: bp.panel_type,
                name: bp.name,
                isProjectPanel: bp.isProjectPanel,
                quest_id: null, // Predefined don't have quest_id by default
                quest_name: null,
                is_active: false, // All blueprints start as inactive conceptually
                order: 0
            }));
            
            savedPanels.filter(p => p.is_active)
                .sort((a, b) => a.order - b.order)
                .forEach(p_active => {
                    const questName = p_active.quest_id && userQuests.length > 0 ? userQuests.find(q => q.id === p_active.quest_id)?.name : undefined;
                    currentActive.push({ ...p_active, quest_name: questName, isProjectPanel: p_active.panel_type === "PROJECT_TASKS" });

                    // Remove from available if it's a predefined panel type that's now active
                    if (p_active.panel_type !== "PROJECT_TASKS") {
                        initialAvailableBlueprints = initialAvailableBlueprints.filter(bp => bp.panel_type !== p_active.panel_type);
                    }
                });
            setActivePanels(currentActive);

            // Add saved inactive project panels to available (they already have UUIDs)
            savedPanels.forEach(sp => {
                if (!sp.is_active && sp.panel_type === "PROJECT_TASKS") {
                    // Ensure it's not already listed in active or somehow in available
                    if (!currentActive.some(ap => ap.id === sp.id) && !initialAvailableBlueprints.some(apb => apb.id === sp.id) ) {
                         initialAvailableBlueprints.push({
                            ...sp, 
                            isProjectPanel: true,
                            quest_name: sp.quest_id && userQuests.length > 0 ? userQuests.find(q => q.id === sp.quest_id)?.name : 'Unknown Project'
                        });
                    }
                }
            });
            setAvailablePanels(initialAvailableBlueprints);

        } else { 
            setPinnedTagIds([]);
            setActivePanels([]);
            setAvailablePanels(PREDEFINED_PANEL_BLUEPRINTS.map(bp => ({ 
                id: bp.panel_type, panel_type: bp.panel_type, name: bp.name, 
                isProjectPanel: bp.isProjectPanel, is_active: false, order: 0, 
                quest_id: null, quest_name: null 
            })));
        }
    }, [currentUser?.settings, userQuests]); 

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
            if (!currentUser) return; setIsLoadingQuests(true);
            const token = localStorage.getItem('authToken');
            try {
                const response = await axios.get(API_QUESTS_URL, { headers: { 'Authorization': `Bearer ${token}` } });
                const questsData = response.data || []; setUserQuests(questsData);
                if (questsData.length > 0 && !selectedQuestForNewPanel) {
                    setSelectedQuestForNewPanel(questsData[0].id); 
                }
            } catch (err) { setError("Could not load your quests."); }
            finally { setIsLoadingQuests(false); }
        };
        if (currentUser) loadUserQuests();
    }, [currentUser]);

    const handlePinnedTagChange = (tagId) => {
        setPinnedTagIds(prev => prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]);
        setSuccessMessage(''); 
    };

    const handleActivatePanel = (panelBlueprintId) => {
        const blueprint = availablePanels.find(p => p.id === panelBlueprintId);
        if (!blueprint) return;

        const newActivePanel = {
            id: uuidv4(), // ALWAYS generate a new UUID for the active instance
            panel_type: blueprint.panel_type,
            name: blueprint.name, 
            isProjectPanel: blueprint.isProjectPanel,
            quest_id: blueprint.quest_id || null, // This will be set if it's a project panel blueprint
            quest_name: blueprint.quest_name || null, 
            is_active: true,
            order: activePanels.length 
        };

        setActivePanels(prev => [...prev, newActivePanel]);
        // Remove the blueprint from available. For project panels, this means that specific instance.
        // For predefined, it means that type is now active.
        setAvailablePanels(prev => prev.filter(p => p.id !== panelBlueprintId));
        setSuccessMessage('');
    };

    const handleDeactivatePanel = (panelIdToDeactivate) => {
        const panelToDeactivate = activePanels.find(p => p.id === panelIdToDeactivate);
        if (!panelToDeactivate) return;

        setActivePanels(prev => prev.filter(p => p.id !== panelIdToDeactivate)
                                 .map((p, index) => ({ ...p, order: index }))); 
        
        // Add back to available as a blueprint
        // If it's a project panel, it keeps its specific quest_id info
        // If it's predefined, use its panel_type as the id for the available list to avoid duplicates
        const blueprintIdForAvailable = panelToDeactivate.isProjectPanel ? panelToDeactivate.id : panelToDeactivate.panel_type;
        
        if (!availablePanels.some(ap => ap.id === blueprintIdForAvailable)) {
            setAvailablePanels(prev => [...prev, {
                id: blueprintIdForAvailable, 
                panel_type: panelToDeactivate.panel_type,
                name: panelToDeactivate.name, // Keep the name it had
                isProjectPanel: panelToDeactivate.isProjectPanel,
                quest_id: panelToDeactivate.quest_id,
                quest_name: panelToDeactivate.quest_name,
                is_active: false, 
                order: 0 
            }]);
        }
        setSuccessMessage('');
    };

    const movePanel = (panelId, direction) => { /* No change needed here */
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
    };

    const handleAddProjectPanelToAvailable = () => {
        if (!selectedQuestForNewPanel) { setError("Please select a Quest."); return; }
        const quest = userQuests.find(q => q.id === selectedQuestForNewPanel);
        if (!quest) { setError("Selected Quest not found."); return; }

        // Generate a unique UUID for this project panel *blueprint* instance.
        // This allows multiple panels for the same project if ever desired, 
        // or simply ensures it's unique in the available list if that's the chosen ID strategy.
        // For now, let's assume one panel instance per quest in available list for simplicity.
        const panelBlueprintId = `project-blueprint-${quest.id}`; // ID for the *blueprint* in available list

        if (availablePanels.some(p => p.id === panelBlueprintId) || activePanels.some(p=>p.quest_id === quest.id)) {
            setError(`A panel for project "${quest.name}" is already available or active.`);
            return;
        }
        
        const newProjectPanelBlueprint = {
            id: panelBlueprintId, 
            panel_type: "PROJECT_TASKS",
            name: `Project: ${quest.name}`,
            isProjectPanel: true,
            quest_id: quest.id,
            quest_name: quest.name,
            is_active: false, // It's added to available, so not active yet
            order: 0
        };
        setAvailablePanels(prev => [...prev, newProjectPanelBlueprint]);
        setError('');
        setSuccessMessage('');
    };

    const handleSaveChanges = async () => {
        setIsSavingSettings(true); setError(''); setSuccessMessage('');
        const token = localStorage.getItem('authToken');
        
        const panelsToSave = activePanels.map((p, index) => {
            const panelData = {
                id: p.id, // This is now always a UUID
                panel_type: p.panel_type,
                name: p.name,
                order: index,
                is_active: true,
            };
            if (p.panel_type === "PROJECT_TASKS") {
                panelData.quest_id = p.quest_id; // Should be a valid UUID string
            }
            return panelData;
        });
        
        // To correctly mark panels as inactive, we need to compare against the *previous* state.
        const previousSavedPanels = currentUser?.settings?.dashboard_panels || [];
        previousSavedPanels.forEach(savedPanelConfig => {
            // If a previously saved panel is NOT in the current `activePanels` list,
            // it means it was deactivated or removed. We add it to our save payload as inactive.
            if (!activePanels.some(ap => ap.id === savedPanelConfig.id)) {
                // Check if it's already added as inactive (e.g. if a panel was made inactive and then available again)
                if (!panelsToSave.some(pts => pts.id === savedPanelConfig.id)) {
                    const inactivePanelData = {
                        id: savedPanelConfig.id, // Keep original UUID
                        panel_type: savedPanelConfig.panel_type,
                        name: savedPanelConfig.name,
                        order: 999, // Order for inactive doesn't strictly matter for display
                        is_active: false,
                    };
                    if (savedPanelConfig.panel_type === "PROJECT_TASKS") {
                        inactivePanelData.quest_id = savedPanelConfig.quest_id;
                    }
                    panelsToSave.push(inactivePanelData);
                }
            }
        });

        const payload = {
            settings: {
                sidebar_pinned_tag_ids: pinnedTagIds,
                dashboard_panels: panelsToSave
            }
        };
        
        console.log("Payload to save (SettingsPage):", JSON.stringify(payload, null, 2));

        try {
            const response = await axios.put(API_USER_SETTINGS_URL, payload, { headers: { 'Authorization': `Bearer ${token}` } });
            setSuccessMessage("Settings saved successfully!");
            if (response.data?.settings) { 
                 updateLocalCurrentUser({ settings: response.data.settings, avatar_url: response.data.avatar_url || currentUser.avatar_url });
            } else { 
                await fetchUserProfile(); 
            }
        } catch (err) {
            const apiError = err.response?.data?.error || err.response?.data?.errors || "Failed to save settings.";
            let detailedError = typeof apiError === 'string' ? apiError : JSON.stringify(apiError);
            if (err.response?.data?.errors && typeof err.response.data.errors === 'object') {
                detailedError = Object.entries(err.response.data.errors).map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`).join('; ');
            }
            setError(detailedError);
            console.error("Save settings error details:", err.response?.data);
        } finally {
            setIsSavingSettings(false);
        }
    };

    if (!currentUser) return <div className="page-container settings-page"><p>Loading user data...</p></div>;

    return (
        <div className="page-container settings-page">
            <h2>Settings</h2>
            {error && <p className="error-message" style={{whiteSpace: "pre-wrap"}}>{error}</p>}
            {successMessage && <p className="success-message">{successMessage}</p>}

            <section className="settings-section">
                <h3>Sidebar Tag Filters</h3>
                <p className="settings-description">
                    Select tags for quick filtering. All tags available if none selected.
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
                    Manage and order the panels displayed on your dashboard.
                </p>
                <div className="panel-config-area">
                    <div className="panel-column">
                        <h4>Available Panels</h4>
                        {(availablePanels.length === 0 && !isLoadingQuests && userQuests.length > 0) && (
                            <p className="empty-list-message">All standard panels are active. Add project-specific panels below.</p>
                        )}
                         {(availablePanels.length === 0 && !isLoadingQuests && userQuests.length === 0) && (
                            <p className="empty-list-message">All standard panels are active. Create quests to add project panels.</p>
                        )}
                        <ul className="panel-list">
                            {availablePanels.map((panel) => (
                                <li key={panel.id} className="panel-item">
                                    <div className="panel-item-content">
                                        <span className="panel-name">{panel.name}</span>
                                        <span className="panel-type-label">
                                            ({panel.panel_type.replace(/_/g, ' ').toLowerCase()})
                                            {panel.isProjectPanel && panel.quest_name && ` - ${panel.quest_name}`}
                                        </span>
                                    </div>
                                    <div className="panel-item-actions">
                                        <button onClick={() => handleActivatePanel(panel.id)} title="Activate Panel" className="move-active-btn">⬅️ Activate</button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                        <div className="add-project-panel-section">
                            <label htmlFor="project-panel-quest">Add Project Panel:</label>
                            <QuestSelector
                                selectedQuestId={selectedQuestForNewPanel}
                                onQuestChange={setSelectedQuestForNewPanel}
                                disabled={isLoadingQuests || userQuests.length === 0}
                                isFilter={false} 
                                ariaLabel="Select Quest for Project Panel"
                            />
                            <button onClick={handleAddProjectPanelToAvailable} disabled={isLoadingQuests || !selectedQuestForNewPanel || userQuests.length === 0}>
                                + Add to Available
                            </button>
                            {isLoadingQuests && <p>Loading quests...</p>}
                             {userQuests.length === 0 && !isLoadingQuests && <p style={{fontSize: '0.8em', marginTop: '0.5em'}}>Create quests to add project panels.</p>}
                        </div>
                    </div>
                    
                    <div className="panel-column">
                        <h4>Active Dashboard Panels</h4>
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
                                            {panel.isProjectPanel && panel.quest_name && ` - ${panel.quest_name}`}
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