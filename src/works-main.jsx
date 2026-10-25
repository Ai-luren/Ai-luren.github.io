import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import WorksLibrary from './components/WorksLibrary.jsx';
import './styles/card-surfaces.css';
import './styles/apple-system.css';
import './navigation/inputModality.js';
import './styles/navigation.css';
import { warmNavigationTo } from './navigation/pagePrefetch.js';

createRoot(document.getElementById('works-root')).render(<StrictMode><WorksLibrary /></StrictMode>);

// Return navigation is likely during library browsing. Cache only the home
// document shell during idle; never warm its Hero video or poster assets.
warmNavigationTo('./index.html', { idle: true });
