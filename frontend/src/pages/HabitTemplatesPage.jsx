// frontend/src/pages/HabitTemplatesPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import HabitTemplateList from '../components/habits/HabitTemplateList';
import HabitTemplateForm from '../components/habits/HabitTemplateForm';
import ConfirmationDialog from '../components/common/ConfirmationDialog';
import '../styles/habittemplates.css';
import '../styles/dialog.css';

const API_HABIT_TEMPLATES_URL = `${import.meta.env.VITE_API_BASE_URL}/habit-templates`;
const API_QUESTS_URL = `${import.meta.env.VITE_API_BASE_URL}/quests`;

function HabitTemplatesPage() {
    const [templates, setTemplates] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [templateToDelete, setTemplateToDelete] = useState(null);
    const [questColors, setQuestColors] = useState({});
    const [feedbackMessage, setFeedbackMessage] = useState('');

    const clearFeedback = useCallback(() => {
      setTimeout(() => setFeedbackMessage(''), 3000);
    }, []);

    const fetchQuestColors = useCallback(async () => {
        const token = localStorage.getItem('authToken');
        try {
            const response = await axios.get(API_QUESTS_URL, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const colors = {};
            (response.data || []).forEach(quest => { colors[quest.id] = quest.color; });
            setQuestColors(colors);
        } catch (err) {
            console.error("Failed to fetch quests for colors:", err);
        }
    }, []);

    const fetchHabitTemplates = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        const token = localStorage.getItem('authToken');
        try {
            const response = await axios.get(API_HABIT_TEMPLATES_URL, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setTemplates(response.data || []);
        } catch (err) {
            setError(err.response?.data?.error || "Failed to fetch habit templates.");
            setTemplates([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchQuestColors();
        fetchHabitTemplates();
    }, [fetchQuestColors, fetchHabitTemplates]);
    

    const handleOpenCreateForm = () => {
        setEditingTemplate(null);
        setShowForm(true);
    };
    const handleOpenEditForm = (template) => {
        setEditingTemplate(template);
        setShowForm(true);
    };
    const handleFormClose = () => {
        setShowForm(false);
        setEditingTemplate(null);
        setError(null); // Clear form-specific errors on close
    };
    const handleFormSubmit = () => { // This is the key callback for the form
        fetchHabitTemplates(); // Re-fetch the list of templates
        handleFormClose();     // Close the form
        setFeedbackMessage(editingTemplate ? 'Habit template updated successfully!' : 'Habit template created successfully!');
        clearFeedback();
    };

    const handleDeleteRequest = (template) => {
        setTemplateToDelete(template);
        setShowConfirmDialog(true);
    };
    const handleConfirmDelete = async () => {
        if (!templateToDelete) return;
        const token = localStorage.getItem('authToken');
        setError(null); // Clear previous errors
        try {
            await axios.delete(`${API_HABIT_TEMPLATES_URL}/${templateToDelete.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            fetchHabitTemplates(); // Re-fetch after delete
            setFeedbackMessage(`Habit template "${templateToDelete.title}" deleted.`);
            clearFeedback();
        } catch (err) {
            setError(err.response?.data?.error || "Failed to delete habit template.");
        } finally {
            setShowConfirmDialog(false);
            setTemplateToDelete(null);
        }
    };

    const handleGenerateOccurrences = async (template) => {
        if (!template || !template.is_active) {
            setError("Cannot extend an inactive habit template.");
            return;
        }
        setIsLoading(true);
        setError(null); // Clear previous errors
        const token = localStorage.getItem('authToken');
        try {
            const response = await axios.post(`${API_HABIT_TEMPLATES_URL}/${template.id}/generate-occurrences`, {}, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setFeedbackMessage(response.data.message || `Occurrences extended for "${template.title}".`);
            clearFeedback();
            // fetchHabitTemplates(); // Optionally re-fetch templates if backend modifies template upon extension
        } catch (err) {
            setError(err.response?.data?.error || "Failed to generate more occurrences.");
        } finally {
            setIsLoading(false);
        }
    };

    const renderModalForm = () => {
        if (!showForm) return null;
        return (
            <div className="dialog-overlay">
                 <div className="dialog-content" style={{maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto', textAlign: 'left'}}>
                    <HabitTemplateForm
                        templateToEdit={editingTemplate}
                        onFormSubmit={handleFormSubmit} // Crucial: pass the correct handler
                        onCancel={handleFormClose}
                    />
                </div>
            </div>
        );
    };

    return (
        <div className="habit-templates-page-container">
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
                <h2>Habit Templates</h2>
                <button onClick={handleOpenCreateForm} className="add-habit-template-button" style={{margin: 0}}>
                    + Create Habit Template
                </button>
            </div>

            {feedbackMessage && <p className="auth-success-message" style={{textAlign: 'center'}}>{feedbackMessage}</p>}
            {error && <p className="auth-error-message" style={{textAlign: 'center'}}>{error}</p>}
            
            {isLoading && templates.length === 0 && <p style={{textAlign: 'center'}}>Loading habit templates...</p>}
            
            {!isLoading && (
                <HabitTemplateList
                    templates={templates}
                    onEditTemplate={handleOpenEditForm}
                    onDeleteTemplate={handleDeleteRequest}
                    questColors={questColors}
                    onGenerateOccurrences={handleGenerateOccurrences}
                />
            )}
            
            {renderModalForm()}

            {showConfirmDialog && templateToDelete && (
                <ConfirmationDialog
                    message={`Are you sure you want to delete the habit template "${templateToDelete.title}"? All its future occurrences will also be deleted.`}
                    onConfirm={handleConfirmDelete}
                    onCancel={() => setShowConfirmDialog(false)}
                    confirmButtonText="Delete Template"
                />
            )}
        </div>
    );
}

export default HabitTemplatesPage;