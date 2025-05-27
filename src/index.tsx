import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'; // Or './globals.css' - will be created in a later step

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  console.error('Failed to find the root element');
}
