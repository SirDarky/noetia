import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import './features/home/home.css'
import './features/universes/universes.css'
import './components/window-chrome.css'
import 'highlight.js/styles/github-dark.css'

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
