// frontend/src/pages/CalendarPage.jsx
import React, { useState, useEffect, useCallback, useContext, useRef, useMemo } from 'react';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
// import enUS from 'date-fns/locale/en-US'; 
import enGB from 'date-fns/locale/en-GB';
import axios from 'axios';
import { getContrastColor } from '../utils/colorUtils';

import { UserContext } from '../contexts/UserContext';
import ScheduledMissionForm from '../components/missions/scheduled/ScheduledMissionForm';
import CalendarMissionPool from '../components/calendar/CalendarMissionPool';
import EventActionMenu from '../components/calendar/EventActionMenu';
import HabitTemplateForm from '../components/habits/HabitTemplateForm';
import Modal from '../components/common/Modal'; 
import ConfirmationDialog from '../components/common/ConfirmationDialog'; 


import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import '../styles/calendar.css';
import '../styles/dialog.css'; 

const locales = {
    'en-GB': enGB, 
};

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek: (date) => startOfWeek(date, { locale: locales['en-GB'] }), 
    getDay,
    locales,
});

const DragAndDropCalendar = withDragAndDrop(Calendar);

const API_SCHEDULED_MISSIONS_URL = `${import.meta.env.VITE_API_BASE_URL}/scheduled-missions`;
const API_HABIT_OCCURRENCES_URL = `${import.meta.env.VITE_API_BASE_URL}/habit-occurrences`;
const API_HABIT_TEMPLATES_URL = `${import.meta.env.VITE_API_BASE_URL}/habit-templates`;
const API_POOL_MISSIONS_URL = `${import.meta.env.VITE_API_BASE_URL}/pool-missions`;
const API_QUESTS_URL = `${import.meta.env.VITE_API_BASE_URL}/quests`;


