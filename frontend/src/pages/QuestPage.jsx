// frontend/src/pages/QuestPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import QuestList from '../components/quests/QuestList'; // Crearemos este componente
import QuestForm from '../components/quests/QuestForm';   // Crearemos este componente
import ConfirmationDialog from '../components/common/ConfirmationDialog'; // Crearemos este componente
import '../styles/quests.css'; // Importar estilos

const API_QUESTS_URL = import.meta.env.VITE_API_BASE_URL+'/quests';


function QuestPage() {
    const [quests, setQuests] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const [showForm, setShowForm] = useState(false);
    const [editingQuest, setEditingQuest] = useState(null); // Quest a editar, o null si es para crear

    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [questToDelete, setQuestToDelete] = useState(null);

    const fetchQuests = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        const token = localStorage.getItem('authToken');
        try {
            const response = await axios.get(API_QUESTS_URL, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setQuests(response.data || []);
        } catch (err) {
            console.error("Failed to fetch quests:", err);
            setError(err.response?.data?.error || "Failed to fetch quests. Please try again.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchQuests();
    }, [fetchQuests]);

    const handleOpenCreateForm = () => {
        setEditingQuest(null); // Asegurarse que no hay quest en edición
        setShowForm(true);
    };

    const handleOpenEditForm = (quest) => {
        setEditingQuest(quest);
        setShowForm(true);
    };

    const handleFormClose = () => {
        setShowForm(false);
        setEditingQuest(null); // Limpiar quest en edición
    };

    const handleFormSubmit = async () => {
        fetchQuests(); // Recargar la lista de quests
        handleFormClose(); // Cerrar el formulario
    };

    const handleDeleteRequest = (quest) => {
        setQuestToDelete(quest);
        setShowConfirmDialog(true);
    };

    const handleConfirmDelete = async () => {
        if (!questToDelete) return;
        const token = localStorage.getItem('authToken');
        try {
            await axios.delete(`${API_QUESTS_URL}/${questToDelete.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setQuestToDelete(null);
            setShowConfirmDialog(false);
            fetchQuests(); // Recargar lista
        } catch (err) {
            console.error("Failed to delete quest:", err);
            setError(err.response?.data?.error || "Failed to delete quest. Please try again.");
            // Mantener el diálogo abierto para mostrar el error o cerrarlo y mostrar global
            setShowConfirmDialog(false); // Opcional: cerrar diálogo en error
        }
    };

    const handleCancelDelete = () => {
        setQuestToDelete(null);
        setShowConfirmDialog(false);
    };


    if (isLoading) {
        return <div className="page-container"><p>Loading Quests...</p></div>;
    }

    // No mostramos el error directamente aquí si está en el form o dialog,
    // pero podríamos tener un área de notificación global.
    // if (error && !showForm && !showConfirmDialog) { // Evitar mostrar error global si ya se muestra en form/dialog
    //     return <div className="page-container"><p className="auth-error-message">{error}</p></div>;
    // }


    return (
        <div className="quests-page-container">
            <h2>Manage Your Quests</h2>

            {!showForm && (
                <button onClick={handleOpenCreateForm} className="add-quest-button">
                    Add New Quest
                </button>
            )}

            {showForm && (
                <QuestForm
                    questToEdit={editingQuest}
                    onFormSubmit={handleFormSubmit}
                    onCancel={handleFormClose}
                />
            )}
            
            {error && <p className="auth-error-message" style={{textAlign: 'center', marginTop: '1rem'}}>{error}</p>}


            <h3>Your Current Quests:</h3>
            <QuestList
                quests={quests}
                onEditQuest={handleOpenEditForm}
                onDeleteQuest={handleDeleteRequest}
            />

            {showConfirmDialog && questToDelete && (
                <ConfirmationDialog
                    message={`Are you sure you want to delete the Quest "${questToDelete.name}"? Associated tasks will be moved to your default Quest.`}
                    onConfirm={handleConfirmDelete}
                    onCancel={handleCancelDelete}
                    confirmButtonText="Delete Quest"
                />
            )}
        </div>
    );
}

export default QuestPage;