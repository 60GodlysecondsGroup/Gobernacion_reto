/**
 * Catálogo de intenciones autorizadas de Cocuyo, la guía de inicio (F25). Es la fuente de verdad
 * del backend: Cocuyo solo responde estos temas y la IA solo recibe la respuesta autorizada del
 * tema elegido. Nada fuera de esta lista se genera.
 *
 * Los siete temas son los mismos de `apps/frontend/src/config/guia.ts` (botones de la guía y
 * página /guia). La prueba `test/cocuyo-catalogo.test.ts` exige que sean idénticos: si cambias
 * un texto aquí, cámbialo también allí (el frontend lo necesita para responder sin red).
 *
 * `senales` alimenta el clasificador local (sin IA). Sintaxis de cada señal:
 *   grupos separados por « + » (todos deben aparecer), alternativas por «|» (basta una),
 *   «*» al final para aceptar cualquier terminación y «=» al inicio para exigir la palabra exacta. Las palabras se comparan sin tildes, con
 *   ortografía fonética (b/v, s/z/c, k/qu, j/g…) y tolerando errores de una o dos letras.
 */

export type Enlace = { href: string; texto: string };

export const IDS_TEMAS = [
  'que-es',
  'comunidad',
  'privacidad',
  'salas',
  'reportar',
  'orientacion',
  'limites',
] as const;
export type IdTema = (typeof IDS_TEMAS)[number];

/** Intenciones de conversación que no son temas: se responden siempre con texto fijo. */
export const IDS_META = ['saludo', 'capacidades', 'cortesia'] as const;
export type IdMeta = (typeof IDS_META)[number];
export type IdIntencion = IdTema | IdMeta;

/** [peso, señal]. */
export type Senal = readonly [number, string];

export type TemaCocuyo = {
  id: IdTema;
  /** Texto del botón de acceso rápido (idéntico al del frontend). */
  pregunta: string;
  /** Respuesta autorizada (predeterminada). Es lo único que la IA puede reformular. */
  parrafos: string[];
  enlace?: Enlace;
  /** El frontend muestra los canales institucionales reales (fuente y fecha) debajo. */
  conCanales?: boolean;
  /** Qué cubre el tema, para el clasificador con IA. No se usa como respuesta. */
  descripcion: string;
  senales: Senal[];
};

export const PRESENTACION_GUIA =
  'Hola, soy Cocuyo. Te explico cómo funciona la plataforma: escríbeme tu pregunta o elige una de las preguntas frecuentes. Soy una guía automática, no una persona profesional: no doy diagnósticos ni consejos médicos.';

