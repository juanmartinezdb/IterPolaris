// frontend/src/pages/CalendarPage.jsx
import React, { useState, useEffect, useCallback, useContext, useRef } from 'react';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import enUS from 'date-fns/locale/en-US';
import axios from 'axios';

import { UserContext } from '../contexts/UserContext';
import ScheduledMissionForm from '../components/missions/scheduled/ScheduledMissionForm';
import CalendarMissionPool from '../components/calendar/CalendarMissionPool';
import EventActionMenu from '../components/calendar/EventActionMenu';
import HabitTemplateForm from '../components/habits/HabitTemplateForm';

import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import '../styles/calendar.css';
import '../styles/dialog.css';

const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });
const DragAndDropCalendar = withDragAndDrop(Calendar);

const API_SCHEDULED_MISSIONS_URL = `${import.meta.env.VITE_API_BASE_URL}/scheduled-missions`;
const API_HABIT_OCCURRENCES_URL = `${import.meta.env.VITE_API_BASE_URL}/habit-occurrences`;
const API_HABIT_TEMPLATES_URL = `${import.meta.env.VITE_API_BASE_URL}/habit-templates`;
const API_POOL_MISSIONS_URL = `${import.meta.env.VITE_API_BASE_URL}/pool-missions`;
const API_QUESTS_URL = `${import.meta.env.VITE_API_BASE_URL}/quests`;

