// frontend/src/pages/LogbookPage.jsx
import React from 'react';
import { useParams, Link } from 'react-router-dom';
// import '../styles/logbook.css'; // Future styles

function LogbookPage() {
    const { questId } = useParams(); // Will be undefined if it's a general logbook

    return (
        <div className="page-container" style={{ maxWidth: '800px', margin: '2rem auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2>
                    {questId ? `Logbook for Quest ID: ${questId}` : "General Logbook"}
                </h2>
                <button 
                    className="auth-button" // Re-use style for now
                    style={{fontSize: '0.9em', padding: '0.5em 1em'}}
                    onClick={() => alert("Add new log entry form would open here.")}
                >
                    + Add Entry
                </button>
            </div>

            <p style={{color: 'var(--color-text-on-dark-muted)', marginBottom: '1rem'}}>
                This is the placeholder for the Logbook. Entries related to 
                {questId ? ` this specific Quest` : ` your activities`} will be listed here.
            </p>
            
            {/* Placeholder for list of entries */}
            <div className="logbook-entry-list-placeholder" style={{
                border: '1px dashed var(--color-text-on-dark-muted)',
                padding: '2rem',
                textAlign: 'center',
                borderRadius: 'var(--border-radius-standard)',
                minHeight: '200px'
            }}>
                <p>Log entries will appear here.</p>
                <p style={{fontSize: '0.8em', marginTop: '1rem'}}> (Feature under development) </p>
            </div>

            {questId && (
                <div style={{marginTop: '2rem', textAlign: 'center'}}>
                    <Link to={`/quests/${questId}`} className="nav-link-layout">
                        ← Back to Quest Details
                    </Link>
                </div>
            )}
        </div>
    );
}

export default LogbookPage;