// frontend/src/components/layout/LeftSidebar.jsx
import React, { useState, useContext } from 'react'; // useContext no es necesario si currentUser no se usa directamente aquí
import { NavLink } from 'react-router-dom';
import UserStatsDisplay from '../gamification/UserStatsDisplay';
import TagFilter from '../tags/TagFilter';
// import { UserContext } from '../../contexts/UserContext'; // No es estrictamente necesario si no se usa currentUser directamente aquí

// Import form components for the "Add New" modal
import QuestForm from '../quests/QuestForm';
import TagForm from '../tags/TagForm';
import PoolMissionForm from '../missions/pool/PoolMissionForm';
import ScheduledMissionForm from '../missions/scheduled/ScheduledMissionForm';
import HabitTemplateForm from '../habits/HabitTemplateForm';
// ConfirmationDialog no se usa directamente para el "Add New" pero podría ser para otras acciones del sidebar
import Modal from '../common/Modal'; 

// import '../../styles/layout.css'; // Importado en App.jsx

function LeftSidebar({ activeTagFilters, onTagFilterChange }) { // Recibe props para filtros
    const [isAddNewDropdownOpen, setIsAddNewDropdownOpen] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [modalContent, setModalContent] = useState(null);
    const [modalTitle, setModalTitle] = useState('');

    const toggleAddNewDropdown = () => setIsAddNewDropdownOpen(!isAddNewDropdownOpen);
    
    const openModalWithForm = (formType) => {
        setIsAddNewDropdownOpen(false); 
        switch (formType) {
            case 'Quest':
                setModalTitle('Create New Quest');
                setModalContent(
                    <QuestForm
                        onFormSubmit={() => { console.log('Quest submitted from sidebar modal'); setShowModal(false); /* TODO: Refresh relevant data if needed by sidebar or other components */ }}
                        onCancel={() => setShowModal(false)}
                    />
                );
                break;
            case 'Tag':
                 setModalTitle('Create New Tag');
                setModalContent(
                    <TagForm
                        onFormSubmit={() => { console.log('Tag submitted from sidebar modal'); setShowModal(false); /* TODO: Refresh tags list for TagFilter if not automatically handled by TagFilter itself */ }}
                        onCancel={() => setShowModal(false)}
                    />
                );
                break;
            case 'PoolMission':
                 setModalTitle('Create New Pool Mission');
                 setModalContent(
                    <PoolMissionForm // Asegúrate que PoolMissionForm no dependa de missionToEdit si es para crear
                        onFormSubmit={() => { console.log('Pool Mission submitted from sidebar modal'); setShowModal(false); /* TODO: Refresh pool missions in dashboard/calendar pool */ }}
                        onCancel={() => setShowModal(false)}
                    />
                 );
                break;
            case 'ScheduledMission':
                 setModalTitle('Create New Scheduled Mission');
                 setModalContent(
                    <ScheduledMissionForm 
                        slotInfo={{ start: new Date(), end: new Date(new Date().getTime() + 60 * 60 * 1000) }} // Default slot example
                        onFormSubmit={() => { console.log('Scheduled Mission submitted from sidebar modal'); setShowModal(false); /* TODO: Refresh calendar/list */}}
                        onCancel={() => setShowModal(false)}
                    />
                 );
                break;
            case 'HabitTemplate':
                 setModalTitle('Create New Habit Template');
                 setModalContent(
                    <HabitTemplateForm // Asegúrate que HabitTemplateForm no dependa de templateToEdit si es para crear
                        onFormSubmit={() => { console.log('Habit Template submitted from sidebar modal'); setShowModal(false); /* TODO: Refresh templates */}}
                        onCancel={() => setShowModal(false)}
                    />
                 );
                break;
            default:
                setModalContent(null);
                setModalTitle('');
                return;
        }
        setShowModal(true);
    };

    const navLinks = [
        { to: "/dashboard", label: "Dashboard", icon: "🗺️" },
        { to: "/calendar", label: "Calendar", icon: "📅" },
        { to: "/scheduled-missions", label: "Scheduled", icon: "🗓️" },
        { to: "/habit-templates", label: "Habits", icon: "🔄" },
        { to: "/quests", label: "My Quests", icon: "🏆" },
        { to: "/tags", label: "My Tags", icon: "🏷️" },
        // { to: "/settings", label: "Settings", icon: "⚙️" } // Placeholder
    ];

    return (
        <aside className="left-sidebar-component">
            <UserStatsDisplay /> {/* Este componente usa UserContext internamente */}
            
            <div className="add-new-button-container">
                <button 
                    onClick={toggleAddNewDropdown} 
                    className="add-new-button-sidebar" 
                    aria-expanded={isAddNewDropdownOpen}
                    aria-controls="add-new-menu"
                >
                    + Add New
                </button>
                {isAddNewDropdownOpen && (
                    <ul id="add-new-menu" className={`add-new-dropdown ${isAddNewDropdownOpen ? 'open' : ''}`}>
                        <li onClick={() => openModalWithForm('PoolMission')}>Mission (Pool)</li>
                        <li onClick={() => openModalWithForm('ScheduledMission')}>Mission (Scheduled)</li>
                        <li onClick={() => openModalWithForm('HabitTemplate')}>Habit Template</li>
                        <hr className="dropdown-divider"/>
                        <li onClick={() => openModalWithForm('Quest')}>Quest</li>
                        <li onClick={() => openModalWithForm('Tag')}>Tag</li>
                    </ul>
                )}
            </div>
            
            <nav className="sidebar-navigation-component">
                {navLinks.map(link => (
                    <NavLink 
                        key={link.to}
                        to={link.to} 
                        className={({ isActive }) => isActive ? "sidebar-nav-link-component active" : "sidebar-nav-link-component"}
                        onClick={() => setIsAddNewDropdownOpen(false)} // Close dropdown on navigation
                    >
                        <span role="img" aria-label={`${link.label} Icon`}>{link.icon}</span> {link.label}
                    </NavLink>
                ))}
            </nav>

            <TagFilter
                // availableTags se carga dentro de TagFilter por ahora
                selectedTags={activeTagFilters}      // Usar prop de App.jsx
                onFilterChange={onTagFilterChange}  // Usar prop de App.jsx
                // onConfigOpen={() => navigate('/settings/filters')} // Futuro (Task 9.8)
            />
             {showModal && (
                <Modal title={modalTitle} onClose={() => setShowModal(false)}>
                    {modalContent}
                </Modal>
            )}
        </aside>
    );
}

export default LeftSidebar;