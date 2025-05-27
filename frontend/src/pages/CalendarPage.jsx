// frontend/src/pages/CalendarPage.jsx
import React, { useState, useEffect, useCallback, useContext, useRef, useMemo } from 'react';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { format as formatDateFns } from 'date-fns/format';
import { parse as parseDateFns } from 'date-fns/parse';
import { startOfWeek as startOfWeekDateFns } from 'date-fns/startOfWeek';
import { getDay as getDayDateFns } from 'date-fns/getDay';
import enGB from 'date-fns/locale/en-GB';
import axios from 'axios';

import { UserContext } from '../contexts/UserContext';
import CustomEventComponent from '../components/calendar/CustomEventComponent';
import ScheduledMissionForm from '../components/missions/scheduled/ScheduledMissionForm';
import CalendarMissionPool from '../components/calendar/CalendarMissionPool';
import EventActionMenu from '../components/calendar/EventActionMenu';
import HabitTemplateForm from '../components/habits/HabitTemplateForm';
import Modal from '../components/common/Modal';
import ConfirmationDialog from '../components/common/ConfirmationDialog';

import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import '../styles/calendar.css';

const locales = { 'en-GB': enGB };
const localizer = dateFnsLocalizer({
    format: formatDateFns,
    parse: parseDateFns,
    startOfWeek: (date) => startOfWeekDateFns(date, { locale: locales['en-GB'], weekStartsOn: 1 }),
    getDay: getDayDateFns,
    locales,
});

