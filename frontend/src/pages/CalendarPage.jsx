// frontend/src/pages/CalendarPage.jsx
import React, { useState, useEffect, useCallback, useContext, useRef, useMemo } from 'react';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
// import enUS from 'date-fns/locale/en-US'; // en-GB se usará para startOfWeek
import enGB from 'date-fns/locale/en-GB';
import axios from 'axios';

import { UserContext } from '../contexts/UserContext';
import ScheduledMissionForm from '../components/missions/scheduled/ScheduledMissionForm';
import CalendarMissionPool from '../components/calendar/CalendarMissionPool';
import EventActionMenu from '../components/calendar/EventActionMenu';
import HabitTemplateForm from '../components/habits/HabitTemplateForm';
import Modal from '../components/common/Modal'; // Para los formularios
import ConfirmationDialog from '../components/common/ConfirmationDialog'; // Para confirmaciones de borrado
// PoolMissionForm no se usa directamente en CalendarPage para "crear", se usa el ScheduledMissionForm para conversión.
// Pero CalendarMissionPool lo usa internamente para editar.

import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import '../styles/calendar.css';
import '../styles/dialog.css'; // O asegúrate que esté global si Modal/ConfirmationDialog lo necesitan

const locales = {
    // 'en-US': enUS,
    'en-GB': enGB, // Usar en-GB para que la semana empiece en Lunes
};

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek: (date) => startOfWeek(date, { locale: locales['en-GB'] }), // Asegurar que la semana empiece en Lunes
    getDay,
    locales,
});

const DragAndDropCalendar = withDragAndDrop(Calendar);

const API_SCHEDULED_MISSIONS_URL = `${import.meta.env.VITE_API_BASE_URL}/scheduled-missions`;
const API_HABIT_OCCURRENCES_URL = `${import.meta.env.VITE_API_BASE_URL}/habit-occurrences`;
const API_HABIT_TEMPLATES_URL = `${import.meta.env.VITE_API_BASE_URL}/habit-templates`;
const API_POOL_MISSIONS_URL = `${import.meta.env.VITE_API_BASE_URL}/pool-missions`;
const API_QUESTS_URL = `${import.meta.env.VITE_API_BASE_URL}/quests`;

// Mover la función getContrastColor fuera del componente si no depende de su estado o props.
// O importarla desde utils si ya existe allí.
// Por ahora, la mantengo como la tenías para minimizar cambios estructurales en tu versión.
function getContrastColor(hexColor) {
    if (!hexColor || typeof hexColor !== 'string' || !hexColor.startsWith('#')) return 'var(--color-text-on-dark)';
    try {
        let r, g, b;
        if (hexColor.length === 4) { // Shorthand #RGB
            r = parseInt(hexColor[1] + hexColor[1], 16);
            g = parseInt(hexColor[2] + hexColor[2], 16);
            b = parseInt(hexColor[3] + hexColor[3], 16);
        } else if (hexColor.length === 7) { // Full #RRGGBB
            r = parseInt(hexColor.slice(1, 3), 16);
            g = parseInt(hexColor.slice(3, 5), 16);
            b = parseInt(hexColor.slice(5, 7), 16);
        } else {
            return 'var(--color-text-on-dark)'; // Formato inválido
        }
        return (((r * 299) + (g * 587) + (b * 114)) / 1000) >= 128 ? 'var(--color-text-on-accent)' : 'var(--color-text-on-dark)';
    } catch (e) {
        return 'var(--color-text-on-dark)';
    }
}


