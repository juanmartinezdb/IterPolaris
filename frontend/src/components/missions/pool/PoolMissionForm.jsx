// frontend/src/components/missions/pool/PoolMissionForm.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import TagSelector from '../../tags/TagSelector';
import QuestSelector from '../../quests/QuestSelector';
import '../../../styles/poolmissions.css'; 

const API_POOL_MISSIONS_URL = `${import.meta.env.VITE_API_BASE_URL}/pool-missions`;
const API_QUESTS_URL = `${import.meta.env.VITE_API_BASE_URL}/quests`; // Para obtener la default quest

function PoolMissionForm({ missionToEdit, onFormSubmit, onCancel }) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [energyValue, setEnergyValue] = useState(0);
    const [pointsValue, setPointsValue] = useState(0);
    const [questId, setQuestId] = useState(null); // Este será el ID de la quest, o null
    const [selectedTagIds, setSelectedTagIds] = useState([]);
    const [focusStatus, setFocusStatus] = useState('ACTIVE');

    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingDefaultQuest, setIsFetchingDefaultQuest] = useState(false);
    const isEditing = !!missionToEdit;

    // Efecto para preseleccionar la Quest por defecto al CREAR una nueva misión
    const fetchAndSetDefaultQuest = useCallback(async () => {
        if (!isEditing && questId === null) { // Solo para creación y si no se ha establecido ya
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
                    // Si no hay una marcada como default, pero hay quests,
                    // el QuestSelector ya las ordena para que la "General" (o la primera) esté arriba.
                    // Y el <select> la tomará por defecto si questId sigue siendo null.
                    // Opcionalmente, podríamos setear la primera: setQuestId(quests[0].id);
                    // Pero es mejor dejar que el <select> nativo y el backend manejen el `null`.
                }
            } catch (err) {
                console.error("Failed to fetch default quest for form:", err);
                // No establecer error aquí, el selector mostrará su propio error si no carga quests.
            } finally {
                setIsFetchingDefaultQuest(false);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEditing]); // No incluir questId aquí para evitar bucle si el usuario deselecciona

    useEffect(() => {
        fetchAndSetDefaultQuest();
    }, [fetchAndSetDefaultQuest]);


    useEffect(() => {
        if (isEditing && missionToEdit) {
            setTitle(missionToEdit.title || '');
            setDescription(missionToEdit.description || '');
            setEnergyValue(missionToEdit.energy_value || 0);
            setPointsValue(missionToEdit.points_value || 0);
            // Aquí es crucial: missionToEdit.quest_id ya tiene el ID de la quest de la misión
            // o es null si el backend lo permite (aunque nuestra lógica de backend ahora lo evitará).
            // El QuestSelector usará este valor para preseleccionar la opción correcta.
            setQuestId(missionToEdit.quest_id || null); 
            setSelectedTagIds(missionToEdit.tags ? missionToEdit.tags.map(tag => tag.id) : []);
            setFocusStatus(missionToEdit.focus_status || 'ACTIVE');
        } else if (!isEditing) { // Reset para creación (después de que fetchAndSetDefaultQuest pueda haber actuado)
            setTitle('');
            setDescription('');
            setEnergyValue(10); 
            setPointsValue(5);  
            // questId se establece por fetchAndSetDefaultQuest o permanece null si el usuario deselecciona.
            setSelectedTagIds([]);
            setFocusStatus('ACTIVE');
        }
    }, [missionToEdit, isEditing, fetchAndSetDefaultQuest]); // fetchAndSetDefaultQuest es estable

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        if (!title.trim()) {
            setError('Mission title is required.');
            setIsLoading(false);
            return;
        }
        // ... (otras validaciones si las tienes)

        const missionData = {
            title: title.trim(),
            description: description.trim() || null,
            energy_value: parseInt(energyValue, 10),
            points_value: parseInt(pointsValue, 10),
            quest_id: questId, // Enviar el questId actual (puede ser null, backend lo maneja)
            tag_ids: selectedTagIds,
            focus_status: focusStatus,
        };
        
        const token = localStorage.getItem('authToken');
        const config = { headers: { 'Authorization': `Bearer ${token}` } };

        try {
            if (isEditing) {
                await axios.put(`${API_POOL_MISSIONS_URL}/${missionToEdit.id}`, missionData, config);
            } else {
                await axios.post(API_POOL_MISSIONS_URL, missionData, config);
            }
            onFormSubmit(); 
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

    return (
        <div className="pool-mission-form-container">
            <h3>{isEditing ? 'Edit Pool Mission' : 'Create New Pool Mission'}</h3>
            {error && <p className="error-message">{error}</p>}
            <form onSubmit={handleSubmit} className="pool-mission-form">
                {/* ... (campos de title, description, energy, points como antes) ... */}
                <div className="form-group">
                    <label htmlFor="pm-title">Title:</label>
                    <input type="text" id="pm-title" value={title} onChange={(e) => setTitle(e.target.value)} required disabled={isLoading || isFetchingDefaultQuest} />
                </div>
                <div className="form-group">
                    <label htmlFor="pm-description">Description (Optional):</label>
                    <textarea id="pm-description" value={description} onChange={(e) => setDescription(e.target.value)} rows="3" disabled={isLoading || isFetchingDefaultQuest} />
                </div>
                <div className="form-group">
                    <label htmlFor="pm-energy">Energy Value:</label>
                    <input type="number" id="pm-energy" value={energyValue} onChange={(e) => setEnergyValue(parseInt(e.target.value, 10))} disabled={isLoading || isFetchingDefaultQuest} />
                </div>
                <div className="form-group">
                    <label htmlFor="pm-points">Points Value:</label>
                    <input type="number" id="pm-points" value={pointsValue} min="0" onChange={(e) => setPointsValue(parseInt(e.target.value, 10))} disabled={isLoading || isFetchingDefaultQuest} />
                </div>

                 <div className="form-group">
                    <label htmlFor="pm-quest">Associate with Quest:</label>
                    <QuestSelector 
                        selectedQuestId={questId} // `questId` del estado del formulario
                        onQuestChange={(newQuestId) => setQuestId(newQuestId)}
                        disabled={isLoading || isFetchingDefaultQuest}
                        isFilter={false} 
                    />
                </div>
                <TagSelector 
                    selectedTagIds={selectedTagIds}
                    onSelectedTagsChange={setSelectedTagIds}
                    // disabled={isLoading || isFetchingDefaultQuest} // Si TagSelector también necesita una prop disabled
                />
                <div className="form-group">
                    <label htmlFor="pm-focus">Focus Status:</label>
                    <select id="pm-focus" value={focusStatus} onChange={(e) => setFocusStatus(e.target.value)} disabled={isLoading || isFetchingDefaultQuest}>
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