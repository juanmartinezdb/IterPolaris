// frontend/src/components/layout/MainContentArea.jsx
import React from 'react';
// Ensure layout.css is imported (likely in App.jsx or here if specific styles are needed)
// import '../../styles/layout.css';

function MainContentArea({ children, isAuthenticated }) {
    // The 'isAuthenticated' prop helps to adjust styling if the sidebar is not present.
    // `App.jsx` already adds `main-content` class from `App.css`.
    // We can use `main-content-area-layout` for more specific layout styles if needed.
    return (
        <main className={`main-content-area-layout ${!isAuthenticated ? 'full-width' : ''}`}>
            {children}
        </main>
    );
}

export default MainContentArea;