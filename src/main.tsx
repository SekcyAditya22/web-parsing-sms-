import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Ensure dark mode is the default before React renders
try {
  const storedTheme = localStorage.getItem('theme');
  const initialTheme = storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : 'dark';
  if (initialTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
} catch {}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