export const TEMAS: TemaCocuyo[] = [
  {
    id: 'que-es',
    pregunta: '¿Qué es esta plataforma?',
    parrafos: [
      'Un lugar para encontrar información de instituciones sobre bienestar y canales de apoyo, y para conversar con jóvenes de tu misma edad.',
      'La información institucional siempre dice de dónde viene y cuándo se verificó. Esta plataforma no presta servicios de salud: te acerca a quienes sí lo hacen.',
    ],
    enlace: { href: '/orientacion', texto: 'Ir a Orientación' },
    descripcion:
      'Qué es la plataforma, para qué sirve, de qué se trata, de dónde sale su información institucional.',
    senales: [
      [3, 'que + es + plataforma|pagina|app|aplicacion|sitio|esto|refugio|web'],
      [3, 'para + que + sirve*'],
      [2, 'trata|va + plataforma|pagina|app|aplicacion|sitio|esto|web'],
      [2, 'como + funciona* + plataforma|pagina|app|aplicacion|sitio|esto|web|refugio'],
      [3, 'donde + sale|viene|vienen|sacan + informacion'],
      [1, 'plataforma|pagina|app|aplicacion|sitio|refugio|web'],
      [1, 'informacion + institucion*'],
    ],
  },
  {
    id: 'comunidad',
    pregunta: '¿Quién puede ver lo que publico?',
    parrafos: [
      'Solo las personas de tu comunidad, que es la de tu rango de edad: de 10 a 12, de 13 a 15, de 16 a 17 o de 18 a 22 años.',
      'Nadie de otro rango puede ver tus hilos, tus respuestas, tu perfil ni las salas en las que estás. Tampoco puede buscarte.',
      'Apareces con tu alias y tu avatar. Tu edad exacta no se muestra en ninguna parte.',
    ],
    enlace: { href: '/comunidad', texto: 'Ir a mi comunidad' },
    descripcion:
      'Quién puede ver lo que publica la persona, comunidades por rango de edad, visibilidad del perfil, alias, avatar y edad.',
    senales: [
      [3, 'quien|quienes + ver|ven|veo|mira*|lee*|leer|buscar*|encontrar*'],
      [
        2,
        'otro*|otra*|demas|gente|personas|adulto*|mayor*|grande* + ver|ven|verme|mira*|lee*|leer',
      ],
      [2, 'rango* + edad*'],
      [2, 'edad + exacta|muestra*|aparece*|ven|ver|sabe*'],
      [2, 'buscarme|encontrarme|verme'],
      [2, 'comunidad*'],
      [2, 'cuantos + anos'],
      [1, 'edad*'],
      [1, 'public*|post*|hilo*|comentario*'],
      [1, 'perfil|alias'],
      [1, 'privad*'],
    ],
  },
  {
    id: 'privacidad',
    pregunta: '¿Por qué no se publicó mi mensaje?',
    parrafos: [
      'Antes de publicar, un filtro revisa el texto. Si encuentra datos como un teléfono, un correo, una dirección, una red social o tu edad exacta, el mensaje no se publica.',
      'Tu texto queda en el campo para que lo corrijas. Nadie más lo ve y el sistema no guarda lo que escribiste.',
      'El filtro no detecta todo. Por eso también existen los reportes y las personas de moderación.',
    ],
    descripcion:
      'Por qué un mensaje no se publicó o fue bloqueado: filtro de privacidad que detecta teléfonos, correos, direcciones, redes sociales o edad exacta.',
    senales: [
      [3, 'no + public*'],
      [
        3,
        'no + aparece*|sale|salio|envia|envio|subio|sube|deja|dejo|manda|mando + mensaje*|post*|comentario*|respuesta*|texto*|publicacion*|hilo*',
      ],
      [3, 'filtro*'],
      [3, 'bloque* + mensaje*|post*|comentario*|texto*|publicacion*|respuesta*'],
      [2, 'borr*|desaparec*|elimin* + mensaje*|post*|comentario*|publicacion*|respuesta*'],
      [
        2,
        'telefono|correo|direccion|red|redes|instagram|whatsapp|tiktok|numero + public*|poner|pongo|compartir|escribir|mensaje*',
      ],
      [2, 'dato* + personal*'],
      [2, 'guarda* + escrib*|mensaje*|texto*|dato*|conversacion*'],
      [1, 'bloque*'],
      [1, 'privacidad'],
    ],
  },
  {
    id: 'salas',
    pregunta: '¿Cómo funcionan las salas?',
    parrafos: [
      'Cada sala tiene un tema fijo y admite hasta 10 personas a la vez. Antes de entrar ves sus reglas y cuántas personas hay.',
      'Dentro, mueves tu avatar con las teclas W, A, S y D, con las flechas o haciendo clic en una casilla libre. Los demás ven tu movimiento.',
      'Puedes salir cuando quieras con «Salir de la sala». Una sala que queda vacía 3 minutos se cierra y se abre otra igual.',
    ],
    enlace: { href: '/salas', texto: 'Ver las salas' },
    descripcion:
      'Cómo funcionan las salas temáticas: capacidad, reglas, entrar, salir, mover el avatar con teclas o clic, cierre de salas vacías.',
    senales: [
      [3, 'sala|salas|salita*|=cuarto|=cuartos'],
      [2, 'mov*|muev* + avatar|personaje|muneco|monito'],
      [2, 'tecla*|wasd|flecha*|casilla*'],
      [2, 'cuantas|cuantos + personas|gente|caben|cupo'],
      [1, 'entrar|entro|ingres*|salir|salgo|unir*|unirme'],
      [1, 'avatar'],
    ],
  },
  {
    id: 'reportar',
    pregunta: '¿Qué hago si algo me incomoda?',
    parrafos: [
      'Usa «Reportar» en el hilo, la respuesta, el perfil o la sala. Elige un motivo y, si quieres, cuenta brevemente qué pasó.',
      'Verás «Tu reporte fue registrado.». Una persona de moderación lo revisa y puede ocultar el contenido o suspender una cuenta. No se le dice a nadie quién reportó.',
    ],
    enlace: { href: '/reglas', texto: 'Leer las reglas de la comunidad' },
    descripcion:
      'Qué hacer si algo o alguien incomoda, molesta, acosa o falta al respeto: reportar contenido o perfiles, moderación, anonimato de quien reporta.',
    senales: [
      [3, 'report*|denunci*'],
      [
        3,
        'incomod*|molest*|acos*|matoneo|bullying|bulin*|insult*|ofend*|amenaz*|irrespet*|grosero*|groseria*',
      ],
      [2, 'moderacion|moderador*'],
      [2, 'alguien + feo|mal|raro|groser*|pesad*'],
      [2, 'bloque* + persona|usuario|usuaria|alguien|perfil|cuenta'],
      [1, 'respeto|reglas'],
    ],
  },
  {
    id: 'orientacion',
    pregunta: '¿Dónde encuentro orientación?',
    parrafos: [
      'Estos son canales de instituciones. Cada uno indica quién lo ofrece, de dónde sale la información y cuándo se verificó.',
    ],
    conCanales: true,
    enlace: { href: '/ayuda', texto: 'Abrir «Necesito ayuda»' },
    descripcion:
      'Dónde encontrar orientación, ayuda o apoyo: canales y líneas de instituciones, hablar con alguien o con un profesional.',
    senales: [
      [3, 'orient*'],
      [3, 'necesito|necesita|quiero|busco + ayuda|apoyo|orient*'],
      [3, 'hablar|habla|hablo|converso|conversar + alguien|persona|profesional|psicolog*|adulto'],
      [3, 'donde + encuentr*|busc*|consig*|pid* + ayuda|apoyo|orient*|informacion|canal*'],
      [2, 'canal*|linea*|institucion*'],
      [2, 'psicolog*|terapeut*|consejer*'],
      [2, 'salud + mental'],
      [2, 'siento|estoy + triste|sola|solo|mal|angustiad*|preocupad*|estresad*|asustad*'],
      [1, 'ayuda|apoyo|auxilio|bienestar'],
    ],
  },
  {
    id: 'limites',
    pregunta: '¿Qué no puede hacer la plataforma?',
    parrafos: [
      'No hace diagnósticos, no reemplaza la atención profesional y no presta servicios de salud. Tampoco es un canal oficial de ninguna institución.',
      'Si necesitas hablar con alguien de una institución, el botón «Necesito ayuda» está siempre arriba, en todas las páginas.',
    ],
    descripcion:
      'Qué no puede hacer la plataforma: no diagnostica, no da consejos médicos, no reemplaza atención profesional, no presta servicios de salud, no es canal oficial.',
    senales: [
      [3, 'que + no + puede|hace|puedes|haces|ofrece'],
      [3, 'diagnost*|medic*|doctor*|tratamiento*|enfermedad*|sintoma*|medicament*|pastilla*'],
      [2, 'depresion|deprimid*|ansiedad|ansios*|trastorno*'],
      [2, 'oficial|gobernacion|alcaldia'],
      [3, 'canal|plataforma|pagina|esto|app|aplicacion + oficial'],
      [3, 'reemplaz*|sustitu* + profesional*|psicolog*|medic*|terapia|atencion'],
      [2, 'servicio* + salud'],
      [3, 'limite* + plataforma|pagina|app|aplicacion|esto|cocuyo'],
      [2, 'limite*'],
    ],
  },
];

