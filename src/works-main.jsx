import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import WorksLibrary from './components/WorksLibrary.jsx';
import './styles/card-surfaces.css';
import './styles/apple-system.css';
import './navigation/inputModality.js';
import './styles/navigation.css';

createRoot(document.getElementById('works-root')).render(<StrictMode><WorksLibrary /></StrictMode>);
