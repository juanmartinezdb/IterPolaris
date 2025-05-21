// frontend/src/components/missions/scheduled/ScheduledMissionForm.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import TagSelector from '../../tags/TagSelector';
import QuestSelector from '../../quests/QuestSelector';
import '../../../styles/scheduledmissions.css'; // We'll create this CSS file

const API_SCHEDULED_MISSIONS_URL = `${import.meta.env.VITE_API_BASE_URL}/scheduled-missions`;
const API_QUESTS_URL = `${import.meta.env.VITE_API_BASE_URL}/quests`;

// Helper to format datetime for <input type="datetime-local">
// It needs YYYY-MM-DDTHH:mm
const formatDateTimeForInput = (isoString) => {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        // Adjust for local timezone for display in datetime-local input
        const offset = date.getTimezoneOffset() * 60000;
        const localDate = new Date(date.getTime() - offset);
        return localDate.toISOString().slice(0, 16);
    } catch (e) {
        console.error("Error formatting date for input:", e);
        return '';
    }
};

// Helper to convert datetime-local input value to UTC ISO string for backend
const formatInputDateTimeToISO = (inputDateTimeStr) => {
    if (!inputDateTimeStr) return null;
    try {
        // Input is already in local time as per HTML spec for datetime-local
        const localDate = new Date(inputDateTimeStr);
        return localDate.toISOString(); // Converts to UTC
    } catch (e) {
        console.error("Error formatting input date to ISO:", e);
        return null;
    }
};


