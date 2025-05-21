// frontend/src/components/missions/scheduled/ScheduledMissionForm.jsx
import React, { useState, useEffect, useCallback, useContext } from 'react';
import axios from 'axios';
import { UserContext } from '../../../contexts/UserContext';
import TagSelector from '../../tags/TagSelector';
import QuestSelector from '../../quests/QuestSelector';
import '../../../styles/scheduledmissions.css';

const API_SCHEDULED_MISSIONS_URL = `${import.meta.env.VITE_API_BASE_URL}/scheduled-missions`;
const API_QUESTS_URL = `${import.meta.env.VITE_API_BASE_URL}/quests`;

const formatDateTimeForInput = (isoString) => {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        const offset = date.getTimezoneOffset() * 60000;
        const localDate = new Date(date.getTime() - offset);
        return localDate.toISOString().slice(0, 16);
    } catch (e) { return ''; }
};

const formatInputDateTimeToISO = (inputDateTimeStr) => {
    if (!inputDateTimeStr) return null;
    try {
        const localDate = new Date(inputDateTimeStr);
        return localDate.toISOString();
    } catch (e) { return null; }
};

function ScheduledMissionForm({ missionToEdit, onFormSubmit, onCancel }) {
    const { currentUser } = useContext(UserContext); // Para obtener el ID del usuario si es necesario para el default quest
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        energyValue: 0,
        pointsValue: 0,
        startDatetime: '',
        endDatetime: '',
        questId: null,
        selectedTagIds: [],
        status: 'PENDING' // Estado por defecto para nuevas misiones
    });

    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingDefaultQuest, setIsFetchingDefaultQuest] = useState(false);
    const isEditing = !!missionToEdit;

    useEffect(() => {
        const loadInitialData = async () => {
            if (isEditing && missionToEdit) {
                setFormData({
                    title: missionToEdit.title || '',
                    description: missionToEdit.description || '',
                    energyValue: missionToEdit.energy_value || 0,
                    pointsValue: missionToEdit.points_value || 0,
                    startDatetime: formatDateTimeForInput(missionToEdit.start_datetime),
                    endDatetime: formatDateTimeForInput(missionToEdit.end_datetime),
                    questId: missionToEdit.quest_id || null,
                    selectedTagIds: missionToEdit.tags ? missionToEdit.tags.map(tag => tag.id) : [],
                    status: missionToEdit.status || 'PENDING'
                });
            } else if (!isEditing) { // Creando nuevo
                setIsFetchingDefaultQuest(true);
                const token = localStorage.getItem('authToken');
                try {
                    const response = await axios.get(API_QUESTS_URL, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const quests = response.data || [];
                    const defaultQuest = quests.find(q => q.is_default_quest);
                    
                    const now = new Date();
                    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

                    setFormData(prev => ({
                        ...prev,
                        title: '', description: '', energyValue: 10, pointsValue: 5,
                        startDatetime: formatDateTimeForInput(now.toISOString()),
                        endDatetime: formatDateTimeForInput(oneHourLater.toISOString()),
                        selectedTagIds: [], status: 'PENDING',
                        questId: defaultQuest ? defaultQuest.id : (quests.length > 0 ? quests[0].id : null)
                    }));
                } catch (err) {
                    console.error("ScheduledMissionForm: Failed to fetch default quest:", err);
                    setFormData(prev => ({ ...prev, questId: null }));
                } finally {
                    setIsFetchingDefaultQuest(false);
                }
            }
        };
        loadInitialData();
    }, [missionToEdit, isEditing]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleQuestChange = (newQuestId) => {
        setFormData(prev => ({ ...prev, questId: newQuestId || null }));
    };

    const handleTagsChange = (newTagIds) => {
        setFormData(prev => ({ ...prev, selectedTagIds: newTagIds }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        if (!formData.title.trim()) {
            setError('Mission title is required.'); setIsLoading(false); return;
        }
        if (!formData.startDatetime || !formData.endDatetime) {
            setError('Start and End date/times are required.'); setIsLoading(false); return;
        }

        const finalStartDatetimeISO = formatInputDateTimeToISO(formData.startDatetime);
        const finalEndDatetimeISO = formatInputDateTimeToISO(formData.endDatetime);

        if (!finalStartDatetimeISO || !finalEndDatetimeISO) {
            setError('Invalid date/time format entered.'); setIsLoading(false); return;
        }
        
        if (new Date(finalEndDatetimeISO) <= new Date(finalStartDatetimeISO)) {
            setError('End datetime must be after start datetime.'); setIsLoading(false); return;
        }

        const missionDataPayload = {
            title: formData.title.trim(),
            description: formData.description.trim() || null,
            energy_value: parseInt(formData.energyValue, 10),
            points_value: parseInt(formData.pointsValue, 10),
            start_datetime: finalStartDatetimeISO,
            end_datetime: finalEndDatetimeISO,
            quest_id: formData.questId,
            tag_ids: formData.selectedTagIds,
            status: isEditing ? formData.status : 'PENDING', // Enviar status actual si se edita
        };
        
        const token = localStorage.getItem('authToken');
        const config = { headers: { 'Authorization': `Bearer ${token}` } };

        try {
            if (isEditing) {
                await axios.put(`${API_SCHEDULED_MISSIONS_URL}/${missionToEdit.id}`, missionDataPayload, config);
            } else {
                await axios.post(API_SCHEDULED_MISSIONS_URL, missionDataPayload, config);
            }
            onFormSubmit(); // Esta función debería invocar refreshUserStatsAndEnergy del contexto
        } catch (err) {
            console.error("Failed to save scheduled mission:", err.response?.data || err.message);
            const errorData = err.response?.data;
            let errorMessageText = `Failed to ${isEditing ? 'update' : 'create'} scheduled mission.`;
            if (errorData?.errors && typeof errorData.errors === 'object') {
                 const firstErrorKey = Object.keys(errorData.errors)[0];
                 const messages = errorData.errors[firstErrorKey];
                 errorMessageText = `${firstErrorKey.replace(/_/g, ' ')}: ${Array.isArray(messages) ? messages.join(', ') : messages}`;
            } else if (errorData?.error) {
                errorMessageText = errorData.error;
            }
            setError(errorMessageText);
        } finally {
            setIsLoading(false);
        }
    };
    
    const formDisabled = isLoading || isFetchingDefaultQuest;

    return (
        <div className="scheduled-mission-form-container">
            <h3>{isEditing ? 'Edit Scheduled Mission' : 'Create New Scheduled Mission'}</h3>
            {error && <p className="error-message">{error}</p>}
            <form onSubmit={handleSubmit} className="scheduled-mission-form">
                <div className="form-group">
                    <label htmlFor="sm-title">Title:</label>
                    <input type="text" id="sm-title" name="title" value={formData.title} onChange={handleChange} required disabled={formDisabled} />
                </div>
                <div className="form-group">
                    <label htmlFor="sm-description">Description (Optional):</label>
                    <textarea id="sm-description" name="description" value={formData.description} onChange={handleChange} rows="3" disabled={formDisabled} />
                </div>
                <div className="form-group-row">
                    <div className="form-group">
                        <label htmlFor="sm-start-datetime">Start Date & Time:</label>
                        <input type="datetime-local" id="sm-start-datetime" name="startDatetime" value={formData.startDatetime} onChange={handleChange} required disabled={formDisabled} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="sm-end-datetime">End Date & Time:</label>
                        <input type="datetime-local" id="sm-end-datetime" name="endDatetime" value={formData.endDatetime} onChange={handleChange} required disabled={formDisabled} />
                    </div>
                </div>
                 <div className="form-group-row">
                    <div className="form-group">
                        <label htmlFor="sm-energy">Energy Value:</label>
                        <input type="number" id="sm-energy" name="energyValue" value={formData.energyValue} onChange={handleChange} disabled={formDisabled} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="sm-points">Points Value:</label>
                        <input type="number" id="sm-points" name="pointsValue" value={formData.pointsValue} min="0" onChange={handleChange} disabled={formDisabled} />
                    </div>
                </div>
                <div className="form-group">
                    <label htmlFor="sm-quest">Associate with Quest:</label>
                    <QuestSelector
                        selectedQuestId={formData.questId}
                        onQuestChange={handleQuestChange}
                        disabled={formDisabled}
                        isFilter={false}
                    />
                </div>
                <TagSelector
                    selectedTagIds={formData.selectedTagIds}
                    onSelectedTagsChange={handleTagsChange}
                    // disabled={formDisabled} // Si TagSelector soporta disabled
                />
                {/* El campo Status no se edita directamente en el formulario principal, sino con acciones separadas */}
                <div className="form-actions">
                    <button type="button" onClick={onCancel} className="cancel-btn" disabled={isLoading}>Cancel</button>
                    <button type="submit" className="submit-btn" disabled={isLoading}>
                        {isLoading ? (isEditing ? 'Saving...' : 'Creating...') : (isEditing ? 'Save Changes' : 'Create Mission')}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default ScheduledMissionForm;