const DragAndDropCalendar = withDragAndDrop(Calendar);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const API_SCHEDULED_MISSIONS_URL = `${API_BASE_URL}/scheduled-missions`;
const API_HABIT_OCCURRENCES_URL = `${API_BASE_URL}/habit-occurrences`;
const API_HABIT_TEMPLATES_URL = `${API_BASE_URL}/habit-templates`;
const API_POOL_MISSIONS_URL = `${API_BASE_URL}/pool-missions`;
const API_QUESTS_URL = `${API_BASE_URL}/quests`;

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

    const [showModal, setShowModal] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalContent, setModalContent] = useState(null);

    const [editingItem, setEditingItem] = useState(null);
    const [formType, setFormType] = useState('');
    const [slotInfoForNewMission, setSlotInfoForNewMission] = useState(null);

    const [draggedExternalMission, setDraggedExternalMission] = useState(null);
    const [refreshPoolCounter, setRefreshPoolCounter] = useState(0);

    const [actionMenu, setActionMenu] = useState({ visible: false, x: 0, y: 0, event: null });
    const calendarRef = useRef(null); // Ref for the main calendar div for positioning calculations

    const [showConfirmDeleteDialog, setShowConfirmDeleteDialog] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [itemTypeToDelete, setItemTypeToDelete] = useState('');

    const clearInfoMessage = useCallback(() => setTimeout(() => setInfoMessage(''), 4000), []);

    useEffect(() => { localStorage.setItem('calendarLastView', currentView); }, [currentView]);
    useEffect(() => { localStorage.setItem('calendarLastDate', currentDate.toISOString()); }, [currentDate]);

    const fetchQuestColors = useCallback(async () => {
        const token = localStorage.getItem('authToken');
        if (!token || !currentUser) return;
        try {
            const response = await axios.get(API_QUESTS_URL, { headers: { Authorization: `Bearer ${token}` } });
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
                axios.get(API_SCHEDULED_MISSIONS_URL, { headers: { Authorization: `Bearer ${token}` }, params: new URLSearchParams(params) }),
                axios.get(API_HABIT_OCCURRENCES_URL, { headers: { Authorization: `Bearer ${token}` }, params: new URLSearchParams(params) })
            ]);

            const scheduledMissions = (scheduledResponse.data || []).map(mission => ({
                id: `sm-${mission.id}`, title: mission.title,
                start: new Date(mission.start_datetime), end: new Date(mission.end_datetime),
                allDay: mission.is_all_day || false,
                resource: { type: 'SCHEDULED_MISSION', original: mission, questId: mission.quest_id, status: mission.status, tags: mission.tags || [] },
            }));

            const habitOccurrences = (habitsResponse.data || []).map(occurrence => ({
                id: `ho-${occurrence.id}`, title: occurrence.title,
                start: new Date(occurrence.scheduled_start_datetime), end: new Date(occurrence.scheduled_end_datetime),
                allDay: occurrence.is_all_day || false,
                resource: { type: 'HABIT_OCCURRENCE', original: occurrence, questId: occurrence.quest_id, status: occurrence.status, habit_template_id: occurrence.habit_template_id, tags: occurrence.template_tags || occurrence.template?.tags || [] },
            }));
            setEvents([...scheduledMissions, ...habitOccurrences]);
        } catch (err) {
            setError(err.response?.data?.error || "Failed to fetch events.");
            setEvents([]);
        } finally { setIsLoading(false); }
    }, [currentUser, isLoading, activeTagFilters]);

    useEffect(() => { fetchQuestColors(); }, [fetchQuestColors]);
    useEffect(() => { if (currentUser) { fetchCalendarEvents(true); } else { setEvents([]); } }, [currentUser, activeTagFilters, fetchCalendarEvents]);

    const components = useMemo(() => ({
        event: (props) => <CustomEventComponent {...props} questColors={questColors} />
    }), [questColors]);

    const formats = useMemo(() => ({
        eventTimeRangeFormat: () => '',
        agendaTimeRangeFormat: ({ start, end }, culture, localizer) =>
            localizer.format(start, 'HH:mm', culture) + ' – ' + localizer.format(end, 'HH:mm', culture),
        dayFormat: (date, culture, localizer) => localizer.format(date, 'EEE dd/MM', culture),
        weekdayFormat: (date, culture, localizer) => localizer.format(date, 'EEE', culture),
        selectRangeFormat: ({ start, end }, culture, localizer) =>
            localizer.format(start, 'HH:mm', culture) + ' – ' + localizer.format(end, 'HH:mm', culture),
        timeGutterFormat: (date, culture, localizer) => localizer.format(date, 'HH:mm', culture),
    }), []);

    const tooltipAccessor = useCallback((event) => {
        if (!event || !event.resource || !event.resource.original) return event.title;
        const { original } = event.resource;
        const startTimeStr = original.scheduled_start_datetime || event.start;
        const endTimeStr = original.scheduled_end_datetime || event.end;
        const startTimeFormatted = formatDateFns(new Date(startTimeStr), 'HH:mm');
        const endTimeFormatted = formatDateFns(new Date(endTimeStr), 'HH:mm');
        const dateFormatted = formatDateFns(new Date(startTimeStr), 'MMM d, yyyy');
        let tooltipText = `${event.title || original.title}\n`;
        if (event.allDay || original.is_all_day) {
            tooltipText += `Date: ${dateFormatted} (All-day)\n`;
        } else {
            tooltipText += `Time: ${startTimeFormatted} - ${endTimeFormatted} (${dateFormatted})\n`;
        }
        const description = original.description;
        if (description) {
            tooltipText += `Description: ${description.substring(0, 150)}${description.length > 150 ? '...' : ''}`;
        } else {
            tooltipText += `Description: Not provided.`;
        }
        return tooltipText;
    }, []);

    const handleNavigate = useCallback((newDate) => { setCurrentDate(new Date(newDate)); }, []);
    const handleView = useCallback((newView) => { setCurrentView(newView); }, []);
    const closeActionMenu = useCallback(() => { setActionMenu({ visible: false, x: 0, y: 0, event: null }); }, []);

    const handleSelectSlot = useCallback(({ start, end, slots }) => {
        closeActionMenu();
        setEditingItem(null);
        setSlotInfoForNewMission({ start, end, allDay: slots.length === 1 && currentView === Views.MONTH });
        setFormType('scheduledMission');
        setModalTitle("Create Scheduled Mission");
        setShowModal(true);
    }, [closeActionMenu, currentView]);

    const handleSelectEvent = useCallback((eventData, domEvent) => {
        domEvent.preventDefault();
        domEvent.stopPropagation();
        const calendarWrapper = calendarRef.current?.querySelector('.rbc-calendar') || calendarRef.current;
        if (!calendarWrapper) return;
        const calendarRect = calendarWrapper.getBoundingClientRect();
        let x = domEvent.clientX - calendarRect.left;
        let y = domEvent.clientY - calendarRect.top;
        const isScheduledMission = eventData.resource?.type === 'SCHEDULED_MISSION';
        const menuWidth = 200;
        const menuHeight = isScheduledMission ? 200 : 160;
        if (x + menuWidth > calendarRect.width) x = calendarRect.width - menuWidth - 5;
        if (y + menuHeight > calendarRect.height) y = calendarRect.height - menuHeight - 5;
        x = Math.max(5, x);
        y = Math.max(5, y);
        setActionMenu({ visible: true, x, y, event: eventData });
    }, []);

    // REMOVED the problematic useEffect for click-outside here, as it's handled in EventActionMenu

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
            await axios.post(API_POOL_MISSIONS_URL, poolMissionPayload, { headers: { Authorization: `Bearer ${token}` } });
            await axios.delete(`${API_SCHEDULED_MISSIONS_URL}/${scheduledMissionOriginal.id}`, { headers: { Authorization: `Bearer ${token}` } });
            setInfoMessage(`"${scheduledMissionOriginal.title}" moved to Mission Pool.`); clearInfoMessage();
            fetchCalendarEvents(true);
            setRefreshPoolCounter(prev => prev + 1);
            refreshUserStatsAndEnergy();
        } catch (err) { setError(err.response?.data?.error || "Failed to move mission to pool."); }
    };

    const handleEventAction = async (action, eventData) => { /* ... (same as previous, ensure no `menuRef` usage here) ... */
        closeActionMenu(); // Ensure menu closes regardless
        const { type, original, habit_template_id } = eventData.resource;
        const token = localStorage.getItem('authToken');
        let statusToSet = '';

        if (type === 'SCHEDULED_MISSION') {
            switch (action) {
                case 'edit_scheduled_mission':
                    setEditingItem(original); setSlotInfoForNewMission(null); setFormType('scheduledMission');
                    setModalTitle("Edit Scheduled Mission"); setShowModal(true); return;
                case 'delete_scheduled_mission':
                    setItemToDelete(original); setItemTypeToDelete('SCHEDULED_MISSION'); setShowConfirmDeleteDialog(true); return;
                case 'move_to_pool': handleMoveToPool(original); return;
                case 'complete': statusToSet = 'COMPLETED'; break; case 'skip': statusToSet = 'SKIPPED'; break;
                case 'pending': statusToSet = 'PENDING'; break; default: console.warn("Unknown SM action:", action); return;
            }
            if (statusToSet) {
                try {
                    await axios.patch(`${API_SCHEDULED_MISSIONS_URL}/${original.id}/status`, { status: statusToSet }, { headers: { Authorization: `Bearer ${token}` } });
                    fetchCalendarEvents(true); refreshUserStatsAndEnergy();
                } catch (err) { setError(err.response?.data?.error || `Failed to mark SM as ${statusToSet.toLowerCase()}.`); }
            }
        } else if (type === 'HABIT_OCCURRENCE') {
            switch (action) {
                case 'complete': statusToSet = 'COMPLETED'; break; case 'skip': statusToSet = 'SKIPPED'; break;
                case 'pending': statusToSet = 'PENDING'; break;
                case 'edit_habit_template':
                    try {
                        const templateResponse = await axios.get(`${API_HABIT_TEMPLATES_URL}/${habit_template_id}`, { headers: { Authorization: `Bearer ${token}` } });
                        setEditingItem(templateResponse.data); setFormType('habitTemplate');
                        setModalTitle("Edit Habit Definition"); setShowModal(true);
                    } catch (err) { setError("Could not load habit definition."); console.error("Err HO tmpl fetch:", err); } return;
                case 'delete_habit_template':
                    setItemToDelete({ id: habit_template_id, title: original.title });
                    setItemTypeToDelete('HABIT_TEMPLATE'); setShowConfirmDeleteDialog(true); return;
                case 'extend_habit':
                    try {
                        if (!habit_template_id) { setError("Cannot extend: Template ID missing."); return; }
                        const extendResponse = await axios.post(`${API_HABIT_TEMPLATES_URL}/${habit_template_id}/generate-occurrences`, {}, { headers: { Authorization: `Bearer ${token}` } });
                        setInfoMessage(extendResponse.data.message || `Occurrences extended for "${original.title}".`); clearInfoMessage();
                        fetchCalendarEvents(true);
                    } catch (err) { setError(err.response?.data?.error || "Failed to extend habit."); } return;
                default: console.warn("Unknown HO action:", action); return;
            }
            if (statusToSet) {
                try {
                    await axios.patch(`${API_HABIT_OCCURRENCES_URL}/${original.id}/status`, { status: statusToSet }, { headers: { Authorization: `Bearer ${token}` } });
                    fetchCalendarEvents(true); refreshUserStatsAndEnergy();
                } catch (err) { setError(err.response?.data?.error || `Failed to update HO status.`); }
            }
        }
    };
    
    const handleConfirmDeleteItemAction = async () => { /* ... (same as previous) ... */
        if (!itemToDelete || !itemTypeToDelete) return;
        const token = localStorage.getItem('authToken');
        let url = ''; let successMessage = '';
        if (itemTypeToDelete === 'SCHEDULED_MISSION') {
            url = `${API_SCHEDULED_MISSIONS_URL}/${itemToDelete.id}`;
            successMessage = `Scheduled Mission "${itemToDelete.title}" deleted.`;
        } else if (itemTypeToDelete === 'HABIT_TEMPLATE') {
            url = `${API_HABIT_TEMPLATES_URL}/${itemToDelete.id}`;
            successMessage = `Habit Template for "${itemToDelete.title}" and all its occurrences deleted.`;
        } else { return; }
        try {
            await axios.delete(url, { headers: { Authorization: `Bearer ${token}` } });
            setInfoMessage(successMessage); clearInfoMessage();
            fetchCalendarEvents(true); refreshUserStatsAndEnergy();
        } catch (err) { setError(err.response?.data?.error || `Failed to delete ${itemTypeToDelete.replace('_', ' ').toLowerCase()}.`); }
        finally { setShowConfirmDeleteDialog(false); setItemToDelete(null); setItemTypeToDelete(''); }
    };

    const onEventOperation = useCallback(async (operationType, { event, start, end }) => { /* ... (same as previous) ... */
        closeActionMenu();
        const { original } = event.resource;
        if (event.resource.type !== 'SCHEDULED_MISSION') return;
        const token = localStorage.getItem('authToken');
        const payload = {
            title: original.title, description: original.description, energy_value: original.energy_value,
            points_value: original.points_value, status: original.status, quest_id: original.quest_id,
            tag_ids: original.tags?.map(t => t.id) || [],
            start_datetime: start.toISOString(), end_datetime: end.toISOString(),
            is_all_day: event.allDay,
        };
        try {
            await axios.put(`${API_SCHEDULED_MISSIONS_URL}/${original.id}`, payload, { headers: { Authorization: `Bearer ${token}` } });
            fetchCalendarEvents(true);
        } catch (err) {
            setError(err.response?.data?.error || `Failed to ${operationType === 'move' ? 'move' : 'resize'} event.`);
            fetchCalendarEvents(true);
        }
    }, [fetchCalendarEvents, closeActionMenu]);
    
    const onEventDrop = useCallback((args) => { /* ... (same as previous) ... */
        if (args.event.resource?.type === 'SCHEDULED_MISSION') { onEventOperation('move', args); } 
        else { setInfoMessage("Habit occurrences cannot be rescheduled. Edit the habit definition."); clearInfoMessage(); fetchCalendarEvents(true); }
    }, [onEventOperation, fetchCalendarEvents, clearInfoMessage, setInfoMessage]);
    const onEventResize = useCallback((args) => onEventOperation('resize', args), [onEventOperation]);
    const handleDragStartExternal = useCallback((poolMission) => { setDraggedExternalMission(poolMission); }, []);
    const onDropFromOutside = useCallback(async ({ start, end, allDay }) => { /* ... (same as previous) ... */
        closeActionMenu();
        if (!draggedExternalMission) return;
        const token = localStorage.getItem('authToken');
        let finalEnd = end;
        if (!end || end.getTime() <= start.getTime()) { finalEnd = new Date(start.getTime() + 60 * 60 * 1000); }
        const missionDataPayload = {
            title: draggedExternalMission.title, description: draggedExternalMission.description || null,
            energy_value: draggedExternalMission.energy_value, points_value: draggedExternalMission.points_value,
            start_datetime: start.toISOString(), end_datetime: finalEnd.toISOString(),
            is_all_day: allDay, quest_id: draggedExternalMission.quest_id,
            tag_ids: draggedExternalMission.tags ? draggedExternalMission.tags.map(t => t.id) : [], status: 'PENDING',
        };
        try {
            await axios.post(API_SCHEDULED_MISSIONS_URL, missionDataPayload, { headers: { Authorization: `Bearer ${token}` } });
            await axios.delete(`${API_POOL_MISSIONS_URL}/${draggedExternalMission.id}`, { headers: { Authorization: `Bearer ${token}` } });
            fetchCalendarEvents(true); setRefreshPoolCounter(prev => prev + 1); refreshUserStatsAndEnergy();
            setInfoMessage(`"${draggedExternalMission.title}" scheduled successfully from pool.`); clearInfoMessage();
        } catch (err) {
            console.error("Failed to convert pool mission:", err.response?.data || err.message);
            setError(err.response?.data?.error || "Failed to convert pool mission.");
        } finally { setDraggedExternalMission(null); }
    }, [draggedExternalMission, fetchCalendarEvents, refreshUserStatsAndEnergy, closeActionMenu, clearInfoMessage, setInfoMessage]);
    const dragFromOutsideItem = useCallback(() => { /* ... (same as previous) ... */
        if (!draggedExternalMission) return null;
        const start = new Date(); const end = new Date(start.getTime() + (draggedExternalMission.duration_minutes || 60) * 60 * 1000);
        return { title: `(Pool) ${draggedExternalMission.title}`, start, end };
    }, [draggedExternalMission]);
    const customOnDragOver = useCallback((dragEvent) => { if (draggedExternalMission) { dragEvent.preventDefault(); } }, [draggedExternalMission]);

    const handleFormSubmission = async (isConversion = false) => {
        setShowModal(false); setEditingItem(null); setFormType(''); setSlotInfoForNewMission(null);
        fetchCalendarEvents(true);
        if (isConversion) setRefreshPoolCounter(prev => prev + 1);
        refreshUserStatsAndEnergy();
    };

    const draggableAccessor = (event) => event.resource?.type === 'SCHEDULED_MISSION' && event.resource?.status === 'PENDING';
    const resizableAccessor = (event) => event.resource?.type === 'SCHEDULED_MISSION' && event.resource?.status === 'PENDING';
    const scrollToTime = useMemo(() => { const todayAt7AM = new Date(); todayAt7AM.setHours(7, 0, 0, 0); return todayAt7AM; }, []);

    if (isLoading && events.length === 0 && !currentUser) { return <div className="page-container"><p>Please log in to see your calendar.</p></div>; }

    let modalFormContent = null;
    if (formType === 'scheduledMission') {
        modalFormContent = <ScheduledMissionForm missionToEdit={editingItem} slotInfo={slotInfoForNewMission} onFormSubmit={handleFormSubmission} onCancel={() => setShowModal(false)} />;
    } else if (formType === 'habitTemplate') {
        modalFormContent = <HabitTemplateForm templateToEdit={editingItem} onFormSubmit={handleFormSubmission} onCancel={() => setShowModal(false)} />;
    }

    return (
        <div className="page-container calendar-page-container">
            {error && <p className="auth-error-message" style={{ textAlign: 'center', marginBottom: '1rem', width: '100%' }}>{error}</p>}
            {infoMessage && <p className="auth-success-message" style={{ textAlign: 'center', marginBottom: '1rem', width: '100%' }}>{infoMessage}</p>}

            <div className="calendar-main-area" ref={calendarRef}>
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
                        allDayAccessor="allDay"
                        className="rbc-calendar-container"
                        style={{ height: '100%' }}
                        views={[Views.MONTH, Views.WEEK, Views.DAY]}
                        selectable
                        onSelectSlot={handleSelectSlot}
                        onSelectEvent={handleSelectEvent}
                        components={components}
                        tooltipAccessor={tooltipAccessor}
                        formats={formats}
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
                            today: "Today", previous: "Back", next: "Next",
                            month: "Month", week: "Week", day: "Day", agenda: "Agenda",
                            showMore: total => `+${total} more`
                        }}
                    />
                    {actionMenu.visible && actionMenu.event && (
                        <EventActionMenu
                            x={actionMenu.x} y={actionMenu.y} event={actionMenu.event}
                            onClose={closeActionMenu} onAction={handleEventAction}
                        />
                    )}
                </div>
            </div>
            <CalendarMissionPool onDragStartPoolMission={handleDragStartExternal} activeTagFilters={activeTagFilters} refreshTrigger={refreshPoolCounter} />

            {showModal && (<Modal title={modalTitle} onClose={() => setShowModal(false)}> {modalFormContent} </Modal>)}
            {showConfirmDeleteDialog && itemToDelete && (
                <ConfirmationDialog
                    message={`Are you sure you want to delete "${itemToDelete.title}"? ${itemTypeToDelete === 'HABIT_TEMPLATE' ? 'This will delete the habit template and ALL its occurrences.' : 'This action is permanent.'}`}
                    onConfirm={handleConfirmDeleteItemAction}
                    onCancel={() => { setShowConfirmDeleteDialog(false); setItemToDelete(null); setItemTypeToDelete(''); }}
                    confirmButtonText="Delete"
                />
            )}
        </div>
    );
}

export default CalendarPage;