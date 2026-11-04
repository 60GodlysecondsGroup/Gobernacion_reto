/**
 * Identidad de cada sala: su personaje acompañante, su ambiente y sus mensajes predefinidos.
 * Los personajes son asistentes virtuales con mensajes fijos: no son personas ni una IA, no
 * conversan y nunca piden ni muestran datos personales.
 */
import type { IdAcompanante } from './acompanantes';
import type { IdActividad } from './juegos';

export type Ambiente = 'hojas' | 'libros' | 'corazones' | 'brotes' | 'burbujas';

export type MundoSala = {
  personaje: IdAcompanante;
  /** Acento de la sala (tono del rincón y de los indicadores). */
  acento: string;
  ambiente: Ambiente;
  /** Actividad que el personaje recomienda primero en esta sala. */
  recomendada: IdActividad;
  /** Frase propia de la sala que el personaje dice al dar la bienvenida. */
  frase: string;
};

const MUNDO_BASE: MundoSala = {
  personaje: 'cocuyo',
  acento: '#7350ea',
  ambiente: 'hojas',
  recomendada: 'que-harias',
  frase: 'Aquí puedes aprender mientras compartes con tu comunidad.',
};

const MUNDOS: Record<string, MundoSala> = {
  'Bienestar cotidiano': {
    personaje: 'chigui',
    acento: '#b98a2e',
    ambiente: 'hojas',
    recomendada: 'comunidad-segura',
    frase: 'Este es un rincón tranquilo: aquí hablamos de hábitos que nos hacen bien.',
  },
  'Vida académica': {
    personaje: 'cocuyo',
    acento: '#4f78a8',
    ambiente: 'libros',
    recomendada: 'retos-rapidos',
    frase: 'Entre tareas y exámenes, un reto rápido también ayuda a despejar la mente.',
  },
  'Relaciones y convivencia': {
    personaje: 'chigui',
    acento: '#b4644d',
    ambiente: 'corazones',
    recomendada: 'que-harias',
    frase: 'Aquí practicamos cómo convivir con respeto, incluso cuando no pensamos igual.',
  },
  'Cambios y nuevas etapas': {
    personaje: 'cocuyo',
    acento: '#4f8a62',
    ambiente: 'brotes',
    recomendada: 'detecta-el-riesgo',
    frase: 'Los cambios se viven mejor acompañados. Explora a tu ritmo.',
  },
  'Hablar con alguien': {
    personaje: 'chigui',
    acento: '#6f5aa8',
    ambiente: 'burbujas',
    recomendada: 'detecta-el-riesgo',
    frase: 'Si necesitas apoyo de una institución, «Necesito ayuda» está siempre arriba.',
  },
};

export const mundoDeSala = (tema: string): MundoSala => MUNDOS[tema] ?? MUNDO_BASE;

/** Mensajes predefinidos de los personajes dentro de las salas. */
export const MENSAJES_SALA = {
  bienvenida: (sala: string) =>
    `¡Te damos la bienvenida a «${sala}»! ¿Te animas a participar en un reto?`,
  completado: '¡Buen trabajo! Has completado esta actividad.',
  otro: '¿Quieres probar otro desafío?',
  perfecto: '¡Todas tus decisiones fueron las recomendadas! Así se cuida una comunidad.',
  consejos: [
    'Antes de responder, lee con calma: detrás de cada alias hay una persona de tu edad.',
    'Si algo te incomoda, puedes reportarlo. Nadie sabrá que fuiste tú.',
    'Tu teléfono, tu dirección y tu colegio son solo tuyos: aquí no se comparten.',
    'Puedes no estar de acuerdo con alguien y decirlo con respeto.',
    'Si una conversación te hace sentir mal, puedes salir de la sala cuando quieras.',
  ],
};

// ── Objetos interactivos de la sala (cuelgan de la pared del escenario) ─────────────────
export type IdTareaSala =
  'conectar' | 'ordenar' | 'animo' | 'que-harias' | 'detecta' | 'retos' | 'minijuegos';
export type IdObjetoSala =
  'tablero' | 'pizarra' | 'cafe' | 'encuentro' | 'escritorio' | 'estanteria' | 'arcade';

export const OBJETOS_SALA: {
  id: IdObjetoSala;
  objeto: string;
  tarea: IdTareaSala;
  titulo: string;
  instruccion: string;
}[] = [
  {
    id: 'tablero',
    objeto: 'Tablero de ideas',
    tarea: 'conectar',
    titulo: 'Conectar ideas',
    instruccion: 'Une cada concepto con su idea.',
  },
  {
    id: 'pizarra',
    objeto: 'Pizarra',
    tarea: 'ordenar',
    titulo: 'Ordenar ideas',
    instruccion: 'Pon los pasos en el orden correcto.',
  },
  {
    id: 'cafe',
    objeto: 'Máquina de café',
    tarea: 'animo',
    titulo: 'Estado de ánimo',
    instruccion: 'Cuéntale a la sala, en privado, cómo te sientes hoy.',
  },
  {
    id: 'encuentro',
    objeto: 'Punto de encuentro',
    tarea: 'que-harias',
    titulo: '¿Qué harías?',
    instruccion: 'Elige qué harías en una situación cotidiana.',
  },
  {
    id: 'escritorio',
    objeto: 'Escritorio de tareas',
    tarea: 'detecta',
    titulo: 'Detecta el riesgo',
    instruccion: '¿Es un riesgo o es seguro?',
  },
  {
    id: 'estanteria',
    objeto: 'Estantería',
    tarea: 'retos',
    titulo: 'Retos rápidos',
    instruccion: 'Encuentra las parejas y responde tres preguntas.',
  },
  {
    id: 'arcade',
    objeto: 'Rincón de juegos',
    tarea: 'minijuegos',
    titulo: 'Minijuegos del valle',
    instruccion: 'Elige un juego corto. No hay puntos ni premios: es solo para divertirse.',
  },
];

/** Mensajes de los bots de la sala: breves, contextuales y sin datos personales. */
export const MENSAJES_BOTS = {
  saludo: '¡Hola! ¿Te animas a probar una actividad?',
  explorar: 'Puedes explorar los objetos de esta sala: tócalos para jugar.',
  privacidad: 'Recuerda que puedes participar sin compartir información personal.',
  logro: '¡Buen trabajo! Has completado el reto.',
  otro: '¿Quieres probar otro objeto de la sala?',
};
