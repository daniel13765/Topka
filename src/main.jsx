import { Component, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { Provider } from 'react-redux';
import '@fontsource-variable/inter';
import 'material-symbols/outlined.css';
import './theme/theme.css';
import { store } from './store';
import { router } from './routes/router';
import { LanguageProvider } from './context/LanguageContext';
import { initEcho } from './services/realtime/echo';

/**
 * Filet de sécurité global : toute erreur non attrapée affiche un message
 * lisible au lieu d'une page blanche (les erreurs réseau/API gérées ne passent
 * jamais par ici — seuls les crashs de rendu arrivent).
 */
class GlobalErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('TOKPa — erreur d’application capturée :', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            fontFamily: 'Inter, system-ui, sans-serif',
            background: '#F3F4F6',
            color: '#1f2937',
            padding: 24,
            textAlign: 'center',
          }}
        >
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
            Une erreur est survenue dans l’application
          </h1>
          <p style={{ fontSize: 14, color: '#6b7280', maxWidth: 420, margin: 0 }}>
            {String(this.state.error.message ?? this.state.error)}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8,
              padding: '10px 22px',
              borderRadius: 10,
              border: 'none',
              background: '#F97316',
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Recharger la page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Point d'entrée React de TOKPa — Redux + TanStack Router + Language Context
// Temps réel Reverb : initialisé au boot si un token Sanctum est présent
// (ré-initialisé après chaque login via services/api/auth.ts).
// `initEcho()` est sécurisé (try/catch interne) : un échec Reverb ne bloque
// jamais le rendu de l'application.
try {
  initEcho();
} catch (err) {
  console.warn('TOKPa Reverb: boot échoué (ignoré, l’app continue).', err);
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <Provider store={store}>
        <LanguageProvider>
          <RouterProvider router={router} />
        </LanguageProvider>
      </Provider>
    </GlobalErrorBoundary>
  </StrictMode>,
);