function ScheduledMissionForm({ missionToEdit, onFormSubmit, onCancel }) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [energyValue, setEnergyValue] = useState(0);
    const [pointsValue, setPointsValue] = useState(0);
    const [startDatetime, setStartDatetime] = useState(''); // Stored as string for input field
    const [endDatetime, setEndDatetime] = useState('');     // Stored as string for input field
    const [questId, setQuestId] = useState(null);
    const [selectedTagIds, setSelectedTagIds] = useState([]);
    // Status is typically handled by a separate endpoint or default on creation

    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingDefaultQuest, setIsFetchingDefaultQuest] = useState(false);
    const isEditing = !!missionToEdit;

    const fetchAndSetDefaultQuest = useCallback(async () => {
        if (!isEditing && questId === null) {
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
                }
            } catch (err) {
                console.error("Failed to fetch default quest for form:", err);
            } finally {
                setIsFetchingDefaultQuest(false);
            }
        }
    }, [isEditing, questId]);

    useEffect(() => {
        fetchAndSetDefaultQuest();
    }, [fetchAndSetDefaultQuest]);

    useEffect(() => {
        if (isEditing && missionToEdit) {
            setTitle(missionToEdit.title || '');
            setDescription(missionToEdit.description || '');
            setEnergyValue(missionToEdit.energy_value || 0);
            setPointsValue(missionToEdit.points_value || 0);
            setStartDatetime(formatDateTimeForInput(missionToEdit.start_datetime));
            setEndDatetime(formatDateTimeForInput(missionToEdit.end_datetime));
            setQuestId(missionToEdit.quest_id || null);
            setSelectedTagIds(missionToEdit.tags ? missionToEdit.tags.map(tag => tag.id) : []);
        } else {
            setTitle('');
            setDescription('');
            setEnergyValue(10);
            setPointsValue(5);
            const now = new Date();
            const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
            setStartDatetime(formatDateTimeForInput(now.toISOString()));
            setEndDatetime(formatDateTimeForInput(oneHourLater.toISOString()));
            // questId will be set by fetchAndSetDefaultQuest
            setSelectedTagIds([]);
        }
    }, [missionToEdit, isEditing, fetchAndSetDefaultQuest]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        if (!title.trim()) {
            setError('Mission title is required.');
            setIsLoading(false);
            return;
        }
        if (!startDatetime || !endDatetime) {
            setError('Start and End date/times are required.');
            setIsLoading(false);
            return;
        }

        const finalStartDatetimeISO = formatInputDateTimeToISO(startDatetime);
        const finalEndDatetimeISO = formatInputDateTimeToISO(endDatetime);

        if (!finalStartDatetimeISO || !finalEndDatetimeISO) {
            setError('Invalid date/time format entered.');
            setIsLoading(false);
            return;
        }
        
        if (new Date(finalEndDatetimeISO) <= new Date(finalStartDatetimeISO)) {
            setError('End datetime must be after start datetime.');
            setIsLoading(false);
            return;
        }

        const missionData = {
            title: title.trim(),
            description: description.trim() || null,
            energy_value: parseInt(energyValue, 10),
            points_value: parseInt(pointsValue, 10),
            start_datetime: finalStartDatetimeISO,
            end_datetime: finalEndDatetimeISO,
            quest_id: questId,
            tag_ids: selectedTagIds,
            // Status is defaulted to 'PENDING' by backend on creation
        };
        if (isEditing) { // If editing, send the current status to avoid unintended changes
            missionData.status = missionToEdit.status;
        }

        const token = localStorage.getItem('authToken');
        const config = { headers: { 'Authorization': `Bearer ${token}` } };

        try {
            if (isEditing) {
                await axios.put(`${API_SCHEDULED_MISSIONS_URL}/${missionToEdit.id}`, missionData, config);
            } else {
                await axios.post(API_SCHEDULED_MISSIONS_URL, missionData, config);
            }
            onFormSubmit();
        } catch (err) {
            console.error("Failed to save scheduled mission:", err.response?.data || err.message);
            const errorData = err.response?.data;
            let errorMessage = `Failed to ${isEditing ? 'update' : 'create'} scheduled mission.`;
            if (errorData) {
                if (errorData.errors && typeof errorData.errors === 'object') {
                     const firstErrorKey = Object.keys(errorData.errors)[0];
                     const messages = errorData.errors[firstErrorKey];
                     errorMessage = `${firstErrorKey.replace('_', ' ')}: ${Array.isArray(messages) ? messages.join(', ') : messages}`;
                } else if (typeof errorData.error === 'string') {
                    errorMessage = errorData.error;
                } else if (typeof errorData.message === 'string') {
                    errorMessage = errorData.message;
                }
            }
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="scheduled-mission-form-container">
            <h3>{isEditing ? 'Edit Scheduled Mission' : 'Create New Scheduled Mission'}</h3>
            {error && <p className="error-message">{error}</p>}
            <form onSubmit={handleSubmit} className="scheduled-mission-form">
                <div className="form-group">
                    <label htmlFor="sm-title">Title:</label>
                    <input type="text" id="sm-title" value={title} onChange={(e) => setTitle(e.target.value)} required disabled={isLoading || isFetchingDefaultQuest} />
                </div>
                <div className="form-group">
                    <label htmlFor="sm-description">Description (Optional):</label>
                    <textarea id="sm-description" value={description} onChange={(e) => setDescription(e.target.value)} rows="3" disabled={isLoading || isFetchingDefaultQuest} />
                </div>
                <div className="form-group-row">
                    <div className="form-group">
                        <label htmlFor="sm-start-datetime">Start Date & Time:</label>
                        <input type="datetime-local" id="sm-start-datetime" value={startDatetime} onChange={(e) => setStartDatetime(e.target.value)} required disabled={isLoading || isFetchingDefaultQuest} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="sm-end-datetime">End Date & Time:</label>
                        <input type="datetime-local" id="sm-end-datetime" value={endDatetime} onChange={(e) => setEndDatetime(e.target.value)} required disabled={isLoading || isFetchingDefaultQuest} />
                    </div>
                </div>
                 <div className="form-group-row">
                    <div className="form-group">
                        <label htmlFor="sm-energy">Energy Value:</label>
                        <input type="number" id="sm-energy" value={energyValue} onChange={(e) => setEnergyValue(parseInt(e.target.value, 10))} disabled={isLoading || isFetchingDefaultQuest} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="sm-points">Points Value:</label>
                        <input type="number" id="sm-points" value={pointsValue} min="0" onChange={(e) => setPointsValue(parseInt(e.target.value, 10))} disabled={isLoading || isFetchingDefaultQuest} />
                    </div>
                </div>
                <div className="form-group">
                    <label htmlFor="sm-quest">Associate with Quest:</label>
                    <QuestSelector
                        selectedQuestId={questId}
                        onQuestChange={(newQuestId) => setQuestId(newQuestId)}
                        disabled={isLoading || isFetchingDefaultQuest}
                        isFilter={false}
                    />
                </div>
                <TagSelector
                    selectedTagIds={selectedTagIds}
                    onSelectedTagsChange={setSelectedTagIds}
                />
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

export default ScheduledMissionForm;