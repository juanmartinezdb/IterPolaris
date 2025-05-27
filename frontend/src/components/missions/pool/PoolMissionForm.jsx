// frontend/src/components/missions/pool/PoolMissionForm.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import TagSelector from '../../tags/TagSelector';
import QuestSelector from '../../quests/QuestSelector';
import EnergySlider from '../../common/formElements/EnergySlider'; // Import new component
import PointsSelector from '../../common/formElements/PointsSelector'; // Import new component
import '../../../styles/poolmissions.css'; 

const API_POOL_MISSIONS_URL = `${import.meta.env.VITE_API_BASE_URL}/pool-missions`;
const API_QUESTS_URL = `${import.meta.env.VITE_API_BASE_URL}/quests`;

function PoolMissionForm({ missionToEdit, onFormSubmit, onCancel, initialQuestId = null }) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    // Default energyValue to 0 for the slider
    const [energyValue, setEnergyValue] = useState(0); 
    // Default pointsValue to one of the options, e.g., 1 or allow null then select
    const [pointsValue, setPointsValue] = useState(1); 
    const [questId, setQuestId] = useState(initialQuestId);
    const [selectedTagIds, setSelectedTagIds] = useState([]);
    const [focusStatus, setFocusStatus] = useState('ACTIVE');

    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingDefaultQuest, setIsFetchingDefaultQuest] = useState(false);
    const isEditing = !!missionToEdit;

    const fetchAndSetDefaultQuest = useCallback(async () => {
        if (!isEditing && !initialQuestId && questId === null) { 
            setIsFetchingDefaultQuest(true);
            const token = localStorage.getItem('authToken');
            try {
                const response = await axios.get(API_QUESTS_URL, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const quests = response.data || [];
                const defaultQuest = quests.find(q => q.is_default_quest);
                if (defaultQuest) {
                    setQuestId(defaultQuest.id);
                } else if (quests.length > 0) {
                    setQuestId(quests[0].id); // Fallback to first quest if no default
                }
            } catch (err) {
                console.error("Failed to fetch default quest for PoolMissionForm:", err);
            } finally {
                setIsFetchingDefaultQuest(false);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEditing, initialQuestId]); 

    useEffect(() => {
        if (!isEditing && initialQuestId) {
            setQuestId(initialQuestId);
        } else if (!isEditing && !initialQuestId) {
            fetchAndSetDefaultQuest();
        }
    }, [isEditing, initialQuestId, fetchAndSetDefaultQuest]);

    useEffect(() => {
        if (isEditing && missionToEdit) {
            setTitle(missionToEdit.title || '');
            setDescription(missionToEdit.description || '');
            setEnergyValue(missionToEdit.energy_value || 0); // Default to 0 if undefined
            setPointsValue(missionToEdit.points_value || 1); // Default to 1 if undefined
            setQuestId(missionToEdit.quest_id || initialQuestId || null);
            setSelectedTagIds(missionToEdit.tags ? missionToEdit.tags.map(tag => tag.id) : []);
            setFocusStatus(missionToEdit.focus_status || 'ACTIVE');
        } else if (!isEditing) { 
            setTitle('');
            setDescription('');
            setEnergyValue(0); // Default to 0 for new missions
            setPointsValue(1);  // Default to 1 point for new missions
            setSelectedTagIds([]);
            setFocusStatus('ACTIVE');
            // QuestId is handled by the other useEffect or remains initialQuestId
        }
    }, [missionToEdit, isEditing, initialQuestId]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        if (!title.trim()) {
            setError('Mission title is required.');
            setIsLoading(false);
            return;
        }
        
        const missionData = {
            title: title.trim(),
            description: description.trim() || null,
            energy_value: energyValue, // Direct value from state
            points_value: pointsValue, // Direct value from state
            quest_id: questId, 
            tag_ids: selectedTagIds,
            focus_status: focusStatus,
        };
        
        const token = localStorage.getItem('authToken');
        const config = { headers: { 'Authorization': `Bearer ${token}` } };

        try {
            let response;
            if (isEditing) {
                response = await axios.put(`${API_POOL_MISSIONS_URL}/${missionToEdit.id}`, missionData, config);
            } else {
                response = await axios.post(API_POOL_MISSIONS_URL, missionData, config);
            }
            onFormSubmit(response.data); 
        } catch (err) {
            console.error("Failed to save pool mission:", err.response?.data || err.message);
            const errorData = err.response?.data;
            let errorMessage = `Failed to ${isEditing ? 'update' : 'create'} pool mission.`;
            if (errorData) {
                if (typeof errorData.error === 'string') {
                    errorMessage = errorData.error;
                } else if (errorData.errors && typeof errorData.errors === 'object') {
                    const firstErrorKey = Object.keys(errorData.errors)[0];
                    errorMessage = `${firstErrorKey}: ${errorData.errors[firstErrorKey]}`;
                } else if (typeof errorData.message === 'string') {
                    errorMessage = errorData.message;
                }
            }
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };
    
    const formDisabled = isLoading || isFetchingDefaultQuest;

    return (
        <div className="pool-mission-form-container">
            <h3>{isEditing ? 'Edit Pool Mission' : 'Create New Pool Mission'}</h3>
            {error && <p className="error-message">{error}</p>}
            <form onSubmit={handleSubmit} className="pool-mission-form">
                <div className="form-group">
                    <label htmlFor="pm-title">Title:</label>
                    <input type="text" id="pm-title" value={title} onChange={(e) => setTitle(e.target.value)} required disabled={formDisabled} />
                </div>
                <div className="form-group">
                    <label htmlFor="pm-description">Description (Optional):</label>
                    <textarea id="pm-description" value={description} onChange={(e) => setDescription(e.target.value)} rows="3" disabled={formDisabled} />
                </div>
                
                {/* New Energy Slider */}
                <EnergySlider 
                    value={energyValue}
                    onChange={setEnergyValue}
                    disabled={formDisabled}
                />

                {/* New Points Selector */}
                <PointsSelector
                    value={pointsValue}
                    onChange={setPointsValue}
                    disabled={formDisabled}
                />
                
                 <div className="form-group">
                    <label htmlFor="pm-quest">Associate with Quest:</label>
                    <QuestSelector 
                        selectedQuestId={questId} 
                        onQuestChange={(newQuestId) => setQuestId(newQuestId)}
                        disabled={formDisabled}
                        isFilter={false} 
                    />
                </div>
                <TagSelector 
                    selectedTagIds={selectedTagIds}
                    onSelectedTagsChange={setSelectedTagIds}
                    // disabled={formDisabled} // TagSelector does not currently accept disabled
                />
                <div className="form-group">
                    <label htmlFor="pm-focus">Focus Status:</label>
                    <select id="pm-focus" value={focusStatus} onChange={(e) => setFocusStatus(e.target.value)} disabled={formDisabled}>
                        <option value="ACTIVE">Active (Ready to do)</option>
                        <option value="DEFERRED">Deferred (Maybe later)</option>
                    </select>
                </div>
                <div className="form-actions">
                    <button type="button" onClick={onCancel} className="cancel-btn" disabled={isLoading || isFetchingDefaultQuest}>Cancel</button>
                    <button type="submit" className="submit-btn" disabled={isLoading || isFetchingDefaultQuest}>
                        {isLoading ? (isEditing ? 'Saving...' : 'Creating...') : (isEditing ? 'Save Changes' : 'Create Mission')}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default PoolMissionForm;