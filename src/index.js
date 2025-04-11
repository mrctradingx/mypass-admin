import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Auth0Provider } from '@auth0/auth0-react';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <Auth0Provider
    domain="mypassdelivery.us.auth0.com" // Thay bằng domain của bạn
    clientId="HgptXBf3XTtT0DfkM8AaVCFdAN2Grmsm" // Thay bằng client ID của bạn
    redirectUri={window.location.origin}
    audience="your-api-audience" // Thay bằng audience nếu bạn sử dụng API
  >
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </Auth0Provider>
);