import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom'; // Importar Link
import '../../styles/auth.css';

const API_AUTH_URL = import.meta.env.VITE_API_BASE_URL+'/auth';

function LoginForm({ onAuthSuccess }) {
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const { email, password } = formData;

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!email.trim() || !password.trim()) {
            setError('Email and password are required.');
            return;
        }

        try {
            const response = await axios.post(`${API_AUTH_URL}/login`, {
                email,
                password,
            });

            if (response.data.token && response.data.user) {
                localStorage.setItem('authToken', response.data.token);
                localStorage.setItem('currentUser', JSON.stringify(response.data.user));
                
                if (onAuthSuccess) {
                    onAuthSuccess();
                }
                navigate('/dashboard'); 
            } else {
                setError('Login failed: Invalid response from server.');
            }
        } catch (err) {
            if (err.response && err.response.data && err.response.data.error) {
                setError(err.response.data.error);
            } else {
                setError('Login failed. Please check your credentials or try again.');
            }
            console.error('Login error:', err);
        }
    };

    return (
        <div className="auth-form-container">
            <form onSubmit={handleSubmit}>
                <h2>Login to Iter Polaris</h2>
                {error && <p className="auth-error-message">{error}</p>}
                <input
                    type="email"
                    name="email"
                    value={email}
                    onChange={handleChange}
                    placeholder="Email Address"
                    required
                    className="auth-input"
                />
                <input
                    type="password"
                    name="password"
                    value={password}
                    onChange={handleChange}
                    placeholder="Password"
                    required
                    className="auth-input"
                />
                <button type="submit" className="auth-button">Login</button>
            </form>
            <div style={{ textAlign: 'center', marginTop: '15px' }}>
                <Link to="/dev-password-reset" className="auth-form-link">
                    Forgot your password? (Dev Reset)
                </Link>
            </div>
        </div>
    );
}

export default LoginForm;