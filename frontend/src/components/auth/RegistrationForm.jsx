import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../../styles/auth.css'; // Importar el CSS

// Es buena práctica definir la URL base de la API en un solo lugar,
// idealmente una variable de entorno.
const API_AUTH_URL = import.meta.env.VITE_API_BASE_URL+'/auth';

function RegistrationForm({ onAuthSuccess }) { // onAuthSuccess es pasado desde App.jsx
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
    });
    const [error, setError] = useState('');
    // successMessage ya no es necesario si siempre redirigimos o hay error.
    // const [successMessage, setSuccessMessage] = useState(''); 
    const navigate = useNavigate();
    const { name, email, password, confirmPassword } = formData;

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError(''); // Limpiar error al escribir
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Validaciones de frontend (puedes expandirlas)
        if (!name.trim()) {
            setError('Name is required.');
            return;
        }
        if (!email.trim()) {
            // Podrías añadir una validación de regex para el email aquí también
            setError('Email is required.');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match!');
            return;
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters long.');
            return;
        }

        try {
            const response = await axios.post(`${API_AUTH_URL}/register`, {
                name,
                email,
                password,
            });

            // El backend ahora devuelve token y user si el registro es exitoso
            if (response.data.token && response.data.user) {
                localStorage.setItem('authToken', response.data.token);
                localStorage.setItem('currentUser', JSON.stringify(response.data.user));

                if (onAuthSuccess) {
                    onAuthSuccess(); // Notificar a App.jsx para actualizar el estado global de autenticación
                }
                navigate('/dashboard'); // Redirigir al dashboard después de registro y auto-login
            } else {
                // Si el backend por alguna razón no devuelve token/user pero fue un 201 (creado)
                // o si la respuesta es inesperada.
                setError(response.data.message || 'Registration completed, but auto-login failed. Please try logging in.');
                // Podrías limpiar el formulario aquí y/o redirigir a login después de un delay.
                setFormData({ name: '', email: '', password: '', confirmPassword: '' });
                setTimeout(() => {
                    if (!localStorage.getItem('authToken')) { // Solo si no se logró el auto-login
                        navigate('/login');
                    }
                }, 3000);
            }

        } catch (err) {
            if (err.response && err.response.data && err.response.data.error) {
                setError(err.response.data.error);
            } else {
                setError('Registration failed. Please try again.');
            }
            console.error('Registration error:', err);
        }
    };

    return (
        <div className="auth-form-container">
            <form onSubmit={handleSubmit}>
                <h2>Create Your Account</h2>
                {error && <p className="auth-error-message">{error}</p>}
                {/* No necesitamos successMessage si siempre redirigimos o mostramos error */}

                <input
                    type="text"
                    name="name"
                    value={name}
                    onChange={handleChange}
                    placeholder="Your Name"
                    required
                    className="auth-input"
                />
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
                    placeholder="Password (min. 8 characters)"
                    required
                    className="auth-input"
                />
                <input
                    type="password"
                    name="confirmPassword"
                    value={confirmPassword}
                    onChange={handleChange}
                    placeholder="Confirm Password"
                    required
                    className="auth-input"
                />
                <button type="submit" className="auth-button">Register & Enter</button>
            </form>
        </div>
    );
}

export default RegistrationForm;