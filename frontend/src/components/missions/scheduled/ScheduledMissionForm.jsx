// frontend/src/components/missions/scheduled/ScheduledMissionForm.jsx
import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { UserContext } from '../../../contexts/UserContext';
import TagSelector from '../../tags/TagSelector';
import QuestSelector from '../../quests/QuestSelector';
import EnergySlider from '../../common/formElements/EnergySlider';
import PointsSelector from '../../common/formElements/PointsSelector';
import TimeOfDaySlider from '../../common/formElements/TimeOfDaySlider'; 
import DurationSelector from '../../common/formElements/DurationSelector'; 
import '../../../styles/scheduledmissions.css';

const API_SCHEDULED_MISSIONS_URL = `${import.meta.env.VITE_API_BASE_URL}/scheduled-missions`;
const API_POOL_MISSIONS_URL = `${import.meta.env.VITE_API_BASE_URL}/pool-missions`;
const API_QUESTS_URL = `${import.meta.env.VITE_API_BASE_URL}/quests`;

const formatDateForDateInput = (dateSource) => {
    if (!dateSource) return '';
    try {
        const date = new Date(dateSource);
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (e) { return ''; }
};

const formatTimeForTimeInput = (dateSource) => {
    if (!dateSource) return "12:00";
    try {
        const date = new Date(dateSource);
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    } catch (e) { return "12:00"; }
};

const calculateDurationInMinutes = (start, end) => {
    if (!start || !end) return 60;
    try {
        const startDate = new Date(start);
        const endDate = new Date(end);
        const diffMillis = endDate.getTime() - startDate.getTime();
        if (diffMillis <= 0) return 60;
        return Math.round(diffMillis / 60000);
    } catch (e) { return 60; }
};

function ScheduledMissionForm({ missionToEdit, slotInfo, onFormSubmit, onCancel, initialQuestId: directInitialQuestId = null }) {
    const { currentUser } = useContext(UserContext);
    const effectiveInitialQuestId = missionToEdit?.quest_id || slotInfo?.initialQuestId || directInitialQuestId;
    
    const defaultDate = formatDateForDateInput(slotInfo?.start || new Date());
    let initialUiIsAllDay = false;
    if (missionToEdit) {
        // If editing, reflect the stored is_all_day state primarily for the UI checkbox.
        // The "trampa" logic in handleSubmit will handle the time adjustment regardless of this initial UI state
        // if the user *intends* it as an all-day event via the checkbox.
        initialUiIsAllDay = missionToEdit.is_all_day || false; 
    } else if (slotInfo) {
        initialUiIsAllDay = slotInfo.allDay || (slotInfo.slots && slotInfo.slots.length === 1) || false;
    }

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        energyValue: 0,
        pointsValue: 1,
        selectedDate: defaultDate,
        startTime: initialUiIsAllDay ? "00:00" : "12:00", 
        durationMinutes: initialUiIsAllDay ? 24 * 60 : 60,
        formIsAllDay: initialUiIsAllDay, // UI state for the checkbox, determines if time/duration are hidden
        questId: effectiveInitialQuestId || null,
        selectedTagIds: [],
        status: 'PENDING'
    });

    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingDefaultQuest, setIsFetchingDefaultQuest] = useState(false);
    
    const isEditing = !!missionToEdit && !slotInfo?.convertingPoolMissionId;
    const isConverting = !!slotInfo?.convertingPoolMissionId && !!missionToEdit;

    useEffect(() => {
        const loadInitialData = async () => {
            let uiIsAllDayForEffect = false;
            let initialSelectedDate = formatDateForDateInput(slotInfo?.start || new Date());
            let initialStartTime = "12:00"; // Default for timed events
            let initialDurationMinutes = 60; // Default for timed events
            let currentQuestId = effectiveInitialQuestId || null;
            let initialEnergy = 0;
            let initialPoints = 1;
            let initialTags = [];
            let initialStatus = 'PENDING';
            let initialTitle = '';
            let initialDescription = '';

            if (isEditing) {
                // When editing, if the original mission.is_all_day was true, OR if it was false but
                // its timing effectively made it a 24h event (due to the trampa),
                // we want the UI checkbox (formIsAllDay) to be checked.
                // This requires careful consideration of how the "trampa" was stored.
                // For now, we'll base `uiIsAllDayForEffect` on `missionToEdit.is_all_day` primarily for UI.
                // The actual time/duration values will reflect what's stored or defaults for all-day.
                uiIsAllDayForEffect = missionToEdit.is_all_day || false; 
                // However, if the current "trampa" implies a 24h event and is_all_day was false,
                // it's better to rely on what the user would *see* as an all-day.
                // Let's assume that if it's a 24h event from 00:00 local (after trampa), it was meant as all-day UI.
                const storedStartTime = new Date(missionToEdit.start_datetime);
                const storedEndTime = new Date(missionToEdit.end_datetime);
                if (!missionToEdit.is_all_day && (storedEndTime.getTime() - storedStartTime.getTime()) === (24 * 60 * 60 * 1000) && storedStartTime.getUTCHours() === 22 && storedStartTime.getUTCMinutes() === 0) { // Check if it matches the "trampa" format for UTC+2
                     uiIsAllDayForEffect = true; // If it matches the trampa, treat as UI all-day
                }


                initialEnergy = missionToEdit.energy_value ?? 0;
                initialPoints = missionToEdit.points_value ?? 1;
                initialSelectedDate = formatDateForDateInput(missionToEdit.start_datetime);
                
                if (uiIsAllDayForEffect) { 
                    initialStartTime = "00:00"; 
                    initialDurationMinutes = 24 * 60; 
                } else {
                    initialStartTime = formatTimeForTimeInput(missionToEdit.start_datetime);
                    initialDurationMinutes = calculateDurationInMinutes(missionToEdit.start_datetime, missionToEdit.end_datetime);
                }
                initialTags = missionToEdit.tags ? missionToEdit.tags.map(tag => tag.id) : [];
                initialStatus = missionToEdit.status || 'PENDING';
                initialTitle = missionToEdit.title || '';
                initialDescription = missionToEdit.description || '';
                currentQuestId = missionToEdit.quest_id || currentQuestId;

            } else if (isConverting) {
                uiIsAllDayForEffect = slotInfo.allDay || false; 
                initialEnergy = missionToEdit.energy_value ?? 0;
                initialPoints = missionToEdit.points_value ?? 1;
                initialSelectedDate = formatDateForDateInput(slotInfo.start);
                if (uiIsAllDayForEffect) {
                    initialStartTime = "00:00";
                    initialDurationMinutes = 24 * 60;
                } else {
                    initialStartTime = formatTimeForTimeInput(slotInfo.start);
                    initialDurationMinutes = calculateDurationInMinutes(slotInfo.start, slotInfo.end);
                }
                initialTags = missionToEdit.tags ? missionToEdit.tags.map(tag => tag.id) : [];
                initialTitle = missionToEdit.title || '';
                initialDescription = missionToEdit.description || '';
                currentQuestId = missionToEdit.quest_id || currentQuestId;

            } else if (slotInfo) { 
                uiIsAllDayForEffect = slotInfo.allDay || (slotInfo.slots && slotInfo.slots.length === 1);
                initialSelectedDate = formatDateForDateInput(slotInfo.start);
                 if (uiIsAllDayForEffect) {
                    initialStartTime = "00:00";
                    initialDurationMinutes = 24 * 60;
                } else {
                    initialStartTime = formatTimeForTimeInput(slotInfo.start);
                    initialDurationMinutes = calculateDurationInMinutes(slotInfo.start, slotInfo.end);
                }
                if (!currentQuestId) {
                    setIsFetchingDefaultQuest(true);
                    const token = localStorage.getItem('authToken');
                     try {
                        const response = await axios.get(API_QUESTS_URL, { headers: { 'Authorization': `Bearer ${token}` } });
                        const quests = response.data || [];
                        const defaultQuest = quests.find(q => q.is_default_quest);
                        currentQuestId = defaultQuest?.id || (quests.length > 0 ? quests[0].id : null);
                    } catch (err) { /* QuestId remains as is */ }
                    finally { setIsFetchingDefaultQuest(false); }
                }
            } else { 
                 uiIsAllDayForEffect = false; 
                 initialStartTime = "12:00";
                 initialDurationMinutes = 60;
                 if (!currentQuestId) {
                    setIsFetchingDefaultQuest(true);
                    const token = localStorage.getItem('authToken');
                    try {
                        const response = await axios.get(API_QUESTS_URL, { headers: { 'Authorization': `Bearer ${token}` } });
                        const quests = response.data || [];
                        const defaultQuest = quests.find(q => q.is_default_quest);
                        currentQuestId = defaultQuest?.id || (quests.length > 0 ? quests[0].id : null);
                    } catch (err) { /* QuestId remains as is */ }
                    finally { setIsFetchingDefaultQuest(false); }
                }
            }
            
            setFormData(prev => ({
                ...prev,
                title: initialTitle,
                description: initialDescription,
                energyValue: initialEnergy,
                pointsValue: initialPoints,
                selectedDate: initialSelectedDate,
                startTime: initialStartTime,
                durationMinutes: initialDurationMinutes,
                formIsAllDay: uiIsAllDayForEffect, 
                questId: currentQuestId,
                selectedTagIds: initialTags,
                status: initialStatus
            }));
        };
        loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [missionToEdit, slotInfo, isEditing, isConverting, effectiveInitialQuestId, currentUser]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setError('');
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFormIsAllDayChange = (e) => {
        const isChecked = e.target.checked;
        setError('');
        setFormData(prev => ({
            ...prev,
            formIsAllDay: isChecked,
            startTime: isChecked ? "00:00" : (prev.startTime === "00:00" && prev.durationMinutes === 1440 ? "12:00" : prev.startTime),
            durationMinutes: isChecked ? 24 * 60 : (prev.durationMinutes === 1440 && prev.startTime === "00:00" ? 60 : prev.durationMinutes)
        }));
    };
    
    const handleEnergyChange = (newEnergyValue) => setFormData(prev => ({ ...prev, energyValue: newEnergyValue }));
    const handlePointsChange = (newPointsValue) => setFormData(prev => ({ ...prev, pointsValue: newPointsValue }));
    const handleQuestChange = (newQuestId) => setFormData(prev => ({ ...prev, questId: newQuestId || null }));
    const handleTagsChange = (newTagIds) => setFormData(prev => ({ ...prev, selectedTagIds: newTagIds }));
    const handleDateChange = (e) => {
        setError('');
        setFormData(prev => ({ ...prev, selectedDate: e.target.value }));
    };
    const handleStartTimeChange = (newTime) => {
        setError('');
        setFormData(prev => ({ ...prev, startTime: newTime }));
    };
    const handleDurationChange = (newDuration) => {
        setError('');
        setFormData(prev => ({ ...prev, durationMinutes: newDuration }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        if (!formData.title.trim()) {
            setError('Mission title is required.'); setIsLoading(false); return;
        }
        if (!formData.selectedDate) { 
            setError('Date is required.'); setIsLoading(false); return;
        }
        
        let finalStartDatetimeISO;
        let finalEndDatetimeISO;
        // Per the "trampa" agreed upon for presentation, is_all_day is always sent as false.
        // The UI checkbox `formIsAllDay` determines if we apply the 24h + time shift logic.
        const payloadIsAllDayFlag = false; 

        const [year, month, day] = formData.selectedDate.split('-').map(Number);

        if (formData.formIsAllDay) { 
            // *** START OF "SUPER TRAMPA" LOGIC ***
            // This logic adjusts the UTC time sent to the backend so that
            // when displayed in a UTC+2 timezone (like CEST), it appears as 00:00 local time.
            // It achieves this by making the UTC start time 2 hours earlier than 00:00 UTC of the selected day.
            
            // 1. Get 00:00 UTC of the selected day.
            const intendedUtcStartForDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
            
            // 2. Subtract 2 hours (for UTC+2 offset) to get the "hacked" UTC start time.
            //    This will be (Day-1)T22:00:00Z.
            const hackedUtcStart = new Date(intendedUtcStartForDay.getTime() - (2 * 60 * 60 * 1000)); 
            finalStartDatetimeISO = hackedUtcStart.toISOString();

            // 3. The end time will be 24 hours after this "hacked" UTC start.
            //    This will be (Day)T22:00:00Z.
            const hackedUtcEnd = new Date(hackedUtcStart.getTime() + (24 * 60 * 60 * 1000)); 
            finalEndDatetimeISO = hackedUtcEnd.toISOString();
            // *** END OF "SUPER TRAMPA" LOGIC ***
            
        } else { 
            if (!formData.startTime) { setError('Start time is required for timed events.'); setIsLoading(false); return;}
            if (formData.durationMinutes <= 0) { setError('Duration must be positive for timed events.'); setIsLoading(false); return; }

            const [hours, minutes] = formData.startTime.split(':').map(Number);
            // Create a Date object from local parts, then convert to ISOString (which is UTC)
            const localStartDateTime = new Date(year, month - 1, day, hours, minutes, 0);
            finalStartDatetimeISO = localStartDateTime.toISOString();
            
            const localEndDateTime = new Date(localStartDateTime.getTime() + formData.durationMinutes * 60000);
            finalEndDatetimeISO = localEndDateTime.toISOString();

            if (new Date(finalEndDatetimeISO) <= new Date(finalStartDatetimeISO)) {
                setError('End datetime must be after start datetime for timed events.'); setIsLoading(false); return;
            }
        }

        const missionDataPayload = {
            title: formData.title.trim(),
            description: formData.description.trim() || null,
            energy_value: formData.energyValue,
            points_value: formData.pointsValue,
            start_datetime: finalStartDatetimeISO,
            end_datetime: finalEndDatetimeISO, 
            is_all_day: payloadIsAllDayFlag, // Always false as per the "trampa"
            quest_id: formData.questId,
            tag_ids: formData.selectedTagIds,
            status: isEditing ? formData.status : 'PENDING',
        };
        
        const token = localStorage.getItem('authToken');
        const config = { headers: { 'Authorization': `Bearer ${token}` } };

        try {
            let response;
            if (isEditing) {
                response = await axios.put(`${API_SCHEDULED_MISSIONS_URL}/${missionToEdit.id}`, missionDataPayload, config);
                onFormSubmit(response.data);
            } else { 
                response = await axios.post(API_SCHEDULED_MISSIONS_URL, missionDataPayload, config);
                if (isConverting && slotInfo.convertingPoolMissionId) { 
                    await axios.delete(`${API_POOL_MISSIONS_URL}/${slotInfo.convertingPoolMissionId}`, config);
                    onFormSubmit(response.data, true); 
                } else {
                    onFormSubmit(response.data);
                }
            }
        } catch (err) {
            const errorData = err.response?.data;
            let em = `Failed to ${isEditing ? 'update' : 'create'} Scheduled Mission.`;
            if (errorData?.errors && typeof errorData.errors === 'object') {
                 em = Object.entries(errorData.errors)
                    .map(([key, val]) => `${key.replace("scheduled_missions.", "")}: ${Array.isArray(val) ? val.join(', ') : val}`)
                    .join('; ');
            } else if (errorData?.error) {
                em = errorData.error;
            }
            setError(em);
        } finally {
            setIsLoading(false);
        }
    };
    
    const formDisabled = isLoading || isFetchingDefaultQuest;

    return (
        <div className="scheduled-mission-form-container">
            {error && <p className="error-message">{error}</p>}
            <form onSubmit={handleSubmit} className="scheduled-mission-form">
                <div className="form-group">
                    <label htmlFor="sm-title">Title:</label>
                    <input type="text" id="sm-title" name="title" value={formData.title} onChange={handleChange} required disabled={formDisabled} />
                </div>
                 <div className="form-group"> 
                    <label htmlFor="sm-formIsAllDay-ui" className="checkbox-label" style={{ display: 'flex', alignItems: 'center', fontWeight: 'normal', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            id="sm-formIsAllDay-ui"
                            name="formIsAllDay" 
                            checked={formData.formIsAllDay}
                            onChange={handleFormIsAllDayChange} 
                            disabled={formDisabled}
                            style={{ width: 'auto', marginRight: '0.5rem', cursor: 'pointer' }}
                        />
                        Full Day Event
                    </label>
                </div>
                
                <div className="form-group">
                    <label htmlFor="sm-selected-date">Date:</label>
                    <input
                        type="date"
                        id="sm-selected-date"
                        name="selectedDate"
                        value={formData.selectedDate}
                        onChange={handleDateChange}
                        required
                        disabled={formDisabled}
                        style={{width: '100%', padding: '0.75rem', boxSizing: 'border-box'}}
                    />
                </div>

                {/* Time and Duration selectors are hidden if formIsAllDay is checked, 
                    as their values are then programmatically set for the 24h span */}
                {!formData.formIsAllDay && ( 
                    <>
                        <TimeOfDaySlider 
                            value={formData.startTime}
                            onChange={handleStartTimeChange}
                            disabled={formDisabled}
                        />
                        <DurationSelector
                            value={formData.durationMinutes}
                            onChange={handleDurationChange}
                            disabled={formDisabled}
                        />
                    </>
                )}

                <div className="form-group">
                    <label htmlFor="sm-description">Description (Optional):</label>
                    <textarea id="sm-description" name="description" value={formData.description} onChange={handleChange} rows="3" disabled={formDisabled} />
                </div>
                
                <EnergySlider 
                    value={formData.energyValue}
                    onChange={handleEnergyChange}
                    disabled={formDisabled}
                />
                <PointsSelector
                    value={formData.pointsValue}
                    onChange={handlePointsChange}
                    disabled={formDisabled}
                />

                <div className="form-group">
                    <label htmlFor="sm-quest">Associate with Quest:</label>
                    <QuestSelector selectedQuestId={formData.questId} onQuestChange={handleQuestChange} disabled={formDisabled} />
                </div>
                <TagSelector selectedTagIds={formData.selectedTagIds} onSelectedTagsChange={handleTagsChange} />
                
                <div className="form-actions">
                    <button type="button" onClick={onCancel} className="cancel-btn" disabled={isLoading}>Cancel</button>
                    <button type="submit" className="submit-btn" disabled={isLoading}>
                        {isLoading ? 'Saving...' : (isEditing ? 'Save Changes' : (isConverting ? 'Convert & Save' : 'Create Mission'))}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default ScheduledMissionForm;