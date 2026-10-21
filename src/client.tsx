import React from 'react';
import {hydrateRoot} from 'react-dom/client';
import App from './App';
import './styles.css';
import {api} from './state';
declare global { interface Window { __LANSRRY__: any } }
const initial=window.__LANSRRY__;
hydrateRoot(document.getElementById('root')!,<App initial={initial}/>);
// Refresh HttpOnly Firebase sessions when a returning visitor still has a refresh cookie.
if(initial.mode==='configured'&&!initial.user&&sessionStorage.getItem('lansrry:refresh-attempt')!==location.pathname){sessionStorage.setItem('lansrry:refresh-attempt',location.pathname);api('/api/auth/refresh',{method:'POST'}).then(()=>location.reload()).catch(()=>{});}else if(initial.user){sessionStorage.removeItem('lansrry:refresh-attempt');}
