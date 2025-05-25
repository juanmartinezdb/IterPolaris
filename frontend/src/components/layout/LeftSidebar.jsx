// frontend/src/components/layout/LeftSidebar.jsx
import React, { useState, useContext } from 'react'; 
import { NavLink, useNavigate } from 'react-router-dom';
import UserStatsDisplay from '../gamification/UserStatsDisplay';
import TagFilter from '../tags/TagFilter';
import { UserContext } from '../../contexts/UserContext'; // Necesario para currentUser.settings

import QuestForm from '../quests/QuestForm';
import TagForm from '../tags/TagForm';
import PoolMissionForm from '../missions/pool/PoolMissionForm';
import ScheduledMissionForm from '../missions/scheduled/ScheduledMissionForm';
import HabitTemplateForm from '../habits/HabitTemplateForm';
import Modal from '../common/Modal'; 

// Importar contextos o funciones de refresco si los creamos más adelante
// import { QuestContext } from '../../contexts/QuestContext';
// import { TagContext } from '../../contexts/TagContext';


function LeftSidebar({ activeTagFilters, onTagFilterChange }) {
    const { currentUser, fetchUserProfile } = useContext(UserContext); // Obtener fetchUserProfile para refrescar después de crear Tag
    const [isAddNewDropdownOpen, setIsAddNewDropdownOpen] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [modalContent, setModalContent] = useState(null);
    const [modalTitle, setModalTitle] = useState('');
    const navigate = useNavigate();

    // No necesitamos tagListVersion si TagFilter se actualiza basado en currentUser.settings
    // const { refreshQuests } = useContext(QuestContext) || { refreshQuests: () => console.warn("QuestContext not provided") };

    const toggleAddNewDropdown = () => setIsAddNewDropdownOpen(!isAddNewDropdownOpen);
    
    const handleSuccessfulSubmit = async (entityType) => {
        setShowModal(false);
        console.log(`${entityType} submitted from sidebar modal`);
        
        if (entityType === 'Tag' || entityType === 'Quest') {
            // Forzar un refresh del perfil del usuario para que los nuevos tags/quests
            // estén disponibles globalmente (ej. para QuestSelector, TagFilter si no se le pasan los tags directamente).
            // Para TagFilter, si obtiene los tags de currentUser.settings.all_tags, esto lo actualizaría.
            // O, si TagFilter carga sus propios tags, necesita su propio trigger/refetch.
            // Si fetchUserProfile actualiza currentUser.tags y QuestContext usa currentUser.
            if (fetchUserProfile) await fetchUserProfile(); 
        }
        // Aquí podríamos añadir lógica de refresco más granular si tenemos contextos o funciones específicas.
        // Por ejemplo, si las listas de misiones en el Dashboard necesitan refrescarse:
        // if (['PoolMission', 'ScheduledMission', 'HabitTemplate'].includes(entityType) && refreshDashboardData) {
        // refreshDashboardData();
        // }
    };

    const openModalWithForm = (formType) => {
        setIsAddNewDropdownOpen(false); 
        switch (formType) {
            case 'Quest':
                setModalTitle('Create New Quest');
                setModalContent(
                    <QuestForm
                        onFormSubmit={() => handleSuccessfulSubmit('Quest')}
                        onCancel={() => setShowModal(false)}
                    />
                );
                break;
            case 'Tag':
                 setModalTitle('Create New Tag');
                setModalContent(
                    <TagForm
                        onFormSubmit={() => handleSuccessfulSubmit('Tag')}
                        onCancel={() => setShowModal(false)}
                    />
                );
                break;
            case 'PoolMission':
                 setModalTitle('Create New Pool Mission');
                 setModalContent(
                    <PoolMissionForm
                        onFormSubmit={() => handleSuccessfulSubmit('PoolMission')}
                        onCancel={() => setShowModal(false)}
                    />
                 );
                break;
            case 'ScheduledMission':
                 setModalTitle('Create New Scheduled Mission');
                 setModalContent(
                    <ScheduledMissionForm 
                        slotInfo={{ start: new Date(), end: new Date(new Date().getTime() + 60 * 60 * 1000) }} 
                        onFormSubmit={() => handleSuccessfulSubmit('ScheduledMission')}
                        onCancel={() => setShowModal(false)}
                    />
                 );
                break;
            case 'HabitTemplate':
                 setModalTitle('Create New Habit Template');
                 setModalContent(
                    <HabitTemplateForm
                        onFormSubmit={() => handleSuccessfulSubmit('HabitTemplate')}
                        onCancel={() => setShowModal(false)}
                    />
                 );
                break;
            default:
                setModalContent(null); setModalTitle(''); return;
        }
        setShowModal(true);
    };

const navLinks = [
        { to: "/dashboard", label: "Dashboard", icon: "🗺️" },
        { to: "/calendar", label: "Calendar", icon: "📅" },
        { to: "/pool-missions", label: "Mission Pool", icon: "🧺" }, // New Link
        { to: "/scheduled-missions", label: "Scheduled", icon: "🗓️" },
        { to: "/habit-templates", label: "Habits", icon: "🔄" },
        { to: "/quests", label: "My Quests", icon: "🏆" },
        { to: "/tags", label: "My Tags", icon: "🏷️" },
    ];
     
    const handleOpenTagSettings = () => {
        navigate('/settings'); // Navegar a la página de Settings
    };

    return (
        <aside className="left-sidebar-component">
            <UserStatsDisplay />
            
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
                        onClick={() => setIsAddNewDropdownOpen(false)} 
                    >
                        <span role="img" aria-label={`${link.label} Icon`}>{link.icon}</span> {link.label}
                    </NavLink>
                ))}
            </nav>

            <TagFilter
                // availableTags se carga dentro de TagFilter si no se provee.
                // Opcionalmente, podríamos pasar todos los tags del usuario desde currentUser si /me los devolviera.
                // availableTags={currentUser?.allUserTags || null} 
                pinnedTagIdsToShow={currentUser?.settings?.sidebar_pinned_tag_ids || []} // Pasar los IDs pineados
                selectedTags={activeTagFilters}      
                onFilterChange={onTagFilterChange}  
                onConfigOpen={handleOpenTagSettings} 
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