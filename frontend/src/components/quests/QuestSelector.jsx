// frontend/src/components/quests/QuestSelector.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_QUESTS_URL = `${import.meta.env.VITE_API_BASE_URL}/quests`;

// getContrastColor function (sin cambios, asumiendo que la tienes definida como en la respuesta anterior)
function getContrastColor(hexColor) {
    if (!hexColor || typeof hexColor !== 'string' || hexColor.length < 4) {
        return '#0A192F'; 
    }
    let r, g, b;
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hexColor = hexColor.replace(shorthandRegex, (m, rVal, gVal, bVal) => {
        return '#' + rVal + rVal + gVal + gVal + bVal + bVal;
    });
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hexColor);
    if (!result) {
        return '#0A192F';
    }
    r = parseInt(result[1], 16);
    g = parseInt(result[2], 16);
    b = parseInt(result[3], 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '#0A192F' : '#EAEAEA'; 
}


function QuestSelector({ 
    selectedQuestId,      // El ID de la quest actualmente seleccionada/a seleccionar
    onQuestChange,        // Función para llamar cuando la selección cambia
    disabled,             // Booleano para deshabilitar el selector
    isFilter = false      // Booleano para modo filtro (añade "All Quests")
}) {
    const [quests, setQuests] = useState([]);
    const [isLoading, setIsLoading] = useState(true); // Iniciar como true
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // No depende de nada para que solo se ejecute una vez al montar

    useEffect(() => {
        fetchQuestsCallback();
    }, [fetchQuestsCallback]);
        
    const handleChange = (e) => {
        // Si el valor es una cadena vacía (ej. "All Quests" o la opción de placeholder en formularios),
        // llamar a onQuestChange con null para que el backend lo maneje.
        // Si no, llamar con el ID de la quest.
        onQuestChange(e.target.value || null); 
    };

    if (isLoading) {
        return <select disabled={true} style={{minWidth: '150px'}}><option>Loading quests...</option></select>;
    }
    if (error) {
        return <select disabled={true} style={{minWidth: '150px'}}><option>{error}</option></select>;
    }
    
    // Construir las opciones
    let options = [];
    if (isFilter) {
        options.push(<option key="all-quests-filter" value="">All Quests</option>);
    } else {
        // Para formularios: Si no hay quest seleccionada (selectedQuestId es null o ""),
        // y hay quests cargadas, la primera opción (que será la default si existe)
        // se seleccionará debido a `value={selectedQuestId || ""}` en el select.
        // Si queremos un placeholder cuando NINGUNA quest está seleccionada (ej. selectedQuestId es null)
        // Y NO hay una default quest que el FORMULARIO pueda preseleccionar, podríamos añadir una opción.
        // Pero la lógica de preselección de la default quest se hará en el FORMULARIO padre.
        // Aquí, si selectedQuestId es "" (null), y la primera quest de la lista tiene value (ID), 
        // el select no mostrará nada seleccionado a menos que selectedQuestId coincida con una opción.
        // Es crucial que `selectedQuestId` que llega como prop sea el ID correcto.
        if (quests.length === 0) {
            return <select disabled={true} style={{minWidth: '150px'}}><option>No quests available</option></select>;
        }
        // Si no es un filtro, y no hay una quest seleccionada explícitamente,
        // el `value={selectedQuestId || ""}` en el <select> intentará seleccionar
        // la <option> que tenga value="". Si no existe tal opción (porque todas tienen IDs),
        // el comportamiento del select nativo es mostrar la primera opción de la lista.
        // Para forzar una "opción nula" si se desea (backend asigna a default):
        // options.push(<option key="no-quest-selected" value="">Use Default Quest</option>);
        // Pero esto es lo que querías evitar. La clave es que el FORMULARIO pase el ID de la default quest
        // cuando `selectedQuestId` deba ser la default.
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
    
    if (!isFilter && quests.length > 0 && !selectedQuestId) {
        // Para formularios, si no hay un selectedQuestId (es una misión nueva),
        // y NO queremos una opción placeholder explícita con value="",
        // el <select> por defecto mostrará la primera <option> de la lista `quests`.
        // Esta primera opción ya está ordenada para ser la `is_default_quest=true` si existe.
        // El `value` del select será el ID de esta primera opción.
        // Esto es bueno, ya que preselecciona la default.
    }


    return (
        <select 
            value={selectedQuestId || ""} // Si selectedQuestId es null/undefined, selecciona la opción con value="" (si existe, como en filtros)
                                      // o la primera opción de la lista si no hay opción con value="".
            onChange={handleChange}
            disabled={disabled || isLoading || (quests.length === 0 && !isFilter)}
            style={{minWidth: '150px'}}
        >
            {options}
        </select>
    );
}

export default QuestSelector;