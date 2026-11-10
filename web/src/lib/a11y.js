// Rend un élément cliquable (div, ligne, image…) utilisable au clavier : Tab pour l'atteindre, Entrée ou Espace pour l'activer.
const onKeyDown = (e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.currentTarget.click(); } };
export const kbd = { role: 'button', tabIndex: 0, onKeyDown };
// Pour une ligne de tableau : on garde son rôle de ligne
export const kbdRow = { tabIndex: 0, onKeyDown };
