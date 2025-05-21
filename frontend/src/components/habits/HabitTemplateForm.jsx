// frontend/src/components/habits/HabitTemplateForm.jsx
import React, { useState, useEffect, useCallback, useContext } from 'react';
import axios from 'axios';
import { UserContext } from '../../contexts/UserContext';
import QuestSelector from '../quests/QuestSelector';
import TagSelector from '../tags/TagSelector';
import '../../styles/habittemplates.css';

const API_HABIT_TEMPLATES_URL = `${import.meta.env.VITE_API_BASE_URL}/habit-templates`;
const API_QUESTS_URL = `${import.meta.env.VITE_API_BASE_URL}/quests`;

const formatDateForInput = (isoOrDateString) => {
    if (!isoOrDateString) return '';
    try {
        const date = new Date(isoOrDateString);
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (e) { return ''; }
};

const formatTimeForInput = (isoOrTimeString) => {
    if (!isoOrTimeString) return '';
    try {
        if (typeof isoOrTimeString === 'string' && (isoOrTimeString.match(/^\d{2}:\d{2}(:\d{2})?$/)) ) {
             return isoOrTimeString.substring(0,5);
        }
        const date = new Date(`1970-01-01T${isoOrTimeString}Z`); // Assume UTC if only time
        const hours = date.getUTCHours().toString().padStart(2, '0');
        const minutes = date.getUTCMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    } catch (e) { return ''; }
};

const DAYS_OF_WEEK = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
const RECURRENCE_TYPE_DAILY = 'DAILY';

function HabitTemplateForm({ templateToEdit, onFormSubmit, onCancel }) {
    const { currentUser } = useContext(UserContext);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        defaultEnergyValue: 5,
        defaultPointsValue: 10,
        recByDay: [],
        recStartTime: '',
        recDurationMinutes: 60,
        recPatternStartDate: formatDateForInput(new Date().toISOString()),
        recEndsOnDate: '',
        isActive: true,
        questId: null, // Será string UUID o null
        selectedTagIds: []
    });

    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingDefaultQuest, setIsFetchingDefaultQuest] = useState(false);
    const isEditing = !!templateToEdit;

    // Efecto para cargar datos de templateToEdit o default quest para NUEVOS templates
    useEffect(() => {
        const loadInitialData = async () => {
            if (isEditing && templateToEdit) {
                setFormData({
                    title: templateToEdit.title || '',
                    description: templateToEdit.description || '',
                    defaultEnergyValue: templateToEdit.default_energy_value || 0,
                    defaultPointsValue: templateToEdit.default_points_value || 0,
                    recByDay: templateToEdit.rec_by_day || [],
                    recStartTime: formatTimeForInput(templateToEdit.rec_start_time),
                    recDurationMinutes: templateToEdit.rec_duration_minutes || 60,
                    recPatternStartDate: formatDateForInput(templateToEdit.rec_pattern_start_date),
                    recEndsOnDate: formatDateForInput(templateToEdit.rec_ends_on_date),
                    isActive: templateToEdit.is_active === undefined ? true : templateToEdit.is_active,
                    questId: templateToEdit.quest_id || null,
                    selectedTagIds: templateToEdit.tags ? templateToEdit.tags.map(tag => tag.id) : []
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
                    setFormData(prev => ({
                        ...prev, // Mantener valores por defecto de creación
                        title: '', description: '', defaultEnergyValue: 5, defaultPointsValue: 10,
                        recByDay: [], recStartTime: '', recDurationMinutes: 60, 
                        recPatternStartDate: formatDateForInput(new Date().toISOString()), recEndsOnDate: '',
                        isActive: true, selectedTagIds: [],
                        questId: defaultQuest ? defaultQuest.id : (quests.length > 0 ? quests[0].id : null) // Asignar default o primera
                    }));
                } catch (err) {
                    console.error("HabitTemplateForm: Failed to fetch default quest:", err);
                    setFormData(prev => ({ ...prev, questId: null })); // Fallback
                } finally {
                    setIsFetchingDefaultQuest(false);
                }
            }
        };
        loadInitialData();
    }, [templateToEdit, isEditing]); // Solo depende de templateToEdit e isEditing

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleQuestChange = (newQuestId) => {
        setFormData(prev => ({ ...prev, questId: newQuestId || null }));
    };

    const handleTagsChange = (newTagIds) => {
        setFormData(prev => ({ ...prev, selectedTagIds: newTagIds }));
    };
    
    const handleRecByDayChange = (dayValue) => {
        setFormData(prev => {
            let newRecByDay = [...prev.recByDay];
            if (dayValue === RECURRENCE_TYPE_DAILY) {
                newRecByDay = newRecByDay.includes(RECURRENCE_TYPE_DAILY) ? [] : [RECURRENCE_TYPE_DAILY];
            } else {
                newRecByDay = newRecByDay.filter(d => d !== RECURRENCE_TYPE_DAILY); // Desmarcar DAILY si se selecciona día específico
                if (newRecByDay.includes(dayValue)) {
                    newRecByDay = newRecByDay.filter(day => day !== dayValue);
                } else {
                    newRecByDay.push(dayValue);
                }
            }
            return { ...prev, recByDay: newRecByDay };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        if (!formData.title.trim()) {
            setError('Title is required.'); setIsLoading(false); return;
        }
        if (!formData.recPatternStartDate) {
            setError('Recurrence pattern start date is required.'); setIsLoading(false); return;
        }
        if (formData.recEndsOnDate && new Date(formData.recEndsOnDate) < new Date(formData.recPatternStartDate)) {
            setError('End date cannot be before start date.'); setIsLoading(false); return;
        }
        if (formData.recByDay.length === 0) {
            setError('Please select at least one recurrence day/type (e.g., Daily, MO, TU).'); setIsLoading(false); return;
        }
        if (formData.recStartTime && !formData.recStartTime.match(/^\d{2}:\d{2}$/)) {
             setError('Start time must be in HH:MM format if provided.'); setIsLoading(false); return;
        }

        const templateDataPayload = {
            title: formData.title.trim(),
            description: formData.description.trim() || null,
            default_energy_value: parseInt(formData.defaultEnergyValue, 10),
            default_points_value: parseInt(formData.defaultPointsValue, 10),
            rec_by_day: formData.recByDay,
            rec_start_time: formData.recStartTime ? `${formData.recStartTime}:00` : null, // Añadir segundos para backend
            rec_duration_minutes: parseInt(formData.recDurationMinutes, 10) || null,
            rec_pattern_start_date: formData.recPatternStartDate,
            rec_ends_on_date: formData.recEndsOnDate || null,
            is_active: formData.isActive,
            quest_id: formData.questId,
            tag_ids: formData.selectedTagIds,
        };

        const token = localStorage.getItem('authToken');
        const config = { headers: { 'Authorization': `Bearer ${token}` } };

        try {
            if (isEditing) {
                await axios.put(`${API_HABIT_TEMPLATES_URL}/${templateToEdit.id}`, templateDataPayload, config);
            } else {
                await axios.post(API_HABIT_TEMPLATES_URL, templateDataPayload, config);
            }
            onFormSubmit(); // Esta función debería llamar a refreshUserStatsAndEnergy del contexto si es necesario
        } catch (err) {
            console.error("Failed to save habit template:", err.response?.data || err.message);
            const errorData = err.response?.data;
            let errorMessageText = `Failed to ${isEditing ? 'update' : 'create'} habit template.`;
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
        <div className="habit-template-form-container">
            <h3>{isEditing ? 'Edit Habit Template' : 'Create New Habit Template'}</h3>
            {error && <p className="error-message">{error}</p>}
            <form onSubmit={handleSubmit} className="habit-template-form">
                <div className="form-group">
                    <label htmlFor="ht-title">Title:</label>
                    <input type="text" id="ht-title" name="title" value={formData.title} onChange={handleChange} required disabled={formDisabled} />
                </div>
                <div className="form-group">
                    <label htmlFor="ht-description">Description (Optional):</label>
                    <textarea id="ht-description" name="description" value={formData.description} onChange={handleChange} rows="2" disabled={formDisabled} />
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
                                    checked={formData.recByDay.includes(RECURRENCE_TYPE_DAILY)} 
                                    onChange={() => handleRecByDayChange(RECURRENCE_TYPE_DAILY)} 
                                    disabled={formDisabled}
                                /> {RECURRENCE_TYPE_DAILY}
                            </label>
                        </div>
                        <div className="checkbox-group" style={{marginTop: '0.5rem'}}>
                            {DAYS_OF_WEEK.map(day => (
                                <label key={day} className="checkbox-label">
                                    <input 
                                        type="checkbox" 
                                        value={day} 
                                        checked={formData.recByDay.includes(day)} 
                                        onChange={() => handleRecByDayChange(day)} 
                                        disabled={formDisabled || formData.recByDay.includes(RECURRENCE_TYPE_DAILY)} 
                                    /> {day}
                                </label>
                            ))}
                        </div>
                         {formData.recByDay.length === 0 && <p className="error-message" style={{fontSize: '0.8em', marginTop: '0.2em'}}>Select at least one day or "DAILY".</p>}
                    </div>
                    <div className="form-group-row">
                        <div className="form-group">
                            <label htmlFor="ht-rec-start-time">Start Time (Optional):</label>
                            <input type="time" id="ht-rec-start-time" name="recStartTime" value={formData.recStartTime} onChange={handleChange} disabled={formDisabled} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="ht-rec-duration">Duration (Minutes, Optional):</label>
                            <input type="number" id="ht-rec-duration" name="recDurationMinutes" value={formData.recDurationMinutes} min="1" onChange={handleChange} placeholder="e.g., 30" disabled={formDisabled} />
                        </div>
                    </div>
                     <div className="form-group-row">
                        <div className="form-group">
                            <label htmlFor="ht-rec-pattern-start-date">Pattern Starts On:</label>
                            <input type="date" id="ht-rec-pattern-start-date" name="recPatternStartDate" value={formData.recPatternStartDate} onChange={handleChange} required disabled={formDisabled} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="ht-rec-ends-on-date">Pattern Ends On (Optional):</label>
                            <input type="date" id="ht-rec-ends-on-date" name="recEndsOnDate" value={formData.recEndsOnDate} min={formData.recPatternStartDate} onChange={handleChange} disabled={formDisabled} />
                        </div>
                    </div>
                </fieldset>

                <fieldset className="form-fieldset">
                    <legend>Values & Associations</legend>
                    <div className="form-group-row">
                        <div className="form-group">
                            <label htmlFor="ht-energy">Default Energy:</label>
                            <input type="number" id="ht-energy" name="defaultEnergyValue" value={formData.defaultEnergyValue} onChange={handleChange} required disabled={formDisabled} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="ht-points">Default Points:</label>
                            <input type="number" id="ht-points" name="defaultPointsValue" value={formData.defaultPointsValue} min="0" onChange={handleChange} required disabled={formDisabled} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label htmlFor="ht-quest">Associate with Quest:</label>
                        <QuestSelector selectedQuestId={formData.questId} onQuestChange={handleQuestChange} disabled={formDisabled} isFilter={false} />
                    </div>
                    <TagSelector selectedTagIds={formData.selectedTagIds} onSelectedTagsChange={handleTagsChange} />
                </fieldset>
                
                <div className="form-group checkbox-label" style={{justifyContent: 'flex-start', marginTop: '1rem'}}>
                    <input type="checkbox" id="ht-is-active" name="isActive" checked={formData.isActive} onChange={handleChange} disabled={formDisabled} />
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