export const TEMAS_POR_ID = new Map(TEMAS.map((tema) => [tema.id, tema]));

/** Respuestas fijas (sin IA) de las intenciones de conversación. */
export const RESPUESTAS_META: Record<IdMeta, { texto: string; senales: Senal[] }> = {
  saludo: {
    texto: PRESENTACION_GUIA,
    senales: [
      [1, 'hola|holi*|ola|buenas|buenos|buen|hey|saludos|epa|alo'],
      [1, 'que + mas'],
    ],
  },
  capacidades: {
    texto:
      'Soy Cocuyo, una guía automática de la plataforma. Solo puedo explicarte cómo funciona: qué es, quién ve lo que publicas, por qué un mensaje no se publicó, cómo funcionan las salas, qué hacer si algo te incomoda, dónde encontrar orientación y qué no puede hacer la plataforma.',
    senales: [
      [3, 'que + puedes|sabes|haces'],
      [3, 'quien + eres'],
      [3, 'eres|sos + bot|robot|ia|inteligencia|maquina|persona|humano|humana|real|chatgpt'],
      [3, 'como + llamas'],
      [2, 'ayudar*|ayudas|ayudame + en|con + que'],
    ],
  },
  cortesia: {
    texto: 'Con gusto. Si tienes otra pregunta sobre cómo funciona la plataforma, escríbeme.',
    senales: [
      [
        1,
        'gracias|grasias|graxias|chao|chau|adios|bye|listo|ok|okey|vale|perfecto|genial|entendido',
      ],
    ],
  },
};