function CalendarPage({ activeTagFilters }) { // <--- AÑADIR PROP activeTagFilters
    const { currentUser, refreshUserStatsAndEnergy } = useContext(UserContext);
    const [events, setEvents] = useState([]);
    const [isLoading, setIsLoading] = useState(false); // isLoading para la carga inicial y refresh manual
    const [error, setError] = useState(null);
    const [infoMessage, setInfoMessage] = useState('');
    const [questColors, setQuestColors] = useState({});
    
    const [currentDate, setCurrentDate] = useState(() => {
        const savedDate = localStorage.getItem('calendarLastDate');
        return savedDate ? new Date(savedDate) : new Date();
    });
    const [currentView, setCurrentView] = useState(() => {
        return localStorage.getItem('calendarLastView') || Views.WEEK;
    });

    const [showScheduledMissionForm, setShowScheduledMissionForm] = useState(false);
    const [editingScheduledMission, setEditingScheduledMission] = useState(null);
    const [slotInfoForNewMission, setSlotInfoForNewMission] = useState(null);
    
    const [showHabitTemplateForm, setShowHabitTemplateForm] = useState(false);
    const [editingHabitTemplate, setEditingHabitTemplate] = useState(null);

    const [draggedExternalMission, setDraggedExternalMission] = useState(null);
    const [refreshPoolCounter, setRefreshPoolCounter] = useState(0); // Para refrescar CalendarMissionPool

    const [actionMenu, setActionMenu] = useState({
        visible: false, x: 0, y: 0, event: null,
    });
    const calendarRef = useRef(null);

    const clearInfoMessage = useCallback(() => setTimeout(() => setInfoMessage(''), 4000), []);

    // Persistir vista y fecha en localStorage
    useEffect(() => { localStorage.setItem('calendarLastView', currentView); }, [currentView]);
    useEffect(() => { localStorage.setItem('calendarLastDate', currentDate.toISOString()); }, [currentDate]);


    const fetchQuestColors = useCallback(async () => {
        const token = localStorage.getItem('authToken');
        if (!token || !currentUser) return;
        try {
            const response = await axios.get(API_QUESTS_URL, { headers: { 'Authorization': `Bearer ${token}` } });
            const colors = {};
            (response.data || []).forEach(quest => { colors[quest.id] = quest.color; });
            setQuestColors(colors);
        } catch (err) { console.error("CalendarPage: Failed to fetch quests for colors:", err); }
    }, [currentUser]);

    const fetchCalendarEvents = useCallback(async (forceRefresh = false) => {
        if (!currentUser) return;
        // Evitar múltiples cargas si ya está cargando, a menos que sea un forceRefresh
        if (!forceRefresh && isLoading) return; 
        
        setIsLoading(true);
        setError(null);
        const token = localStorage.getItem('authToken');

        // Crear parámetros para las llamadas API
        const params = new URLSearchParams();
        if (activeTagFilters && activeTagFilters.length > 0) {
            activeTagFilters.forEach(tagId => params.append('tags', tagId));
        }
        // El backend ya debería devolver solo 'PENDING' para ciertos contextos si es necesario,
        // o el frontend filtra después. Para el calendario, usualmente se muestran todos los estados.
        // Si un filtro de status específico para calendario se añade, iría aquí.

        try {
            const [scheduledResponse, habitsResponse] = await Promise.all([
                axios.get(API_SCHEDULED_MISSIONS_URL, { headers: { 'Authorization': `Bearer ${token}` }, params: new URLSearchParams(params) }), // Clonar params
                axios.get(API_HABIT_OCCURRENCES_URL, { headers: { 'Authorization': `Bearer ${token}` }, params: new URLSearchParams(params) })  // Clonar params
            ]);

            const scheduledMissions = (scheduledResponse.data || []).map(mission => ({
                id: `sm-${mission.id}`,
                title: mission.title,
                start: new Date(mission.start_datetime),
                end: new Date(mission.end_datetime),
                allDay: false, // Asumimos que no son allDay a menos que se especifique
                resource: { 
                    type: 'SCHEDULED_MISSION', 
                    original: mission, 
                    questId: mission.quest_id, 
                    status: mission.status,
                    tags: mission.tags || [] // Asegurar que tags exista
                },
            }));
            
            const habitOccurrences = (habitsResponse.data || []).map(occurrence => ({
                id: `ho-${occurrence.id}`,
                title: occurrence.title, 
                start: new Date(occurrence.scheduled_start_datetime),
                end: new Date(occurrence.scheduled_end_datetime),
                allDay: false, 
                resource: { 
                    type: 'HABIT_OCCURRENCE', 
                    original: occurrence, 
                    questId: occurrence.quest_id, 
                    status: occurrence.status,
                    habit_template_id: occurrence.habit_template_id, // Necesario para editar plantilla
                    tags: occurrence.tags || [] // Asumiendo que el backend ahora incluye tags de la plantilla
                },
            }));
            setEvents([...scheduledMissions, ...habitOccurrences]);
        } catch (err) {
            setError(err.response?.data?.error || "Failed to fetch events.");
            setEvents([]);
        } finally {
            setIsLoading(false);
        }
    // activeTagFilters añadido como dependencia
    }, [currentUser, isLoading, activeTagFilters]); 

    useEffect(() => { fetchQuestColors(); }, [fetchQuestColors]);
    
    useEffect(() => {
        if (currentUser) {
            // El primer fetchCalendarEvents se llamará debido al cambio en activeTagFilters
            // o si el currentUser cambia (ej. login).
            // Para refrescar cuando cambian los filtros, fetchCalendarEvents debe tener activeTagFilters en su dep array.
             fetchCalendarEvents(true); // Forzar un refresh si los filtros cambian
        } else {
            setEvents([]); // Limpiar eventos si no hay usuario
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps 
    }, [currentUser, activeTagFilters]); // fetchCalendarEvents ya está en useCallback con activeTagFilters

    const eventStyleGetter = useCallback((event, start, end, isSelected) => {
        let backgroundColor = 'var(--color-accent-secondary)'; // Un color por defecto
        const questId = event.resource?.questId;
        const status = event.resource?.status;
        const type = event.resource?.type;

        if (questId && questColors[questId]) {
            backgroundColor = questColors[questId];
        } else if (type === 'HABIT_OCCURRENCE' && (!questId || !questColors[questId])) {
            // Color por defecto específico para hábitos sin quest asignada o si el color de la quest no se encuentra
            backgroundColor = 'var(--color-purple-mystic, #6D21A9)';
        }
        
        let opacity = 0.95; // Un poco menos opaco por defecto
        let textDecoration = 'none';
        // Usar un color de borde que contraste o sea coherente con el estado
        let borderColor = isSelected ? 'var(--color-accent-gold-hover)' : backgroundColor; 

        if (status === 'COMPLETED') {
            opacity = 0.6;
            textDecoration = 'line-through';
             // Color de fondo diferente para completados para mejor diferenciación
            if (type === 'HABIT_OCCURRENCE') {
                backgroundColor = 'var(--color-success-dark, #3A8E5A)';
            } else { // Scheduled Mission completada
                // Un gris oscuro o un tono apagado del color de la quest
                backgroundColor = getContrastColor(backgroundColor) === 'var(--color-text-on-accent)' ? '#a9a9a9' : '#555555'; // Ejemplo
            }
        } else if (status === 'SKIPPED') {
            opacity = 0.5;
            textDecoration = 'line-through';
            backgroundColor = 'var(--color-text-on-dark-muted, #8892b0)'; 
            borderColor = 'var(--color-text-on-dark-muted)'; // Borde igual al fondo para skipped
        }
        
        return {
            style: {
                backgroundColor,
                borderRadius: '3px',
                opacity: opacity,
                color: getContrastColor(backgroundColor), // Usar la función de utilidad
                border: `1px solid ${borderColor}`,
                display: 'block',
                padding: '3px 5px', // Ajustar padding si es necesario
                fontSize: '0.85em', // Un poco más grande para legibilidad
                textDecoration: textDecoration,
                boxShadow: isSelected ? '0 0 5px var(--color-accent-gold)' : 'none', // Sombra para seleccionados
            }
        };
    }, [questColors]); // Añadir questColors a las dependencias

    const handleNavigate = useCallback((newDate) => {
        setCurrentDate(new Date(newDate));
    }, []);

    const handleView = useCallback((newView) => {
        setCurrentView(newView);
    }, []);
    
    const closeActionMenu = useCallback(() => {
        setActionMenu({ visible: false, x: 0, y: 0, event: null });
    }, []);

    const handleSelectSlot = useCallback(({ start, end }) => {
        closeActionMenu();
        setEditingScheduledMission(null); // Asegurar que no estamos editando
        setSlotInfoForNewMission({ start, end });
        setShowScheduledMissionForm(true);
    }, [closeActionMenu]); // closeActionMenu es dependencia

    const handleSelectEvent = useCallback((eventData, domEvent) => {
        domEvent.preventDefault();
        domEvent.stopPropagation();
        // Lógica para posicionar el menú (sin cambios)
        const calendarWrapper = calendarRef.current.querySelector('.rbc-calendar') || calendarRef.current;
        if (!calendarWrapper) return;
        const calendarRect = calendarWrapper.getBoundingClientRect();
        let x = domEvent.clientX - calendarRect.left;
        let y = domEvent.clientY - calendarRect.top;
        const menuWidth = 180; 
        const menuHeight = eventData.resource?.type === 'SCHEDULED_MISSION' ? 180 : 120; // Estimación
        if (x + menuWidth > calendarRect.width) x -= menuWidth; // Ajustar si se sale por la derecha
        if (y + menuHeight > calendarRect.height) y -= menuHeight; // Ajustar si se sale por abajo
        setActionMenu({ visible: true, x: Math.max(0, x + 5), y: Math.max(0, y + 5), event: eventData });
    }, []); 
    
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (actionMenu.visible && !event.target.closest('.event-action-menu')) {
                 closeActionMenu();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [actionMenu.visible, closeActionMenu]);

    const handleMoveToPool = async (scheduledMissionOriginal) => {
        const token = localStorage.getItem('authToken');
        setError(null); setInfoMessage('');
        try {
            const poolMissionPayload = {
                title: scheduledMissionOriginal.title, description: scheduledMissionOriginal.description,
                energy_value: scheduledMissionOriginal.energy_value, points_value: scheduledMissionOriginal.points_value,
                quest_id: scheduledMissionOriginal.quest_id,
                tag_ids: scheduledMissionOriginal.tags ? scheduledMissionOriginal.tags.map(t => t.id) : [],
                focus_status: 'ACTIVE',
            };
            await axios.post(API_POOL_MISSIONS_URL, poolMissionPayload, { headers: { 'Authorization': `Bearer ${token}` } });
            await axios.delete(`${API_SCHEDULED_MISSIONS_URL}/${scheduledMissionOriginal.id}`, { headers: { 'Authorization': `Bearer ${token}` } });
            setInfoMessage(`"${scheduledMissionOriginal.title}" moved to Mission Pool.`); clearInfoMessage();
            fetchCalendarEvents(true); // Forzar refresh
            setRefreshPoolCounter(prev => prev + 1); // Refrescar el pool del sidebar
            refreshUserStatsAndEnergy();
        } catch (err) { setError(err.response?.data?.error || "Failed to move mission to pool."); }
    };

    const handleEventAction = async (action, eventData) => {
        closeActionMenu();
        const { type, original } = eventData.resource;
        const token = localStorage.getItem('authToken');
        let statusToSet = '';

        if (type === 'SCHEDULED_MISSION') {
            switch (action) {
                case 'edit_scheduled_mission':
                    setEditingScheduledMission(original); setSlotInfoForNewMission(null); setShowScheduledMissionForm(true); return;
                case 'delete_scheduled_mission':
                    // Implementar confirmación aquí si es necesario, o llamar a una función que lo haga
                    if (window.confirm(`Are you sure you want to delete "${original.title}"? This action is permanent.`)) { // Simple confirm por ahora
                        try {
                            await axios.delete(`${API_SCHEDULED_MISSIONS_URL}/${original.id}`, { headers: { 'Authorization': `Bearer ${token}` } });
                            fetchCalendarEvents(true); refreshUserStatsAndEnergy();
                        } catch (err) { setError(err.response?.data?.error || "Failed to delete mission."); }
                    } return;
                case 'move_to_pool': handleMoveToPool(original); return;
                case 'complete': statusToSet = 'COMPLETED'; break;
                case 'skip': statusToSet = 'SKIPPED'; break;
                case 'pending': statusToSet = 'PENDING'; break;
                default: console.warn("Unknown SM action:", action); return;
            }
            if (statusToSet) {
                try {
                    await axios.patch(`${API_SCHEDULED_MISSIONS_URL}/${original.id}/status`, { status: statusToSet }, { headers: { 'Authorization': `Bearer ${token}` } });
                    fetchCalendarEvents(true); refreshUserStatsAndEnergy();
                } catch (err) { setError(err.response?.data?.error || `Failed to mark SM as ${statusToSet.toLowerCase()}.`); }
            }
        } else if (type === 'HABIT_OCCURRENCE') {
            const habitTemplateId = original.habit_template_id;
            switch (action) {
                case 'complete': statusToSet = 'COMPLETED'; break;
                case 'skip': statusToSet = 'SKIPPED'; break;
                case 'pending': statusToSet = 'PENDING'; break;
                case 'edit_habit_template':
                    try {
                        const templateResponse = await axios.get(`${API_HABIT_TEMPLATES_URL}/${habitTemplateId}`, { headers: { Authorization: `Bearer ${token}` } });
                        setEditingHabitTemplate(templateResponse.data); setShowHabitTemplateForm(true);
                    } catch (err) { setError("Could not load habit definition."); console.error("Err HO tmpl fetch:", err); } return;
                case 'extend_habit':
                    try {
                        if (!habitTemplateId) { setError("Cannot extend: Template ID missing."); return; }
                        const extendResponse = await axios.post(`${API_HABIT_TEMPLATES_URL}/${habitTemplateId}/generate-occurrences`, {}, { headers: { Authorization: `Bearer ${token}` } });
                        setInfoMessage(extendResponse.data.message || `Occurrences extended.`); clearInfoMessage();
                        fetchCalendarEvents(true);
                    } catch (err) { setError(err.response?.data?.error || "Failed to extend habit."); } return;
                default: console.warn("Unknown HO action:", action); return;
            }
            if (statusToSet) {
                try {
                    await axios.patch(`${API_HABIT_OCCURRENCES_URL}/${original.id}/status`, { status: statusToSet }, { headers: { 'Authorization': `Bearer ${token}` } });
                    fetchCalendarEvents(true); refreshUserStatsAndEnergy();
                } catch (err) { setError(err.response?.data?.error || `Failed to update HO status.`); }
            }
        }
    };
    
    const onEventOperation = useCallback(async (operationType, { event, start, end }) => {
        closeActionMenu();
        const { original } = event.resource; // Asumimos que 'original' está en event.resource
        if (event.resource.type !== 'SCHEDULED_MISSION') return; // Solo para ScheduledMissions por ahora
        
        const token = localStorage.getItem('authToken');
        const payload = {
            title: original.title, 
            description: original.description,
            energy_value: original.energy_value, 
            points_value: original.points_value,
            status: original.status, // Mantener status actual al mover/redimensionar
            quest_id: original.quest_id,
            tag_ids: original.tags?.map(t => t.id) || [], // Asegurarse que tags sea un array de IDs
            start_datetime: start.toISOString(), 
            end_datetime: end.toISOString(),
        };
        try {
            await axios.put(`${API_SCHEDULED_MISSIONS_URL}/${original.id}`, payload, { headers: { 'Authorization': `Bearer ${token}` } });
            fetchCalendarEvents(true); // Forzar refresh del calendario
        } catch (err) {
            setError(err.response?.data?.error || `Failed to ${operationType === 'move' ? 'move' : 'resize'} event.`);
            fetchCalendarEvents(true); // Re-fetch incluso en error para restaurar estado visual
        }
    }, [fetchCalendarEvents, closeActionMenu]); // Añadir closeActionMenu
    
    // onEventDrop y onEventResize usan onEventOperation
    const onEventDrop = useCallback((args) => {
        if (args.event.resource?.type === 'SCHEDULED_MISSION') {
             onEventOperation('move', args);
        } else {
            // PRD: "For MVP, individual habit occurrences cannot be rescheduled independently of the template."
            setInfoMessage("Habit occurrences cannot be rescheduled this way. Edit the habit definition instead.");
            clearInfoMessage();
            fetchCalendarEvents(true); // Re-fetch para asegurar que el evento no se movió visualmente por error
        }
    }, [onEventOperation, fetchCalendarEvents, clearInfoMessage, setInfoMessage]);

    const onEventResize = useCallback((args) => onEventOperation('resize', args), [onEventOperation]);

    const handleDragStartExternal = useCallback((poolMission) => {
        setDraggedExternalMission(poolMission);
    }, []);
    
    const onDropFromOutside = useCallback(async ({ start, end }) => { // 'end' también es provisto por RBC
        closeActionMenu();
        if (!draggedExternalMission) return;
        
        // Abrir el formulario de ScheduledMission con datos pre-rellenados del PoolMission
        setEditingScheduledMission(draggedExternalMission); // Usar el PoolMission como base para editar
        setSlotInfoForNewMission({ 
            start, 
            end: end || new Date(start.getTime() + 60 * 60 * 1000), // Si 'end' no está, default a 1 hora
            convertingPoolMissionId: draggedExternalMission.id // Flag para el form
        });
        setShowScheduledMissionForm(true);
        setDraggedExternalMission(null); // Limpiar el estado de arrastre
    }, [draggedExternalMission, closeActionMenu]);


    const dragFromOutsideItem = useCallback(() => {
        // Esto es solo para la previsualización mientras se arrastra
        if (!draggedExternalMission) return null;
        return { title: `(Pool) ${draggedExternalMission.title}`, start: new Date(), end: new Date(new Date().getTime() + 60 * 60 * 1000) };
    }, [draggedExternalMission]);

    const customOnDragOver = useCallback((dragEvent) => {
        // Permitir soltar si es un elemento externo que estamos manejando
        if (draggedExternalMission) {
            dragEvent.preventDefault();
        }
    }, [draggedExternalMission]);

    const handleScheduledMissionFormSubmit = async (isConversionSuccess = false) => {
        setShowScheduledMissionForm(false);
        setEditingScheduledMission(null);
        setSlotInfoForNewMission(null);
        fetchCalendarEvents(true); // Forzar refresh
        if(isConversionSuccess) setRefreshPoolCounter(prev => prev + 1); // Refrescar pool si fue conversión
        refreshUserStatsAndEnergy();
    };
    
    const handleHabitTemplateFormSubmit = () => {
        setShowHabitTemplateForm(false);
        setEditingHabitTemplate(null);
        fetchCalendarEvents(true); // Forzar refresh
        refreshUserStatsAndEnergy(); 
        setInfoMessage("Habit definition updated. Future occurrences regenerated.");
        clearInfoMessage();
    };

    const draggableAccessor = (event) => {
        // Solo las ScheduledMissions PENDIENTES son arrastrables
        if (event.resource?.type === 'SCHEDULED_MISSION') {
            return event.resource?.status === 'PENDING';
        }
        return false; // HabitOccurrences no son arrastrables según PRD MVP
    };
    const resizableAccessor = (event) => event.resource?.type === 'SCHEDULED_MISSION' && event.resource?.status === 'PENDING';
    
    const scrollToTime = useMemo(() => {
        const todayAt7AM = new Date();
        todayAt7AM.setHours(7, 0, 0, 0);
        return todayAt7AM;
    }, []);

    if (isLoading && events.length === 0 && !currentUser) { // Modificado para solo mostrar si no hay usuario Y está cargando
        return <div className="page-container"><p>Please log in to see your calendar.</p></div>;
    }
    if (isLoading && events.length === 0 && currentUser) {
         return <div className="page-container"><p>Loading Calendar...</p></div>;
    }
    
    return (
        <div className="page-container calendar-page-container">
            {error && <p className="auth-error-message" style={{textAlign: 'center', marginBottom: '1rem', width: '100%'}}>{error}</p>}
            {infoMessage && <p className="auth-success-message" style={{textAlign: 'center', marginBottom: '1rem', width: '100%'}}>{infoMessage}</p>}
            
            <div className="calendar-main-area" ref={calendarRef}>
                <h2>Your Calendar</h2>
                {/* Wrapper para el calendario para mejor control de altura */}
                <div className="calendar-wrapper"> 
                    <DragAndDropCalendar
                        localizer={localizer}
                        events={events}
                        date={currentDate} // Controlado
                        view={currentView}   // Controlado
                        onNavigate={handleNavigate}
                        onView={handleView}
                        startAccessor="start"
                        endAccessor="end"
                        className="rbc-calendar-container" // Para aplicar estilos específicos al contenedor del calendario
                        views={[Views.MONTH, Views.WEEK, Views.DAY]} 
                        selectable
                        onSelectSlot={handleSelectSlot}
                        onSelectEvent={handleSelectEvent}
                        eventPropGetter={eventStyleGetter}
                        
                        draggableAccessor={draggableAccessor}
                        resizableAccessor={resizableAccessor}
                        onEventDrop={onEventDrop}
                        onEventResize={onEventResize}
                        
                        onDropFromOutside={onDropFromOutside}
                        dragFromOutsideItem={dragFromOutsideItem} 
                        onDragOver={customOnDragOver} // Necesario para que onDropFromOutside funcione correctamente
                        step={30}
                        timeslots={2} // Cada media hora
                        popup // Para manejar eventos superpuestos en la vista mensual
                        scrollToTime={scrollToTime} // Scroll a las 7 AM en vistas de día/semana
                        culture='en-GB' // Para formato de fecha y primer día de la semana (Lunes)
                        messages={{ // Personalizar textos si es necesario
                            today: "Today",
                            previous: "Back",
                            next: "Next",
                            month: "Month",
                            week: "Week",
                            day: "Day",
                            agenda: "Agenda",
                            showMore: total => `+${total} more`
                        }}
                    />
                    {actionMenu.visible && actionMenu.event && (
                        <EventActionMenu
                            x={actionMenu.x}
                            y={actionMenu.y}
                            event={actionMenu.event}
                            onClose={closeActionMenu}
                            onAction={handleEventAction}
                        />
                    )}
                </div>
            </div>
            <CalendarMissionPool 
                onDragStartPoolMission={handleDragStartExternal} 
                activeTagFilters={activeTagFilters} // Pasar filtros de tags globales
                refreshTrigger={refreshPoolCounter} 
                // Las funciones de edición/borrado para PoolMissions aquí son manejadas por el propio CalendarMissionPool si es necesario
                // o podrían ser pasadas si CalendarPage necesitara coordinar algo más.
            />

            {/* Modales para formularios */}
            {showScheduledMissionForm && (
                <Modal 
                    title={editingScheduledMission && !slotInfoForNewMission?.convertingPoolMissionId ? "Edit Scheduled Mission" : (slotInfoForNewMission?.convertingPoolMissionId ? "Convert Pool Mission" : "Create Scheduled Mission")}
                    onClose={() => { setShowScheduledMissionForm(false); setEditingScheduledMission(null); setSlotInfoForNewMission(null); }}
                >
                    <ScheduledMissionForm
                        missionToEdit={editingScheduledMission} // Si es conversión, editingScheduledMission es el PoolMission
                        slotInfo={slotInfoForNewMission}
                        onFormSubmit={handleScheduledMissionFormSubmit}
                        onCancel={() => {
                            setShowScheduledMissionForm(false);
                            setEditingScheduledMission(null);
                            setSlotInfoForNewMission(null);
                        }}
                    />
                </Modal>
            )}

            {showHabitTemplateForm && editingHabitTemplate && (
                 <Modal 
                    title="Edit Habit Definition" 
                    onClose={() => { setShowHabitTemplateForm(false); setEditingHabitTemplate(null); }}
                >
                    <HabitTemplateForm
                        templateToEdit={editingHabitTemplate}
                        onFormSubmit={handleHabitTemplateFormSubmit}
                        onCancel={() => {
                            setShowHabitTemplateForm(false);
                            setEditingHabitTemplate(null);
                        }}
                    />
                </Modal>
            )}
        </div>
    );
}

export default CalendarPage;