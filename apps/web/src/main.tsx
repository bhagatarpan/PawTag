import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { CartProvider } from './context/CartContext';
import { CartInteractionProvider } from './context/CartInteractionContext';
import { AuthProvider } from './context/AuthContext';
import { SiteAvailabilityProvider } from './components/SiteAvailabilityProvider';
import FlyingImage from './components/FlyingImage';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <SiteAvailabilityProvider>
          <AuthProvider>
            <CartProvider>
              <CartInteractionProvider>
                <App />
                <FlyingImage />
              </CartInteractionProvider>
            </CartProvider>
          </AuthProvider>
        </SiteAvailabilityProvider>
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>
);
