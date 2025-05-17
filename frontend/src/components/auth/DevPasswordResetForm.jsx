import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../../styles/auth.css'; // Reutilizar los estilos de autenticación

const API_AUTH_URL = import.meta.env.VITE_API_BASE_URL+'/auth';

function DevPasswordResetForm() {
    const [formData, setFormData] = useState({
        email: '',
        newPassword: '',
        confirmNewPassword: '',
    });
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const navigate = useNavigate();

    const { email, newPassword, confirmNewPassword } = formData;

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError('');
        setSuccessMessage('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');

        if (!email.trim()) {
            setError('Email is required.');
            return;
        }
        if (newPassword !== confirmNewPassword) {
            setError('New passwords do not match!');
            return;
        }
        if (newPassword.length < 8) {
            setError('New password must be at least 8 characters long.');
            return;
        }

        try {
            const response = await axios.post(`${API_AUTH_URL}/dev-reset-password`, {
                email,
                new_password: newPassword, // El backend espera 'new_password'
            });

            setSuccessMessage(response.data.message || 'Password has been reset successfully! Please log in with your new password.');
            setFormData({ email: '', newPassword: '', confirmNewPassword: '' }); // Limpiar formulario
            
            // Redirigir a login después de un pequeño delay para que el usuario lea el mensaje
            setTimeout(() => {
                navigate('/login');
            }, 3000);

        } catch (err) {
            if (err.response && err.response.data && err.response.data.error) {
                setError(err.response.data.error);
            } else {
                setError('Password reset failed. Please try again.');
            }
            console.error('Password reset error:', err);
        }
    };

    return (
        <div className="auth-form-container">
            <form onSubmit={handleSubmit}>
                <h2>Developer Password Reset</h2>
                <p style={{ fontSize: '0.8em', textAlign: 'center', marginBottom: '15px', color: 'var(--color-text-on-dark-muted)' }}>
                    Enter the email of the account and your new desired password.
                </p>
                {error && <p className="auth-error-message">{error}</p>}
                {successMessage && <p className="auth-success-message">{successMessage}</p>}
                
                <input
                    type="email"
                    name="email"
                    value={email}
                    onChange={handleChange}
                    placeholder="Account Email Address"
                    required
                    className="auth-input"
                />
                <input
                    type="password"
                    name="newPassword"
                    value={newPassword}
                    onChange={handleChange}
                    placeholder="New Password (min. 8 characters)"
                    required
                    className="auth-input"
                />
                <input
                    type="password"
                    name="confirmNewPassword"
                    value={confirmNewPassword}
                    onChange={handleChange}
                    placeholder="Confirm New Password"
                    required
                    className="auth-input"
                />
                <button type="submit" className="auth-button">Reset Password</button>
            </form>
        </div>
    );
}

export default DevPasswordResetForm;