/** Señales de temas que Cocuyo NO cubre (programación, política, entretenimiento, noticias…). */
export const SENALES_FUERA_DE_ALCANCE: Senal[] = [
  [3, 'program*|codigo|python|javascript|java|html|css|sql|algoritmo*|software|excel'],
  [3, 'politic*|president*|eleccion*|votar|voto|congreso|senado|alcalde|gobernador|candidat*'],
  [
    3,
    'pelicula*|serie|series|cancion*|musica|cantante*|netflix|anime|videojuego*|juego|juegos|futbol|partido|gol|mundial|deporte*',
  ],
  [3, 'chiste*|poema*|cuento*|adivinanza*|meme*|historia|trivia'],
  [3, 'noticia*|clima|horoscopo|signo'],
  [3, 'receta*|cocinar|comida'],
  [3, 'tarea*|matematica*|ecuacion*|ensayo*|traduc*|resumen|resumir|ingles|fisica|quimica'],
  [3, 'dinero|plata|precio|bitcoin|cripto*|invertir|apuesta*|negocio*'],
  [4, 'opin*|opinas|piensas'],
  [3, 'novio|novia|enamor*|ligar|coquete*'],
  [3, 'sexo|sexual*|porno*|droga*|alcohol|marihuana|fumar|vapear'],
  [2, 'redacta|redactame|inventa|inventame|cuentame|recomienda*|recomiendame'],
  [3, 'capital + de|pais'],
];

/** Respuestas de reserva. Ninguna pasa por la IA. */
export const RESPUESTAS_RESERVA = {
  fueraDeAlcance:
    'Eso no lo puedo responder: solo te ayudo con preguntas sobre cómo funciona esta plataforma. Puedes preguntarme, por ejemplo, por alguno de estos temas.',
  aclaracion:
    'No estoy seguro de qué quieres saber. ¿Te refieres a alguno de estos temas? También puedes escribir tu pregunta con otras palabras.',
  manipulacion:
    'Sigo siendo Cocuyo y mis reglas no cambian: solo explico cómo funciona la plataforma con información preparada. ¿Te ayudo con alguno de estos temas?',
  accion:
    'No puedo hacer acciones por ti ni consultar cuentas, mensajes o datos de nadie: solo explico cómo funciona la plataforma. Estos temas te pueden servir.',
  crisis:
    'Lo que cuentas es importante. Si estás en peligro inmediato, busca ahora a una persona de confianza que esté cerca o contacta los servicios de emergencia de tu zona. En «Necesito ayuda» están los canales de instituciones. Soy una guía automática: no puedo contactar a nadie.',
  datosPersonales:
    'Por tu seguridad, no escribas datos personales como tu nombre, teléfono, correo, dirección o edad exacta. No guardo lo que escribes.',
  notaFueraDeAlcance:
    'Sobre lo demás que preguntas no puedo ayudarte: solo explico cómo funciona la plataforma.',
} as const;

export const ENLACE_AYUDA: Enlace = { href: '/ayuda', texto: 'Abrir «Necesito ayuda»' };
