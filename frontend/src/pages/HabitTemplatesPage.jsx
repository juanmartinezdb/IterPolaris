// frontend/src/pages/HabitTemplatesPage.jsx
import React, { useState, useEffect, useCallback, useContext } from 'react'; // useContext importado
import axios from 'axios';
import HabitTemplateList from '../components/habits/HabitTemplateList';
import HabitTemplateForm from '../components/habits/HabitTemplateForm';
import ConfirmationDialog from '../components/common/ConfirmationDialog';
import Modal from '../components/common/Modal'; // Importar Modal
import { UserContext } from '../contexts/UserContext'; // Importar UserContext
import '../styles/habittemplates.css';
// dialog.css ya no es necesario si Modal lo maneja o está global.

const API_HABIT_TEMPLATES_URL = `${import.meta.env.VITE_API_BASE_URL}/habit-templates`;
const API_QUESTS_URL = `${import.meta.env.VITE_API_BASE_URL}/quests`;

function HabitTemplatesPage({ activeTagFilters }) { // Aceptar activeTagFilters
    const [templates, setTemplates] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showFormModal, setShowFormModal] = useState(false); // Renombrado
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [templateToDelete, setTemplateToDelete] = useState(null);
    const [questColors, setQuestColors] = useState({});
    const [feedbackMessage, setFeedbackMessage] = useState('');

    const { currentUser } = useContext(UserContext); // Obtener currentUser para fetch

    const clearFeedback = useCallback(() => {
      setTimeout(() => setFeedbackMessage(''), 3000);
    }, []);

    const fetchQuestColors = useCallback(async () => {
        if (!currentUser) return;
        const token = localStorage.getItem('authToken');
        try {
            const response = await axios.get(API_QUESTS_URL, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const colors = {};
            (response.data || []).forEach(quest => { colors[quest.id] = quest.color; });
            setQuestColors(colors);
        } catch (err) {
            console.error("HabitTemplatesPage: Failed to fetch quests for colors:", err);
        }
    }, [currentUser]);

    const fetchHabitTemplates = useCallback(async () => {
        if (!currentUser) { setTemplates([]); return; }
        setIsLoading(true);
        setError(null);
        const token = localStorage.getItem('authToken');

        const params = new URLSearchParams();
        if (activeTagFilters && activeTagFilters.length > 0) {
            activeTagFilters.forEach(tagId => params.append('tags', tagId));
            // Backend /api/habit-templates (GET) necesita soportar este filtro
        }

        try {
            const response = await axios.get(API_HABIT_TEMPLATES_URL, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: params // Añadir params
            });
            setTemplates(response.data || []);
        } catch (err) {
            setError(err.response?.data?.error || "Failed to fetch habit templates.");
            setTemplates([]);
        } finally {
            setIsLoading(false);
        }
    }, [currentUser, activeTagFilters]); // Añadir activeTagFilters

    useEffect(() => {
        fetchQuestColors();
    }, [fetchQuestColors]);
    
    useEffect(() => {
        fetchHabitTemplates();
    }, [fetchHabitTemplates]); // Depende de fetchHabitTemplates que ahora incluye activeTagFilters
    

    const handleOpenCreateForm = () => {
        setEditingTemplate(null);
        setShowFormModal(true);
    };
    const handleOpenEditForm = (template) => {
        setEditingTemplate(template);
        setShowFormModal(true);
    };
    const handleFormClose = () => {
        setShowFormModal(false);
        setEditingTemplate(null);
        setError(null); 
    };
    const handleFormSubmit = () => { 
        fetchHabitTemplates(); 
        handleFormClose();     
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
        setError(null); 
        try {
            await axios.delete(`${API_HABIT_TEMPLATES_URL}/${templateToDelete.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            fetchHabitTemplates(); 
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
        setIsLoading(true); // Podría ser un loading específico para esta acción
        setError(null); 
        const token = localStorage.getItem('authToken');
        try {
            const response = await axios.post(`${API_HABIT_TEMPLATES_URL}/${template.id}/generate-occurrences`, {}, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setFeedbackMessage(response.data.message || `Occurrences extended for "${template.title}".`);
            clearFeedback();
            // No es necesario re-fetch templates aquí a menos que el backend modifique el template en sí.
            // Las ocurrencias se verán en el calendario o vistas de ocurrencias.
        } catch (err) {
            setError(err.response?.data?.error || "Failed to generate more occurrences.");
        } finally {
            setIsLoading(false);
        }
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
            
            {!isLoading && !error && (
                <HabitTemplateList
                    templates={templates}
                    onEditTemplate={handleOpenEditForm}
                    onDeleteTemplate={handleDeleteRequest}
                    questColors={questColors}
                    onGenerateOccurrences={handleGenerateOccurrences}
                />
            )}
            
            {showFormModal && (
                <Modal 
                    title={editingTemplate ? "Edit Habit Template" : "Create New Habit Template"}
                    onClose={handleFormClose}
                >
                    <HabitTemplateForm
                        templateToEdit={editingTemplate}
                        onFormSubmit={handleFormSubmit} 
                        onCancel={handleFormClose}
                    />
                </Modal>
            )}

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