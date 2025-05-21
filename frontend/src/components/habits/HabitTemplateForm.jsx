// frontend/src/components/habits/HabitTemplateForm.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import QuestSelector from '../quests/QuestSelector';
import TagSelector from '../tags/TagSelector';
import '../../styles/habittemplates.css';

const API_HABIT_TEMPLATES_URL = `${import.meta.env.VITE_API_BASE_URL}/habit-templates`;
const API_QUESTS_URL = `${import.meta.env.VITE_API_BASE_URL}/quests`;

const formatDateForInput = (isoOrDateString) => {
    if (!isoOrDateString) return '';
    try {
        if (typeof isoOrDateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(isoOrDateString)) {
            return isoOrDateString;
        }
        const date = new Date(isoOrDateString);
        return date.toISOString().split('T')[0];
    } catch (e) {
        console.error("Error formatting date for input:", e);
        return '';
    }
};

const formatTimeForInput = (isoOrTimeString) => {
    if (!isoOrTimeString) return '';
    try {
        if (typeof isoOrTimeString === 'string' && (isoOrTimeString.match(/^\d{2}:\d{2}(:\d{2})?$/)) ) {
             return isoOrTimeString.substring(0,5);
        }
        const date = new Date(`1970-01-01T${isoOrTimeString}`);
        if (isNaN(date.getTime())) throw new Error("Invalid time string");
        
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    } catch (e) {
        console.error("Error formatting time for input:", e, "Input was:", isoOrTimeString);
        return '';
    }
};

const DAYS_OF_WEEK = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
const RECURRENCE_TYPE_DAILY = 'DAILY'; // Solo tenemos 'DAILY' como tipo especial ahora

