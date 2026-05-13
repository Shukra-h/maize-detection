import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { Provider } from './components/ui/provider' 
import App from './App'
import { LanguageProvider } from './components/i18n'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </Provider>
  </StrictMode>,
)
