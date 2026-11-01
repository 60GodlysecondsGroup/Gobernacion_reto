/**
 * Asistentes virtuales de la plataforma y sus mensajes predefinidos.
 *
 * Son personajes ilustrados con mensajes ESCRITOS DE ANTEMANO: no son personas, no conversan, no
 * usan IA y no leen nada de lo que escribe la persona. Cada globo lo dice explícitamente.
 * Ningún mensaje pide ni contiene datos personales. Para editar o agregar mensajes basta con
 * cambiar esta lista.
 */
export type IdAcompanante = 'cocuyo' | 'chigui';

export type Acompanante = {
  id: IdAcompanante;
  nombre: string;
  /** Qué hace dentro de la plataforma (se muestra bajo el nombre). */
  papel: string;
};

export const ACOMPANANTES: Record<IdAcompanante, Acompanante> = {
  cocuyo: { id: 'cocuyo', nombre: 'Cocuyo', papel: 'Guía de orientación' },
  chigui: { id: 'chigui', nombre: 'Chigüi', papel: 'Guía de convivencia' },
};

export type MensajeAcompanante = {
  de: IdAcompanante;
  texto: string;
  /** Acción opcional: un enlace interno relacionado con el consejo. */
  accion?: { texto: string; href: string };
};

type GrupoDeMensajes = { ruta: RegExp; mensajes: MensajeAcompanante[] };

/** Del más específico al más general: se usa el primer grupo cuya ruta coincide. */
export const MENSAJES_POR_RUTA: GrupoDeMensajes[] = [
  {
    ruta: /^\/$/,
    mensajes: [
      { de: 'cocuyo', texto: '¡Hola! Qué bueno tenerte por aquí.' },
      {
        de: 'cocuyo',
        texto: '¿Sabías que puedes encontrar orientación según el tema que te interesa?',
        accion: { texto: 'Ver temas', href: '/orientacion' },
      },
      {
        de: 'chigui',
        texto: '¿Quieres descubrir cómo funciona este espacio? Son cuatro pasos.',
        accion: { texto: 'Ver cómo funciona', href: '/#como-funciona' },
      },
      {
        de: 'chigui',
        texto: 'Hay minijuegos cortos sobre convivencia y seguridad digital. Son opcionales.',
        accion: { texto: 'Ir a los juegos', href: '/juegos' },
      },
    ],
  },
  {
    ruta: /^\/orientacion/,
    mensajes: [
      {
        de: 'cocuyo',
        texto:
          'Cada servicio indica su fuente y la fecha en que se verificó. Revísala antes de usarlo.',
      },
      {
        de: 'cocuyo',
        texto: 'Si necesitas ayuda, los canales institucionales están a un clic.',
        accion: { texto: 'Necesito ayuda', href: '/ayuda' },
      },
    ],
  },
  {
    ruta: /^\/ayuda/,
    mensajes: [
      {
        de: 'cocuyo',
        texto:
          'Estos canales son de instituciones. Si estás en peligro inmediato, busca a una persona de confianza cerca de ti.',
      },
    ],
  },
  {
    ruta: /^\/comunidad|^\/perfiles/,
    mensajes: [
      {
        de: 'chigui',
        texto: 'Recuerda que puedes participar sin compartir tus datos personales.',
      },
      {
        de: 'chigui',
        texto: 'Antes de publicar, el texto se revisa para proteger tu privacidad y la de otros.',
        accion: { texto: 'Leer las reglas', href: '/reglas' },
      },
      {
        de: 'chigui',
        texto: 'Puedes explorar los diferentes espacios de la comunidad, como las salas temáticas.',
        accion: { texto: 'Ver salas', href: '/salas' },
      },
    ],
  },
  {
    ruta: /^\/salas$/,
    mensajes: [
      {
        de: 'chigui',
        texto: 'En las salas conversas con tu avatar. Si algo te incomoda, puedes reportarlo.',
      },
    ],
  },
  {
    ruta: /^\/perfil/,
    mensajes: [
      {
        de: 'chigui',
        texto: 'Tu alias y tus hobbies son lo que ven los demás. Nunca se muestra tu edad exacta.',
      },
    ],
  },
  {
    ruta: /^\/juegos/,
    mensajes: [
      {
        de: 'chigui',
        texto: 'Los juegos no guardan puntajes ni piden datos. Juega las veces que quieras.',
      },
    ],
  },
  {
    ruta: /^\/reglas/,
    mensajes: [
      {
        de: 'chigui',
        texto:
          'Son pocas reglas y sirven para que este sea un espacio seguro para todas las personas.',
      },
    ],
  },
];

export const mensajesDeRuta = (ruta: string) =>
  MENSAJES_POR_RUTA.find((grupo) => grupo.ruta.test(ruta))?.mensajes ?? [];

/** Segundos en la página antes de que aparezca el primer globo (nunca al cargar). */
export const ESPERA_PRIMER_MENSAJE_MS = 6000;
/** Tiempo mínimo entre dos globos automáticos en toda la visita. */
export const PAUSA_ENTRE_MENSAJES_MS = 90_000;
/** El globo se oculta solo si nadie interactúa con él. */
export const DURACION_GLOBO_MS = 14_000;
