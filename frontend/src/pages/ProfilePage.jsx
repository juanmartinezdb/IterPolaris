// frontend/src/pages/ProfilePage.jsx
import React, { useContext, useState, useRef } from 'react';
import axios from 'axios';
import { UserContext } from '../contexts/UserContext';
import '../styles/profile.css'; 

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function ProfilePage() {
    const { currentUser, isLoadingProfile, fetchUserProfile, updateLocalCurrentUser } = useContext(UserContext);
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewSource, setPreviewSource] = useState('');
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);

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

    const handleFileChange = (e) => {
        setError(''); setSuccessMessage('');
        const file = e.target.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) { // Max 2MB
                setError('File is too large. Maximum size is 2MB.');
                setSelectedFile(null); setPreviewSource(''); return;
            }
            const allowedTypes = ['image/png', 'image/jpeg', 'image/gif'];
            if (!allowedTypes.includes(file.type)) {
                setError('Invalid file type. Only PNG, JPG, JPEG, GIF are allowed.');
                setSelectedFile(null); setPreviewSource(''); return;
            }
            setSelectedFile(file);
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onloadend = () => { setPreviewSource(reader.result); };
        } else {
            setSelectedFile(null); setPreviewSource('');
        }
    };

    const handleUploadAvatar = async () => {
        if (!selectedFile) { setError('Please select a file to upload.'); return; }
        setIsUploading(true); setError(''); setSuccessMessage('');
        const formData = new FormData();
        formData.append('avatar', selectedFile);
        const token = localStorage.getItem('authToken');
        try {
            const response = await axios.post(`${API_BASE_URL}/auth/me/avatar`, formData, {
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
            });
            setSuccessMessage('Avatar updated successfully!');
            setSelectedFile(null); setPreviewSource('');
            if (fileInputRef.current) { fileInputRef.current.value = ""; }
            
            if (response.data.user && response.data.user.avatar_url) {
                 // updateLocalCurrentUser will also construct fullAvatarUrl
                 updateLocalCurrentUser({ avatar_url: response.data.user.avatar_url });
            } else {
                await fetchUserProfile(); // Fallback to full refresh
            }
        } catch (err) {
            console.error("Avatar upload error:", err.response?.data || err.message);
            setError(err.response?.data?.error || 'Failed to upload avatar.');
        } finally {
            setIsUploading(false);
        }
    };
    
    // Use currentUser.fullAvatarUrl which is now prepared by UserContext
    const currentDisplayAvatarSrc = previewSource || currentUser.fullAvatarUrl || '';

    return (
        <div className="page-container profile-page">
            <h2>My Profile</h2>
            {error && <p className="auth-error-message" style={{ textAlign: 'center' }}>{error}</p>}
            {successMessage && <p className="auth-success-message" style={{ textAlign: 'center' }}>{successMessage}</p>}

            <div className="profile-card">
                <div className="profile-avatar-section">
                    {currentDisplayAvatarSrc ? (
                        <img src={currentDisplayAvatarSrc} alt={`${currentUser.name}'s avatar`} className="profile-avatar-img" />
                    ) : (
                        <div className="profile-avatar-placeholder">
                            {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : '?'}
                        </div>
                    )}
                    <input 
                        type="file" 
                        accept="image/png, image/jpeg, image/gif" 
                        onChange={handleFileChange} 
                        className="avatar-file-input"
                        ref={fileInputRef}
                        id="avatarUpload"
                        style={{display: 'none'}} 
                    />
                    <label htmlFor="avatarUpload" className="avatar-upload-button">
                        {selectedFile ? "Change File" : "Choose Avatar"}
                    </label>
                    {selectedFile && (
                        <button onClick={handleUploadAvatar} disabled={isUploading} className="avatar-submit-button">
                            {isUploading ? 'Uploading...' : 'Upload & Save'}
                        </button>
                    )}
                     <p className="avatar-upload-hint">Max 2MB. PNG, JPG, GIF.</p>
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