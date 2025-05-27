// frontend/src/components/layout/LeftSidebar.jsx
import React, { useState, useContext, useRef, useEffect } from 'react';
import { NavLink, useNavigate, Link } from 'react-router-dom';
import UserStatsDisplay from '../gamification/UserStatsDisplay';
import TagFilter from '../tags/TagFilter';
import { UserContext } from '../../contexts/UserContext';

import QuestForm from '../quests/QuestForm';
import TagForm from '../tags/TagForm';
import PoolMissionForm from '../missions/pool/PoolMissionForm';
import ScheduledMissionForm from '../missions/scheduled/ScheduledMissionForm';
import HabitTemplateForm from '../habits/HabitTemplateForm';
import Modal from '../common/Modal';
import '../../styles/layout.css'; // Ensure this is imported

function LeftSidebar({ activeTagFilters, onTagFilterChange }) {
    const { currentUser, fetchUserProfile } = useContext(UserContext);
    const [isAddNewDropdownOpen, setIsAddNewDropdownOpen] = useState(false);
    const [isListsDropdownOpen, setIsListsDropdownOpen] = useState(false); // New state for Lists dropdown
    const [showModal, setShowModal] = useState(false);
    const [modalContent, setModalContent] = useState(null);
    const [modalTitle, setModalTitle] = useState('');
    const navigate = useNavigate();
    const addNewDropdownRef = useRef(null);
    const listsDropdownRef = useRef(null);


    const toggleAddNewDropdown = () => setIsAddNewDropdownOpen(prev => !prev);
    const toggleListsDropdown = () => setIsListsDropdownOpen(prev => !prev);

    const handleSuccessfulSubmit = async (entityType) => {
        setShowModal(false);
        setModalContent(null); // Clear modal content
        console.log(`${entityType} submitted from sidebar modal`);
        
        if (entityType === 'Tag' || entityType === 'Quest') {
            if (fetchUserProfile) await fetchUserProfile(); 
        }
        // Potentially add specific list refreshes if needed, e.g., navigating to the list page.
        // For now, relying on global context updates or page-level fetches upon navigation.
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

    // Close dropdowns if clicked outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (addNewDropdownRef.current && !addNewDropdownRef.current.contains(event.target)) {
                setIsAddNewDropdownOpen(false);
            }
            if (listsDropdownRef.current && !listsDropdownRef.current.contains(event.target)) {
                setIsListsDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const mainNavLinks = [
        { to: "/dashboard", label: "Dashboard", icon: "🗺️" },
        { to: "/calendar", label: "Calendar", icon: "📅" },
        { to: "/quests-overview", label: "Quests", icon: "🧭" }, // New "Quests" page link
    ];

    const listsNavItems = [
        { to: "/pool-missions", label: "Mission Pool", icon: "🧺" },
        { to: "/scheduled-missions", label: "Scheduled", icon: "🗓️" },
        { to: "/habit-templates", label: "Habits", icon: "🔄" },
        { type: 'divider', key: 'lists-divider-1'},
        { to: "/quests", label: "Manage Quests", icon: "🏆" }, // This is the old QuestPage for CRUD
        { to: "/tags", label: "Manage Tags", icon: "🏷️" },
    ];
     
    const handleOpenTagSettings = () => {
        navigate('/settings'); 
    };

    return (
        <aside className="left-sidebar-component">
            <UserStatsDisplay />
            
            <div className="add-new-button-container" ref={addNewDropdownRef}>
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
                {mainNavLinks.map(link => (
                    <NavLink 
                        key={link.to}
                        to={link.to} 
                        className={({ isActive }) => isActive ? "sidebar-nav-link-component active" : "sidebar-nav-link-component"}
                        onClick={() => { setIsAddNewDropdownOpen(false); setIsListsDropdownOpen(false); }} 
                    >
                        <span role="img" aria-label={`${link.label} Icon`}>{link.icon}</span> {link.label}
                    </NavLink>
                ))}
                {/* Lists Dropdown */}
                <div className="sidebar-dropdown-container" ref={listsDropdownRef}>
                    <button 
                        onClick={toggleListsDropdown} 
                        className="sidebar-nav-link-component dropdown-toggle" // Style similar to NavLink
                        aria-expanded={isListsDropdownOpen}
                        aria-controls="lists-menu"
                    >
                        <span role="img" aria-label="Lists Icon">📚</span> Lists
                        <span className={`dropdown-arrow ${isListsDropdownOpen ? 'open' : ''}`}>▼</span>
                    </button>
                    {isListsDropdownOpen && (
                        <ul id="lists-menu" className={`sidebar-dropdown-menu ${isListsDropdownOpen ? 'open' : ''}`}>
                            {listsNavItems.map(item => (
                                item.type === 'divider' ? 
                                <hr key={item.key} className="dropdown-divider" /> :
                                <li key={item.to}>
                                    <NavLink 
                                        to={item.to}
                                        className={({ isActive }) => isActive ? "sidebar-dropdown-item active" : "sidebar-dropdown-item"}
                                        onClick={() => setIsListsDropdownOpen(false)}
                                    >
                                       <span role="img" aria-label={`${item.label} Icon`}>{item.icon}</span> {item.label}
                                    </NavLink>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </nav>

            <TagFilter
                pinnedTagIdsToShow={currentUser?.settings?.sidebar_pinned_tag_ids || []}
                selectedTags={activeTagFilters}      
                onFilterChange={onTagFilterChange}  
                onConfigOpen={handleOpenTagSettings} 
            />
             {showModal && (
                <Modal title={modalTitle} onClose={() => {setShowModal(false); setModalContent(null);}}>
                    {modalContent}
                </Modal>
            )}
        </aside>
    );
}

export default LeftSidebar;