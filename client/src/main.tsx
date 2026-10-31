import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { App } from './App.tsx'
import { AuthProvider } from './core/auth/AuthContext.tsx'
import { I18nProvider } from './core/i18n/I18nContext.tsx'
import { ThemeProvider } from './core/theme/ThemeContext.tsx'
import './index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Nema #root elementa u index.html.')

createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>,
)
