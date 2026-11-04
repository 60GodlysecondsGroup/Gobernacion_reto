/** Clave de `localStorage` con el tema elegido («claro» u «oscuro»). */
export const CLAVE_TEMA = 'cp-tema';

/**
 * Script en línea del <head>: aplica el tema guardado antes del primer pintado, así no hay
 * destello del tema equivocado. Sin elección guardada no hace nada y manda el sistema
 * (`prefers-color-scheme`, resuelto solo con CSS).
 */
export const SCRIPT_TEMA = `(function(){try{var t=localStorage.getItem('${CLAVE_TEMA}');if(t==='oscuro'||t==='claro')document.documentElement.setAttribute('data-tema',t);}catch(e){}})();`;
