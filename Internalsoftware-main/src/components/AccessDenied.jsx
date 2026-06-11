import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function AccessDenied() {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f7fafd',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div className="section-card" style={{
        padding: 40,
        borderRadius: 16,
        boxShadow: '0 4px 24px #ef444415',
        background: '#fff',
        maxWidth: 400,
        width: '90%',
        textAlign: 'center'
      }}>
        <div style={{
          fontSize: '4rem',
          marginBottom: 16,
          color: '#ef4444'
        }}>
          🚫
        </div>
        <h2 style={{
          color: '#1e293b',
          fontWeight: 800,
          marginBottom: 12,
          fontSize: '1.6rem'
        }}>
          Access Denied
        </h2>
        <p style={{
          color: '#64748b',
          lineHeight: '1.6',
          marginBottom: 28,
          fontSize: '0.95rem'
        }}>
          You do not have permission to view this page. Please contact your system administrator if you believe this is an error.
        </p>
        <button
          onClick={() => navigate('/')}
          className="btn-primary"
          style={{
            width: '100%',
            padding: '12px 0',
            fontSize: '1rem',
            fontWeight: 700,
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 2px 10px #2563eb30'
          }}
        >
          Go Back Home
        </button>
      </div>
    </div>
  );
}