function CalendarPage({ activeTagFilters }) { 
    const { currentUser, refreshUserStatsAndEnergy } = useContext(UserContext);
    const [events, setEvents] = useState([]);
    const [isLoading, setIsLoading] = useState(false); 
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
    const [refreshPoolCounter, setRefreshPoolCounter] = useState(0); 

    const [actionMenu, setActionMenu] = useState({
        visible: false, x: 0, y: 0, event: null,
    });
    const calendarRef = useRef(null);

    const clearInfoMessage = useCallback(() => setTimeout(() => setInfoMessage(''), 4000), []);

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
        if (!forceRefresh && isLoading) return; 
        
        setIsLoading(true);
        setError(null);
        const token = localStorage.getItem('authToken');

        const params = new URLSearchParams();
        if (activeTagFilters && activeTagFilters.length > 0) {
            activeTagFilters.forEach(tagId => params.append('tags', tagId));
        }
        
        try {
            const [scheduledResponse, habitsResponse] = await Promise.all([
                axios.get(API_SCHEDULED_MISSIONS_URL, { headers: { 'Authorization': `Bearer ${token}` }, params: new URLSearchParams(params) }), 
                axios.get(API_HABIT_OCCURRENCES_URL, { headers: { 'Authorization': `Bearer ${token}` }, params: new URLSearchParams(params) })  
            ]);

            const scheduledMissions = (scheduledResponse.data || []).map(mission => ({
                id: `sm-${mission.id}`,
                title: mission.title,
                start: new Date(mission.start_datetime),
                end: new Date(mission.end_datetime),
                allDay: false, 
                resource: { 
                    type: 'SCHEDULED_MISSION', 
                    original: mission, 
                    questId: mission.quest_id, 
                    status: mission.status,
                    tags: mission.tags || [] 
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
                    habit_template_id: occurrence.habit_template_id, 
                    tags: occurrence.tags || [] 
                },
            }));
            setEvents([...scheduledMissions, ...habitOccurrences]);
        } catch (err) {
            setError(err.response?.data?.error || "Failed to fetch events.");
            setEvents([]);
        } finally {
            setIsLoading(false);
        }
    }, [currentUser, isLoading, activeTagFilters]); 

    useEffect(() => { fetchQuestColors(); }, [fetchQuestColors]);
    
    useEffect(() => {
        if (currentUser) {
             fetchCalendarEvents(true); 
        } else {
            setEvents([]); 
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps 
    }, [currentUser, activeTagFilters]); 

    const eventStyleGetter = useCallback((event, start, end, isSelected) => {
        let backgroundColor = 'var(--color-accent-secondary)'; 
        const questId = event.resource?.questId;
        const status = event.resource?.status;
        const type = event.resource?.type;

        if (questId && questColors[questId]) {
            backgroundColor = questColors[questId];
        } else if (type === 'HABIT_OCCURRENCE' && (!questId || !questColors[questId])) {
            backgroundColor = 'var(--color-purple-mystic, #6D21A9)';
        }
        
        let opacity = 0.95; 
        let textDecoration = 'none';
        let borderColor = isSelected ? 'var(--color-accent-gold-hover)' : backgroundColor; 

        if (status === 'COMPLETED') {
            opacity = 0.6;
            textDecoration = 'line-through';
            if (type === 'HABIT_OCCURRENCE') {
                backgroundColor = 'var(--color-success-dark, #3A8E5A)';
            } else { 
                backgroundColor = getContrastColor(backgroundColor) === 'var(--color-text-on-accent)' ? '#a9a9a9' : '#555555'; 
            }
        } else if (status === 'SKIPPED') {
            opacity = 0.5;
            textDecoration = 'line-through';
            backgroundColor = 'var(--color-text-on-dark-muted, #8892b0)'; 
            borderColor = 'var(--color-text-on-dark-muted)'; 
        }
        
        return {
            style: {
                backgroundColor,
                borderRadius: '3px',
                opacity: opacity,
                color: getContrastColor(backgroundColor), 
                border: `1px solid ${borderColor}`,
                display: 'block',
                padding: '3px 5px', 
                fontSize: '0.85em', 
                textDecoration: textDecoration,
                boxShadow: isSelected ? '0 0 5px var(--color-accent-gold)' : 'none', 
            }
        };
    }, [questColors]); 

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
        setEditingScheduledMission(null); 
        setSlotInfoForNewMission({ start, end });
        setShowScheduledMissionForm(true);
    }, [closeActionMenu]); 

    const handleSelectEvent = useCallback((eventData, domEvent) => {
        domEvent.preventDefault();
        domEvent.stopPropagation();
        const calendarWrapper = calendarRef.current.querySelector('.rbc-calendar') || calendarRef.current;
        if (!calendarWrapper) return;
        const calendarRect = calendarWrapper.getBoundingClientRect();
        let x = domEvent.clientX - calendarRect.left;
        let y = domEvent.clientY - calendarRect.top;
        const menuWidth = 180; 
        const menuHeight = eventData.resource?.type === 'SCHEDULED_MISSION' ? 180 : 120; 
        if (x + menuWidth > calendarRect.width) x -= menuWidth; 
        if (y + menuHeight > calendarRect.height) y -= menuHeight; 
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
            fetchCalendarEvents(true); 
            setRefreshPoolCounter(prev => prev + 1); 
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
                    if (window.confirm(`Are you sure you want to delete "${original.title}"? This action is permanent.`)) { 
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
        const { original } = event.resource; 
        if (event.resource.type !== 'SCHEDULED_MISSION') return; 
        
        const token = localStorage.getItem('authToken');
        const payload = {
            title: original.title, 
            description: original.description,
            energy_value: original.energy_value, 
            points_value: original.points_value,
            status: original.status, 
            quest_id: original.quest_id,
            tag_ids: original.tags?.map(t => t.id) || [], 
            start_datetime: start.toISOString(), 
            end_datetime: end.toISOString(),
        };
        try {
            await axios.put(`${API_SCHEDULED_MISSIONS_URL}/${original.id}`, payload, { headers: { 'Authorization': `Bearer ${token}` } });
            fetchCalendarEvents(true); 
        } catch (err) {
            setError(err.response?.data?.error || `Failed to ${operationType === 'move' ? 'move' : 'resize'} event.`);
            fetchCalendarEvents(true); 
        }
    }, [fetchCalendarEvents, closeActionMenu]); 
    
    const onEventDrop = useCallback((args) => {
        if (args.event.resource?.type === 'SCHEDULED_MISSION') {
             onEventOperation('move', args);
        } else {
            setInfoMessage("Habit occurrences cannot be rescheduled this way. Edit the habit definition instead.");
            clearInfoMessage();
            fetchCalendarEvents(true); 
        }
    }, [onEventOperation, fetchCalendarEvents, clearInfoMessage, setInfoMessage]);

    const onEventResize = useCallback((args) => onEventOperation('resize', args), [onEventOperation]);

    const handleDragStartExternal = useCallback((poolMission) => {
        setDraggedExternalMission(poolMission);
    }, []);
    
    // *** MODIFIED onDropFromOutside ***
    const onDropFromOutside = useCallback(async ({ start, end }) => { 
        closeActionMenu();
        if (!draggedExternalMission) return;
        const token = localStorage.getItem('authToken');
        
        // Asegurar que 'end' tenga un valor. Si es una vista de día completo, 'end' podría ser igual a 'start'.
        // O si se suelta en un slot de tiempo muy corto. Daremos una duración por defecto si 'end' no es significativamente mayor que 'start'.
        let finalEnd = end;
        if (!end || end.getTime() <= start.getTime()) {
            finalEnd = new Date(start.getTime() + 60 * 60 * 1000); // Default a 1 hora de duración
        }

        const missionDataPayload = {
            title: draggedExternalMission.title,
            description: draggedExternalMission.description || null,
            energy_value: draggedExternalMission.energy_value,
            points_value: draggedExternalMission.points_value,
            start_datetime: start.toISOString(),
            end_datetime: finalEnd.toISOString(),
            quest_id: draggedExternalMission.quest_id,
            tag_ids: draggedExternalMission.tags ? draggedExternalMission.tags.map(t => t.id) : [],
            status: 'PENDING', // Nueva misión programada siempre es PENDING
        };

        try {
            // 1. Crear la nueva ScheduledMission
            await axios.post(API_SCHEDULED_MISSIONS_URL, missionDataPayload, { headers: { 'Authorization': `Bearer ${token}` } });
            
            // 2. Borrar la PoolMission original
            await axios.delete(`${API_POOL_MISSIONS_URL}/${draggedExternalMission.id}`, { headers: { 'Authorization': `Bearer ${token}` } });
            
            // 3. Refrescar datos y UI
            fetchCalendarEvents(true); // Refrescar eventos del calendario
            setRefreshPoolCounter(prev => prev + 1); // Refrescar el pool de misiones en el sidebar
            refreshUserStatsAndEnergy(); // Actualizar estadísticas del usuario si aplica (aunque la creación directa de SM no da puntos/energía)
            setInfoMessage(`"${draggedExternalMission.title}" scheduled successfully from pool.`);
            clearInfoMessage();

        } catch (err) {
            console.error("Failed to convert pool mission:", err.response?.data || err.message);
            setError(err.response?.data?.error || "Failed to convert pool mission.");
        } finally {
            setDraggedExternalMission(null); // Limpiar el estado de arrastre
        }
    }, [draggedExternalMission, fetchCalendarEvents, refreshUserStatsAndEnergy, closeActionMenu, clearInfoMessage, setInfoMessage]);


    const dragFromOutsideItem = useCallback(() => {
        if (!draggedExternalMission) return null;
        return { title: `(Pool) ${draggedExternalMission.title}`, start: new Date(), end: new Date(new Date().getTime() + 60 * 60 * 1000) };
    }, [draggedExternalMission]);

    const customOnDragOver = useCallback((dragEvent) => {
        if (draggedExternalMission) {
            dragEvent.preventDefault();
        }
    }, [draggedExternalMission]);

    const handleScheduledMissionFormSubmit = async (isConversionSuccess = false) => {
        setShowScheduledMissionForm(false);
        setEditingScheduledMission(null);
        setSlotInfoForNewMission(null);
        fetchCalendarEvents(true); 
        if(isConversionSuccess) setRefreshPoolCounter(prev => prev + 1); 
        refreshUserStatsAndEnergy();
    };
    
    const handleHabitTemplateFormSubmit = () => {
        setShowHabitTemplateForm(false);
        setEditingHabitTemplate(null);
        fetchCalendarEvents(true); 
        refreshUserStatsAndEnergy(); 
        setInfoMessage("Habit definition updated. Future occurrences regenerated.");
        clearInfoMessage();
    };

    const draggableAccessor = (event) => {
        if (event.resource?.type === 'SCHEDULED_MISSION') {
            return event.resource?.status === 'PENDING';
        }
        return false; 
    };
    const resizableAccessor = (event) => event.resource?.type === 'SCHEDULED_MISSION' && event.resource?.status === 'PENDING';
    
    const scrollToTime = useMemo(() => {
        const todayAt7AM = new Date();
        todayAt7AM.setHours(7, 0, 0, 0);
        return todayAt7AM;
    }, []);

    if (isLoading && events.length === 0 && !currentUser) { 
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
                <div className="calendar-wrapper"> 
                    <DragAndDropCalendar
                        localizer={localizer}
                        events={events}
                        date={currentDate} 
                        view={currentView}   
                        onNavigate={handleNavigate}
                        onView={handleView}
                        startAccessor="start"
                        endAccessor="end"
                        className="rbc-calendar-container" 
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
                        onDragOver={customOnDragOver} 
                        step={30}
                        timeslots={2} 
                        popup 
                        scrollToTime={scrollToTime} 
                        culture='en-GB' 
                        messages={{ 
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
                activeTagFilters={activeTagFilters} 
                refreshTrigger={refreshPoolCounter} 
            />

            {showScheduledMissionForm && (
                <Modal 
                    title={editingScheduledMission && !slotInfoForNewMission?.convertingPoolMissionId ? "Edit Scheduled Mission" : (slotInfoForNewMission?.convertingPoolMissionId ? "Convert Pool Mission" : "Create Scheduled Mission")}
                    onClose={() => { setShowScheduledMissionForm(false); setEditingScheduledMission(null); setSlotInfoForNewMission(null); }}
                >
                    <ScheduledMissionForm
                        missionToEdit={editingScheduledMission} 
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