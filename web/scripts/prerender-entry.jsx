// Rendu de la page d'accueil en HTML au moment du build (voir build.mjs) : le texte est dans la page dès le chargement.
import { renderToString } from 'react-dom/server';
import { Landing } from '../src/pages/auth/landing.jsx';
export const html = () => renderToString(<Landing params={{}} />);
