// frontend/src/components/routing/ProtectedRoute.jsx
import React, { useContext } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { UserContext } from '../../contexts/UserContext'; // Importar

const ProtectedRoute = ({ children }) => {
    const { currentUser, isLoadingProfile } = useContext(UserContext);
    const location = useLocation();

    if (isLoadingProfile) {
        // Muestra un loader mientras se verifica el estado de autenticación
        // Podría ser un loader más estilizado o global
        return <div className="app-container-loading" style={{textAlign: 'center', padding: '50px'}}>Verifying Your Path...</div>;
    }

    if (!currentUser) {
        // Si después de cargar, no hay usuario, redirigir a login
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return children ? children : <Outlet />; 
};

export default ProtectedRoute;