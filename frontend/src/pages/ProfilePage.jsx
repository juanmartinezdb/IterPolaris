// frontend/src/pages/ProfilePage.jsx
import React, { useContext } from 'react';
import { UserContext } from '../contexts/UserContext';
import '../styles/profile.css'; // Crearemos este archivo CSS

function ProfilePage() {
    const { currentUser, isLoadingProfile } = useContext(UserContext);

    if (isLoadingProfile && !currentUser) {
        return <div className="page-container profile-page loading"><p>Loading profile...</p></div>;
    }

    if (!currentUser) {
        return <div className="page-container profile-page error"><p>Could not load user profile. Please try logging in again.</p></div>;
    }

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString(undefined, {
            year: 'numeric', month: 'long', day: 'numeric'
        });
    };

    return (
        <div className="page-container profile-page">
            <h2>My Profile</h2>
            <div className="profile-card">
                <div className="profile-avatar-section">
                    {currentUser.avatar_url ? (
                        <img src={currentUser.avatar_url} alt={`${currentUser.name}'s avatar`} className="profile-avatar-img" />
                    ) : (
                        <div className="profile-avatar-placeholder">
                            {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : '?'}
                        </div>
                    )}
                    {/* Botón para cambiar avatar se añadirá después */}
                </div>
                <div className="profile-details-section">
                    <div className="profile-detail-item">
                        <span className="detail-label">Name:</span>
                        <span className="detail-value">{currentUser.name}</span>
                    </div>
                    <div className="profile-detail-item">
                        <span className="detail-label">Email:</span>
                        <span className="detail-value">{currentUser.email}</span>
                    </div>
                    <hr className="profile-divider" />
                    <div className="profile-detail-item">
                        <span className="detail-label">Level:</span>
                        <span className="detail-value">{currentUser.level}</span>
                    </div>
                    <div className="profile-detail-item">
                        <span className="detail-label">Total Points:</span>
                        <span className="detail-value">{currentUser.total_points} XP</span>
                    </div>
                    <div className="profile-detail-item">
                        <span className="detail-label">Current Streak:</span>
                        <span className="detail-value">🔥 {currentUser.current_streak} days</span>
                    </div>
                    <hr className="profile-divider" />
                    <div className="profile-detail-item">
                        <span className="detail-label">Member Since:</span>
                        <span className="detail-value">{formatDate(currentUser.created_at)}</span>
                    </div>
                    <div className="profile-detail-item">
                        <span className="detail-label">Last Login:</span>
                        <span className="detail-value">{formatDate(currentUser.last_login_date)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ProfilePage;