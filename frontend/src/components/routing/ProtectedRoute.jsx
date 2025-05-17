// frontend/src/components/routing/ProtectedRoute.jsx
import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

const ProtectedRoute = ({ children }) => {
    const isAuthenticated = !!localStorage.getItem('authToken');
    const location = useLocation();

    if (!isAuthenticated) {
        // Redirigir a la página de login, guardando la ubicación actual
        // para que puedan ser redirigidos de vuelta después del login.
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Si está autenticado, renderiza los hijos (si se pasan directamente)
    // o el Outlet (si se usa para rutas anidadas).
    return children ? children : <Outlet />; 
};

export default ProtectedRoute;