function CalendarPage() {
    const { currentUser, refreshUserStatsAndEnergy } = useContext(UserContext);
    const [events, setEvents] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [infoMessage, setInfoMessage] = useState('');
    const [questColors, setQuestColors] = useState({});
    const [currentDate, setCurrentDate] = useState(new Date());
    const [currentView, setCurrentView] = useState(Views.WEEK);

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

    const clearInfoMessage = () => setTimeout(() => setInfoMessage(''), 4000);

    const fetchQuestColors = useCallback(async () => {
        const token = localStorage.getItem('authToken');
        if (!token) return;
        try {
            const response = await axios.get(API_QUESTS_URL, { headers: { 'Authorization': `Bearer ${token}` } });
            const colors = {};
            (response.data || []).forEach(quest => { colors[quest.id] = quest.color; });
            setQuestColors(colors);
        } catch (err) { console.error("CalendarPage: Failed to fetch quests for colors:", err); }
    }, []);

    const fetchCalendarEvents = useCallback(async (forceRefresh = false) => {
        if (!currentUser) return;
        if (!forceRefresh && isLoading) return;
        setIsLoading(true);
        setError(null);
        const token = localStorage.getItem('authToken');
        try {
            const [scheduledResponse, habitsResponse] = await Promise.all([
                axios.get(API_SCHEDULED_MISSIONS_URL, { headers: { 'Authorization': `Bearer ${token}` } }),
                axios.get(API_HABIT_OCCURRENCES_URL, { headers: { 'Authorization': `Bearer ${token}` } })
            ]);

            const scheduledMissions = (scheduledResponse.data || []).map(mission => ({
                id: `sm-${mission.id}`,
                title: mission.title,
                start: new Date(mission.start_datetime),
                end: new Date(mission.end_datetime),
                allDay: false,
                resource: { type: 'SCHEDULED_MISSION', original: mission, questId: mission.quest_id, status: mission.status },
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
                    status: occurrence.status 
                },
            }));
            setEvents([...scheduledMissions, ...habitOccurrences]);
        } catch (err) {
            setError(err.response?.data?.error || "Failed to fetch events.");
            setEvents([]);
        } finally {
            setIsLoading(false);
        }
    }, [currentUser, isLoading]);

    useEffect(() => { fetchQuestColors(); }, [fetchQuestColors]);
    useEffect(() => { if (currentUser) fetchCalendarEvents(true); }, [currentUser]);


    function getContrastColor(hexColor) {
        if (!hexColor || typeof hexColor !== 'string' || !hexColor.startsWith('#')) return 'var(--color-text-on-dark)';
        try {
            const r = parseInt(hexColor.slice(1, 3), 16), g = parseInt(hexColor.slice(3, 5), 16), b = parseInt(hexColor.slice(5, 7), 16);
            return (((r * 299) + (g * 587) + (b * 114)) / 1000) >= 128 ? 'var(--color-text-on-accent)' : 'var(--color-text-on-dark)';
        } catch (e) { return 'var(--color-text-on-dark)'; }
    }

    const eventStyleGetter = (event, start, end, isSelected) => {
        let backgroundColor = 'var(--color-accent-secondary)';
        const questId = event.resource?.questId;
        const status = event.resource?.status;
        const type = event.resource?.type;

        if (questId && questColors[questId]) {
            backgroundColor = questColors[questId];
        } else if (type === 'HABIT_OCCURRENCE') {
            backgroundColor = 'var(--color-purple-mystic)';
        }
        
        let opacity = 0.9;
        let textDecoration = 'none';
        let borderColor = isSelected ? 'var(--color-accent-gold-hover)' : 'var(--color-bg-elevated)';

        if (status === 'COMPLETED') {
            opacity = 0.6;
            textDecoration = 'line-through';
            if (type === 'HABIT_OCCURRENCE') backgroundColor = 'var(--color-success-dark)';
        } else if (status === 'SKIPPED') {
            opacity = 0.5;
            textDecoration = 'line-through';
            backgroundColor = 'var(--color-text-on-dark-muted)'; 
            borderColor = 'var(--color-text-on-dark-muted)';
        }
        
        return {
            style: {
                backgroundColor,
                borderRadius: '3px', opacity: opacity,
                color: getContrastColor(backgroundColor),
                border: `1px solid ${borderColor}`,
                display: 'block', padding: '3px 5px', fontSize: '0.85em',
                textDecoration: textDecoration,
                boxShadow: isSelected ? '0 0 5px var(--color-accent-gold)' : 'none',
            }
        };
    };

    const handleNavigate = useCallback((newDate) => setCurrentDate(newDate), []);
    const handleView = useCallback((newView) => setCurrentView(newView), []);

    const handleSelectSlot = useCallback(({ start, end }) => {
        closeActionMenu();
        setEditingScheduledMission(null);
        setSlotInfoForNewMission({ start, end });
        setShowScheduledMissionForm(true);
    }, []);

    const handleSelectEvent = useCallback((eventData, domEvent) => {
        domEvent.preventDefault();
        domEvent.stopPropagation();
        const calendarWrapper = calendarRef.current.querySelector('.rbc-calendar') || calendarRef.current;
        const calendarRect = calendarWrapper.getBoundingClientRect();
        let x = domEvent.clientX - calendarRect.left;
        let y = domEvent.clientY - calendarRect.top;
        const menuWidth = 180; 
        const menuHeight = eventData.resource?.type === 'SCHEDULED_MISSION' ? 180 : 120;
        if (x + menuWidth > calendarRect.width) x -= menuWidth;
        if (y + menuHeight > calendarRect.height) y -= menuHeight;
        setActionMenu({ visible: true, x: Math.max(0, x + 5), y: Math.max(0, y + 5), event: eventData });
    }, []);
    
    const closeActionMenu = useCallback(() => {
        setActionMenu({ visible: false, x: 0, y: 0, event: null });
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

    const handleMoveToPool = async (scheduledMission) => {
        // Removed window.confirm for agility
        const token = localStorage.getItem('authToken');
        setError(null);
        setInfoMessage('');
        try {
            const poolMissionPayload = {
                title: scheduledMission.title,
                description: scheduledMission.description,
                energy_value: scheduledMission.energy_value,
                points_value: scheduledMission.points_value,
                quest_id: scheduledMission.quest_id,
                tag_ids: scheduledMission.tags ? scheduledMission.tags.map(t => t.id) : [],
                focus_status: 'ACTIVE',
            };
            await axios.post(API_POOL_MISSIONS_URL, poolMissionPayload, { headers: { 'Authorization': `Bearer ${token}` } });
            await axios.delete(`${API_SCHEDULED_MISSIONS_URL}/${scheduledMission.id}`, { headers: { 'Authorization': `Bearer ${token}` } });

            setInfoMessage(`"${scheduledMission.title}" moved to Mission Pool.`);
            clearInfoMessage();
            fetchCalendarEvents(true);
            setRefreshPoolCounter(prev => prev + 1);
            refreshUserStatsAndEnergy();
        } catch (err) {
            setError(err.response?.data?.error || "Failed to move mission to pool.");
        }
    };

    const handleEventAction = async (action, eventData) => {
        closeActionMenu();
        const { type, original } = eventData.resource;
        const token = localStorage.getItem('authToken');
        let statusToSet = '';

        if (type === 'SCHEDULED_MISSION') {
            switch (action) {
                case 'edit_scheduled_mission':
                    setEditingScheduledMission(original);
                    setSlotInfoForNewMission(null);
                    setShowScheduledMissionForm(true);
                    return;
                case 'delete_scheduled_mission':
                    // Consider if a confirmation is needed here too, or if it should be direct
                    if (window.confirm(`Are you sure you want to delete "${original.title}"? This action is permanent.`)) {
                        try {
                            await axios.delete(`${API_SCHEDULED_MISSIONS_URL}/${original.id}`, { headers: { 'Authorization': `Bearer ${token}` } });
                            fetchCalendarEvents(true); refreshUserStatsAndEnergy();
                        } catch (err) { setError(err.response?.data?.error || "Failed to delete mission."); }
                    }
                    return;
                case 'move_to_pool':
                    handleMoveToPool(original); // Confirmation is removed from here
                    return;
                case 'complete': statusToSet = 'COMPLETED'; break;
                case 'skip': statusToSet = 'SKIPPED'; break;
                case 'pending': statusToSet = 'PENDING'; break;
                default: console.warn("Unknown scheduled mission action:", action); return;
            }
            if (statusToSet) {
                try {
                    await axios.patch(`${API_SCHEDULED_MISSIONS_URL}/${original.id}/status`, { status: statusToSet }, { headers: { 'Authorization': `Bearer ${token}` } });
                    fetchCalendarEvents(true); refreshUserStatsAndEnergy();
                } catch (err) { setError(err.response?.data?.error || `Failed to mark as ${statusToSet.toLowerCase()}.`); }
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
                        setEditingHabitTemplate(templateResponse.data);
                        setShowHabitTemplateForm(true);
                    } catch (err) { setError("Could not load habit definition for editing."); console.error("Error fetching habit template for edit:", err); }
                    return;
                case 'extend_habit':
                    try {
                        if (!habitTemplateId) { setError("Cannot extend habit: Template ID is missing."); return; }
                        const extendResponse = await axios.post(`${API_HABIT_TEMPLATES_URL}/${habitTemplateId}/generate-occurrences`, {}, { headers: { Authorization: `Bearer ${token}` } });
                        setInfoMessage(extendResponse.data.message || `Occurrences extended for "${original.title}".`);
                        clearInfoMessage();
                        fetchCalendarEvents(true);
                    } catch (err) { setError(err.response?.data?.error || "Failed to extend habit."); }
                    return;
                default: console.warn("Unknown habit occurrence action:", action); return;
            }
            if (statusToSet) {
                try {
                    await axios.patch(`${API_HABIT_OCCURRENCES_URL}/${original.id}/status`, { status: statusToSet }, { headers: { 'Authorization': `Bearer ${token}` } });
                    fetchCalendarEvents(true); refreshUserStatsAndEnergy();
                } catch (err) { setError(err.response?.data?.error || `Failed to update habit status to ${statusToSet.toLowerCase()}.`); }
            }
        }
    };
    
    const onEventOperation = useCallback(async (type, { event, start, end }) => {
        closeActionMenu();
        const { original } = event.resource;
        if (event.resource.type !== 'SCHEDULED_MISSION') return;
        const token = localStorage.getItem('authToken');
        const payload = {
            title: original.title, description: original.description,
            energy_value: original.energy_value, points_value: original.points_value,
            status: original.status, quest_id: original.quest_id,
            tag_ids: original.tags?.map(t => t.id) || [],
            start_datetime: start.toISOString(), end_datetime: end.toISOString(),
        };
        try {
            await axios.put(`${API_SCHEDULED_MISSIONS_URL}/${original.id}`, payload, { headers: { 'Authorization': `Bearer ${token}` } });
            fetchCalendarEvents(true);
        } catch (err) {
            setError(err.response?.data?.error || `Failed to ${type === 'move' ? 'move' : 'resize'} event.`);
            fetchCalendarEvents(true);
        }
    }, [fetchCalendarEvents]);
    
    const onEventDrop = useCallback((args) => {
        if (args.event.resource?.type === 'SCHEDULED_MISSION') {
             onEventOperation('move', args);
        } else {
            console.log("Habit occurrence drag attempt. Rescheduling deferred for future implementation.");
            fetchCalendarEvents(true); 
        }
    }, [onEventOperation, fetchCalendarEvents]);

    const onEventResize = useCallback((args) => onEventOperation('resize', args), [onEventOperation]);

    const handleDragStartExternal = useCallback((poolMission) => {
        setDraggedExternalMission(poolMission);
    }, []);
    
    const onDropFromOutside = useCallback(async ({ start }) => {
        closeActionMenu();
        if (!draggedExternalMission) return;
        const token = localStorage.getItem('authToken');
        const newScheduledMissionStart = start;
        const newScheduledMissionEnd = new Date(start.getTime() + 60 * 60 * 1000);

        const missionDataPayload = {
            title: draggedExternalMission.title,
            description: draggedExternalMission.description || null,
            energy_value: draggedExternalMission.energy_value,
            points_value: draggedExternalMission.points_value,
            start_datetime: newScheduledMissionStart.toISOString(),
            end_datetime: newScheduledMissionEnd.toISOString(),
            quest_id: draggedExternalMission.quest_id,
            tag_ids: draggedExternalMission.tags ? draggedExternalMission.tags.map(t => t.id) : [],
            status: 'PENDING',
        };
        try {
            await axios.post(API_SCHEDULED_MISSIONS_URL, missionDataPayload, { headers: { 'Authorization': `Bearer ${token}` } });
            await axios.delete(`${API_POOL_MISSIONS_URL}/${draggedExternalMission.id}`, { headers: { 'Authorization': `Bearer ${token}` } });
            fetchCalendarEvents(true);
            setRefreshPoolCounter(prev => prev + 1);
            refreshUserStatsAndEnergy();
        } catch (err) {
            setError(err.response?.data?.error || "Failed to convert pool mission.");
        } finally {
            setDraggedExternalMission(null);
        }
    }, [draggedExternalMission, fetchCalendarEvents, refreshUserStatsAndEnergy]);

    const dragFromOutsideItem = useCallback(() => {
        if (!draggedExternalMission) return null;
        return { title: `(Pool) ${draggedExternalMission.title}`, start: new Date(), end: new Date(new Date().getTime() + 60 * 60 * 1000) };
    }, [draggedExternalMission]);

    const customOnDragOver = useCallback((dragEvent) => {
        if (draggedExternalMission) dragEvent.preventDefault();
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

    if (isLoading && events.length === 0) return <div className="page-container"><p>Loading Calendar...</p></div>;
    
    return (
        <div className="page-container calendar-page-container">
            {error && <p className="auth-error-message" style={{textAlign: 'center', marginBottom: '1rem', width: '100%'}}>{error}</p>}
            {infoMessage && <p className="auth-success-message" style={{textAlign: 'center', marginBottom: '1rem', width: '100%'}}>{infoMessage}</p>}
            
            <div className="calendar-main-area" ref={calendarRef}>
                <h2>Your Calendar</h2>
                <div style={{ height: 'calc(100% - 4em)', position: 'relative' }}>
                    <DragAndDropCalendar
                        localizer={localizer}
                        events={events}
                        startAccessor="start"
                        endAccessor="end"
                        style={{ flexGrow: 1 }}
                        date={currentDate}
                        view={currentView}
                        onNavigate={handleNavigate}
                        onView={handleView}
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
                refreshTrigger={refreshPoolCounter} 
            />

            {showScheduledMissionForm && (
                <div className="dialog-overlay">
                    <div className="dialog-content" style={{maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto', textAlign: 'left'}}>
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
                    </div>
                </div>
            )}

            {showHabitTemplateForm && editingHabitTemplate && (
                 <div className="dialog-overlay">
                    <div className="dialog-content" style={{maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto', textAlign: 'left'}}>
                        <HabitTemplateForm
                            templateToEdit={editingHabitTemplate}
                            onFormSubmit={handleHabitTemplateFormSubmit}
                            onCancel={() => {
                                setShowHabitTemplateForm(false);
                                setEditingHabitTemplate(null);
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export default CalendarPage;