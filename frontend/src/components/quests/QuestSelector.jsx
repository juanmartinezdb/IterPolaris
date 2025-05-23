// frontend/src/components/quests/QuestSelector.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getContrastColor } from '../../utils/colorUtils'; // Importar la utilidad si se usa para estilos aquí

const API_QUESTS_URL = `${import.meta.env.VITE_API_BASE_URL}/quests`;

function QuestSelector({ 
    selectedQuestId,      
    onQuestChange,        
    disabled,             
    isFilter = false,
    ariaLabel = "Select Quest" // Default aria-label
}) {
    const [quests, setQuests] = useState([]);
    const [isLoading, setIsLoading] = useState(true); 
    const [error, setError] = useState('');

    const fetchQuestsCallback = useCallback(async () => {
        setIsLoading(true);
        setError('');
        const token = localStorage.getItem('authToken');
        try {
            const response = await axios.get(API_QUESTS_URL, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const fetchedQuests = response.data || [];
            
            fetchedQuests.sort((a, b) => {
                if (a.is_default_quest && !b.is_default_quest) return -1;
                if (!a.is_default_quest && b.is_default_quest) return 1;
                return a.name.localeCompare(b.name);
            });
            setQuests(fetchedQuests);

        } catch (err) {
            console.error("Failed to fetch quests for selector:", err);
            setError('Could not load quests.');
            setQuests([]);
        } finally {
            setIsLoading(false);
        }
    }, []); 

    useEffect(() => {
        fetchQuestsCallback();
    }, [fetchQuestsCallback]);
        
    const handleChange = (e) => {
        onQuestChange(e.target.value || null); 
    };

    if (isLoading) {
        return <select disabled={true} style={{minWidth: '150px'}} aria-label={ariaLabel}><option>Loading quests...</option></select>;
    }
    if (error) {
        return <select disabled={true} style={{minWidth: '150px'}} aria-label={ariaLabel}><option>{error}</option></select>;
    }
    
    let options = [];
    if (isFilter) {
        options.push(<option key="all-quests-filter" value="">All Quests</option>);
    } else {
        if (quests.length === 0) {
            return <select disabled={true} style={{minWidth: '150px'}} aria-label={ariaLabel}><option>No quests available</option></select>;
        }
    }

    quests.forEach(quest => {
        options.push(
            <option 
                key={quest.id} 
                value={quest.id}
            >
                {quest.name} {quest.is_default_quest ? "⭐" : ""}
            </option>
        );
    });
    
    return (
        <select 
            value={selectedQuestId || ""} 
            onChange={handleChange}
            disabled={disabled || isLoading || (quests.length === 0 && !isFilter)}
            style={{minWidth: '150px'}}
            aria-label={ariaLabel}
        >
            {options}
        </select>
    );
}

export default QuestSelector;