function HabitTemplateForm({ templateToEdit, onFormSubmit, onCancel }) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [defaultEnergyValue, setDefaultEnergyValue] = useState(0);
    const [defaultPointsValue, setDefaultPointsValue] = useState(0);
    
    const [recByDay, setRecByDay] = useState([]);
    const [recStartTime, setRecStartTime] = useState('');
    const [recDurationMinutes, setRecDurationMinutes] = useState(60);
    const [recPatternStartDate, setRecPatternStartDate] = useState(formatDateForInput(new Date().toISOString()));
    const [recEndsOnDate, setRecEndsOnDate] = useState('');
    const [isActive, setIsActive] = useState(true);
    
    const [questId, setQuestId] = useState(null);
    const [selectedTagIds, setSelectedTagIds] = useState([]);

    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingDefaultQuest, setIsFetchingDefaultQuest] = useState(false);
    const isEditing = !!templateToEdit;

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
                if (defaultQuest) setQuestId(defaultQuest.id);
            } catch (err) {
                console.error("Failed to fetch default quest:", err);
            } finally {
                setIsFetchingDefaultQuest(false);
            }
        }
    }, [isEditing, questId]);

    useEffect(() => {
        fetchAndSetDefaultQuest();
    }, [fetchAndSetDefaultQuest]);

    useEffect(() => {
        if (isEditing && templateToEdit) {
            setTitle(templateToEdit.title || '');
            setDescription(templateToEdit.description || '');
            setDefaultEnergyValue(templateToEdit.default_energy_value || 0);
            setDefaultPointsValue(templateToEdit.default_points_value || 0);
            setRecByDay(templateToEdit.rec_by_day || []);
            setRecStartTime(formatTimeForInput(templateToEdit.rec_start_time));
            setRecDurationMinutes(templateToEdit.rec_duration_minutes || 60);
            setRecPatternStartDate(formatDateForInput(templateToEdit.rec_pattern_start_date));
            setRecEndsOnDate(formatDateForInput(templateToEdit.rec_ends_on_date));
            setIsActive(templateToEdit.is_active === undefined ? true : templateToEdit.is_active);
            setQuestId(templateToEdit.quest_id || null);
            setSelectedTagIds(templateToEdit.tags ? templateToEdit.tags.map(tag => tag.id) : []);
        } else {
            setTitle('');
            setDescription('');
            setDefaultEnergyValue(5);
            setDefaultPointsValue(10);
            setRecByDay([]);
            setRecStartTime('');
            setRecDurationMinutes(60);
            setRecPatternStartDate(formatDateForInput(new Date().toISOString()));
            setRecEndsOnDate('');
            setIsActive(true);
            setSelectedTagIds([]);
        }
    }, [templateToEdit, isEditing, fetchAndSetDefaultQuest]);

    const handleRecByDayChange = (value) => {
        if (value === RECURRENCE_TYPE_DAILY) {
            // Si se selecciona DAILY, se deseleccionan los días específicos y viceversa.
            setRecByDay(prev => prev.includes(RECURRENCE_TYPE_DAILY) ? [] : [RECURRENCE_TYPE_DAILY]);
        } else { // Día específico de la semana
            // Si se selecciona un día específico, se deselecciona DAILY.
            const newRecByDay = recByDay.filter(d => d !== RECURRENCE_TYPE_DAILY);
            if (newRecByDay.includes(value)) {
                setRecByDay(newRecByDay.filter(day => day !== value));
            } else {
                setRecByDay([...newRecByDay, value]);
            }
        }
    };
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        if (!title.trim()) {
            setError('Title is required.'); setIsLoading(false); return;
        }
        if (!recPatternStartDate) {
            setError('Recurrence pattern start date is required.'); setIsLoading(false); return;
        }
        if (recEndsOnDate && new Date(recEndsOnDate) < new Date(recPatternStartDate)) {
            setError('End date cannot be before start date.'); setIsLoading(false); return;
        }
        if (recByDay.length === 0) {
            setError('Please select at least one recurrence day/type (e.g., Daily, MO, TU).'); setIsLoading(false); return;
        }
        if (recStartTime && !recStartTime.match(/^\d{2}:\d{2}$/)) {
             setError('Start time must be in HH:MM format if provided.'); setIsLoading(false); return;
        }

        const templateData = {
            title: title.trim(),
            description: description.trim() || null,
            default_energy_value: parseInt(defaultEnergyValue, 10),
            default_points_value: parseInt(defaultPointsValue, 10),
            rec_by_day: recByDay,
            rec_start_time: recStartTime ? `${recStartTime}:00` : null,
            rec_duration_minutes: parseInt(recDurationMinutes, 10) || null,
            rec_pattern_start_date: recPatternStartDate,
            rec_ends_on_date: recEndsOnDate || null,
            is_active: isActive,
            quest_id: questId,
            tag_ids: selectedTagIds,
        };

        const token = localStorage.getItem('authToken');
        const config = { headers: { 'Authorization': `Bearer ${token}` } };

        try {
            if (isEditing) {
                await axios.put(`${API_HABIT_TEMPLATES_URL}/${templateToEdit.id}`, templateData, config);
            } else {
                await axios.post(API_HABIT_TEMPLATES_URL, templateData, config);
            }
            onFormSubmit();
        } catch (err) {
            console.error("Failed to save habit template:", err.response?.data || err.message);
            const errorData = err.response?.data;
            let errorMessage = `Failed to ${isEditing ? 'update' : 'create'} habit template.`;
            if (errorData?.errors && typeof errorData.errors === 'object') {
                 const firstErrorKey = Object.keys(errorData.errors)[0];
                 const messages = errorData.errors[firstErrorKey];
                 errorMessage = `${firstErrorKey.replace(/_/g, ' ')}: ${Array.isArray(messages) ? messages.join(', ') : messages}`;
            } else if (errorData?.error) {
                errorMessage = errorData.error;
            }
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="habit-template-form-container">
            <h3>{isEditing ? 'Edit Habit Template' : 'Create New Habit Template'}</h3>
            {error && <p className="error-message">{error}</p>}
            <form onSubmit={handleSubmit} className="habit-template-form">
                {/* ... otros campos del formulario (title, description, etc.) ... */}
                <div className="form-group">
                    <label htmlFor="ht-title">Title:</label>
                    <input type="text" id="ht-title" value={title} onChange={(e) => setTitle(e.target.value)} required disabled={isLoading || isFetchingDefaultQuest} />
                </div>
                <div className="form-group">
                    <label htmlFor="ht-description">Description (Optional):</label>
                    <textarea id="ht-description" value={description} onChange={(e) => setDescription(e.target.value)} rows="2" disabled={isLoading || isFetchingDefaultQuest} />
                </div>

                <fieldset className="form-fieldset">
                    <legend>Recurrence Pattern</legend>
                    <div className="form-group">
                        <label>Repeats On:</label>
                        <div className="checkbox-group">
                            <label className="checkbox-label">
                                <input 
                                    type="checkbox" 
                                    value={RECURRENCE_TYPE_DAILY} 
                                    checked={recByDay.includes(RECURRENCE_TYPE_DAILY)} 
                                    onChange={() => handleRecByDayChange(RECURRENCE_TYPE_DAILY)} 
                                    disabled={isLoading || isFetchingDefaultQuest}
                                /> {RECURRENCE_TYPE_DAILY}
                            </label>
                        </div>
                        <div className="checkbox-group" style={{marginTop: '0.5rem'}}>
                            {DAYS_OF_WEEK.map(day => (
                                <label key={day} className="checkbox-label">
                                    <input 
                                        type="checkbox" 
                                        value={day} 
                                        checked={recByDay.includes(day)} 
                                        onChange={() => handleRecByDayChange(day)} 
                                        disabled={isLoading || isFetchingDefaultQuest || recByDay.includes(RECURRENCE_TYPE_DAILY)} 
                                    /> {day}
                                </label>
                            ))}
                        </div>
                    </div>
                    {/* ... otros campos de recurrencia (start_time, duration, start_date, end_date) ... */}
                    <div className="form-group-row">
                        <div className="form-group">
                            <label htmlFor="ht-rec-start-time">Start Time (Optional):</label>
                            <input type="time" id="ht-rec-start-time" value={recStartTime} onChange={(e) => setRecStartTime(e.target.value)} disabled={isLoading || isFetchingDefaultQuest} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="ht-rec-duration">Duration (Minutes, Optional):</label>
                            <input type="number" id="ht-rec-duration" value={recDurationMinutes} min="1" onChange={(e) => setRecDurationMinutes(parseInt(e.target.value, 10))} placeholder="e.g., 30" disabled={isLoading || isFetchingDefaultQuest} />
                        </div>
                    </div>
                     <div className="form-group-row">
                        <div className="form-group">
                            <label htmlFor="ht-rec-pattern-start-date">Pattern Starts On:</label>
                            <input type="date" id="ht-rec-pattern-start-date" value={recPatternStartDate} onChange={(e) => setRecPatternStartDate(e.target.value)} required disabled={isLoading || isFetchingDefaultQuest} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="ht-rec-ends-on-date">Pattern Ends On (Optional):</label>
                            <input type="date" id="ht-rec-ends-on-date" value={recEndsOnDate} onChange={(e) => setRecEndsOnDate(e.target.value)} min={recPatternStartDate} disabled={isLoading || isFetchingDefaultQuest} />
                        </div>
                    </div>
                </fieldset>

                {/* ... fieldsets para Values & Associations, y el checkbox Is Active ... */}
                <fieldset className="form-fieldset">
                    <legend>Values & Associations</legend>
                    <div className="form-group-row">
                        <div className="form-group">
                            <label htmlFor="ht-energy">Default Energy:</label>
                            <input type="number" id="ht-energy" value={defaultEnergyValue} onChange={(e) => setDefaultEnergyValue(parseInt(e.target.value, 10))} required disabled={isLoading || isFetchingDefaultQuest} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="ht-points">Default Points:</label>
                            <input type="number" id="ht-points" value={defaultPointsValue} min="0" onChange={(e) => setDefaultPointsValue(parseInt(e.target.value, 10))} required disabled={isLoading || isFetchingDefaultQuest} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label htmlFor="ht-quest">Associate with Quest:</label>
                        <QuestSelector selectedQuestId={questId} onQuestChange={setQuestId} disabled={isLoading || isFetchingDefaultQuest} />
                    </div>
                    <TagSelector selectedTagIds={selectedTagIds} onSelectedTagsChange={setSelectedTagIds} />
                </fieldset>
                
                <div className="form-group checkbox-label" style={{justifyContent: 'flex-start', marginTop: '1rem'}}>
                    <input type="checkbox" id="ht-is-active" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} disabled={isLoading || isFetchingDefaultQuest} />
                    <label htmlFor="ht-is-active" style={{marginBottom: 0, marginLeft: '0.5rem'}}> Habit is Active (generates occurrences)</label>
                </div>

                <div className="form-actions">
                    <button type="button" onClick={onCancel} className="cancel-btn" disabled={isLoading}>Cancel</button>
                    <button type="submit" className="submit-btn" disabled={isLoading}>
                        {isLoading ? (isEditing ? 'Saving...' : 'Creating...') : (isEditing ? 'Save Changes' : 'Create Template')}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default HabitTemplateForm;