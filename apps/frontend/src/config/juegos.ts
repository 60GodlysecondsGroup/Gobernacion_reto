/**
 * Minijuegos educativos (opcionales). Contenido original sobre convivencia y seguridad digital,
 * con situaciones genéricas: no hay personas reales, no se piden datos y no se guardan puntajes.
 * Para editar un juego basta con cambiar esta lista.
 */
export type OpcionJuego = {
  texto: string;
  /** La respuesta recomendada. */
  correcta: boolean;
  /** Por qué: se muestra después de elegir. */
  explicacion: string;
  /** Solo en «Construye una comunidad segura»: cómo cambia el clima de la comunidad. */
  impacto?: number;
};

export type PasoJuego = { enunciado: string; opciones: OpcionJuego[] };

export type Juego = {
  id: 'que-harias' | 'detecta-el-riesgo' | 'comunidad-segura' | 'retos-rapidos';
  titulo: string;
  descripcion: string;
  /** Qué se aprende (aparece en la tarjeta del juego). */
  tema: string;
  minutos: number;
  /** Muestra el medidor «Clima de la comunidad». */
  conMedidor?: boolean;
  pasos: PasoJuego[];
};

const RIESGO = (riesgo: boolean, explicacion: string): OpcionJuego[] => [
  { texto: 'Es un riesgo', correcta: riesgo, explicacion },
  { texto: 'Es seguro', correcta: !riesgo, explicacion },
];

export const JUEGOS: Juego[] = [
  {
    id: 'que-harias',
    titulo: '¿Qué harías?',
    descripcion: 'Situaciones cotidianas en la comunidad. Elige cómo actuarías y descubre por qué.',
    tema: 'Convivencia',
    minutos: 3,
    pasos: [
      {
        enunciado:
          'En un hilo, alguien se burla de la forma en que otra persona escribe. Varias personas empiezan a reírse.',
        opciones: [
          {
            texto: 'Reportar el comentario y no sumarme a las burlas.',
            correcta: true,
            explicacion:
              'Reportar avisa a moderación sin exponerte, y no sumarte corta la cadena de burlas.',
          },
          {
            texto: 'Reírme también, para no quedar mal con el grupo.',
            correcta: false,
            explicacion:
              'Sumarse hace que la burla crezca. Las reglas no permiten burlas que hagan sentir mal a otros.',
          },
          {
            texto: 'Responder con otro insulto para defender a la persona.',
            correcta: false,
            explicacion:
              'Responder con insultos empeora la situación y también rompe las reglas. Mejor reportar.',
          },
        ],
      },
      {
        enunciado:
          'Una persona de tu sala te escribe: «¿Por qué no hablamos por otra app? Pásame tu número».',
        opciones: [
          {
            texto: 'Seguir conversando aquí y no compartir mi número.',
            correcta: true,
            explicacion:
              'Aquí la conversación está protegida. Pedir contacto externo es una señal de alerta; puedes reportarlo.',
          },
          {
            texto: 'Dárselo, parece buena onda.',
            correcta: false,
            explicacion:
              'Fuera de la plataforma no hay filtros ni moderación. Tus datos de contacto son solo tuyos.',
          },
          {
            texto: 'Darle el número de otra persona.',
            correcta: false,
            explicacion:
              'Los datos de otras personas tampoco se comparten. Lo mejor es seguir aquí o reportar.',
          },
        ],
      },
      {
        enunciado: 'Ves un hilo de alguien que dice sentirse muy mal y no sabe qué hacer.',
        opciones: [
          {
            texto: 'Responder con respeto y recordarle que existe «Necesito ayuda».',
            correcta: true,
            explicacion:
              'Una respuesta amable y los canales institucionales pueden ayudar. No tienes que resolverlo sola o solo.',
          },
          {
            texto: 'Ignorarlo: no es mi problema.',
            correcta: false,
            explicacion:
              'No estás obligada u obligado a resolverlo, pero un mensaje amable o señalar los canales de ayuda puede servir.',
          },
          {
            texto: 'Darle un diagnóstico de lo que creo que le pasa.',
            correcta: false,
            explicacion:
              'Aquí compartimos experiencias, no diagnósticos. Para eso están los canales institucionales.',
          },
        ],
      },
      {
        enunciado: 'Quieres contar en un hilo que te fue muy bien en el colegio esta semana.',
        opciones: [
          {
            texto: 'Contarlo sin decir el nombre del colegio ni dónde queda.',
            correcta: true,
            explicacion:
              'Puedes compartir lo que vives sin datos que te identifiquen, como el colegio o tu barrio.',
          },
          {
            texto: 'Contarlo con el nombre del colegio y mi curso.',
            correcta: false,
            explicacion:
              'El nombre del colegio y el curso permiten ubicarte. Por eso el filtro los bloquea.',
          },
        ],
      },
    ],
  },
  {
    id: 'detecta-el-riesgo',
    titulo: 'Detecta el riesgo',
    descripcion: 'Mensajes y situaciones digitales. ¿Es un riesgo o es seguro?',
    tema: 'Seguridad digital',
    minutos: 2,
    pasos: [
      {
        enunciado: '«Te gané un premio. Solo dime tu dirección para enviártelo».',
        opciones: RIESGO(
          true,
          'Pedir tu dirección a cambio de un premio es una trampa común. Nunca compartas dónde vives.',
        ),
      },
      {
        enunciado: 'Usar un alias y un avatar en lugar de tu nombre real y tu foto.',
        opciones: RIESGO(
          false,
          'Es la forma segura de participar: los demás te conocen por tu alias, no por tus datos.',
        ),
      },
      {
        enunciado: '«No le cuentes a nadie que hablamos. Es nuestro secreto».',
        opciones: RIESGO(
          true,
          'Pedir secretos es una señal de alerta. Puedes contarlo a una persona de confianza y reportarlo.',
        ),
      },
      {
        enunciado: 'Revisar la fuente y la fecha de verificación de un servicio antes de llamar.',
        opciones: RIESGO(
          false,
          'Así sabes que la información viene de una institución y está actualizada.',
        ),
      },
      {
        enunciado: '«Mándame una foto tuya para saber cómo eres de verdad».',
        opciones: RIESGO(
          true,
          'Nadie necesita una foto tuya para conversar aquí. Puedes negarte y reportar.',
        ),
      },
      {
        enunciado: 'Reportar un mensaje que te hizo sentir incómoda o incómodo.',
        opciones: RIESGO(
          false,
          'Reportar es seguro: moderación lo revisa y no se le dice a nadie quién reportó.',
        ),
      },
    ],
  },
  {
    id: 'comunidad-segura',
    titulo: 'Construye una comunidad segura',
    descripcion: 'Tus decisiones cambian el clima de la comunidad. ¿Cómo quedará al final?',
    tema: 'Convivencia',
    minutos: 3,
    conMedidor: true,
    pasos: [
      {
        enunciado: 'Llega una persona nueva a la sala y nadie le habla.',
        opciones: [
          {
            texto: 'Saludarla y preguntarle de qué le gusta hablar.',
            correcta: true,
            impacto: 20,
            explicacion: 'Un saludo hace que alguien nuevo se sienta parte de la comunidad.',
          },
          {
            texto: 'Seguir en lo mío.',
            correcta: false,
            impacto: 0,
            explicacion:
              'No pasa nada malo, pero pierdes la oportunidad de que se sienta bienvenida.',
          },
        ],
      },
      {
        enunciado: 'Dos personas discuten fuerte porque no piensan igual sobre un tema.',
        opciones: [
          {
            texto: 'Recordar con calma que se puede no estar de acuerdo con respeto.',
            correcta: true,
            impacto: 20,
            explicacion: 'Recordar el respeto ayuda a bajar la tensión sin tomar partido.',
          },
          {
            texto: 'Elegir un bando y atacar al otro.',
            correcta: false,
            impacto: -20,
            explicacion: 'Atacar divide a la comunidad. Las diferencias se conversan con respeto.',
          },
          {
            texto: 'Reportar si hay insultos.',
            correcta: true,
            impacto: 15,
            explicacion: 'Si la discusión se vuelve ofensiva, reportar deja que moderación actúe.',
          },
        ],
      },
      {
        enunciado: 'Alguien comparte por error un dato personal en un mensaje.',
        opciones: [
          {
            texto: 'Avisarle con amabilidad para que no lo vuelva a hacer.',
            correcta: true,
            impacto: 20,
            explicacion:
              'Cuidarnos entre todos es parte de la comunidad. El filtro también ayuda a bloquearlo.',
          },
          {
            texto: 'Guardar el dato por si acaso.',
            correcta: false,
            impacto: -25,
            explicacion: 'Los datos de otras personas no se guardan ni se comparten.',
          },
        ],
      },
      {
        enunciado: 'Ves que alguien publica un consejo de salud como si fuera profesional.',
        opciones: [
          {
            texto: 'Sugerir consultar los canales institucionales de Orientación.',
            correcta: true,
            impacto: 15,
            explicacion:
              'Aquí compartimos experiencias. La información de salud viene de instituciones con fuente.',
          },
          {
            texto: 'Compartirlo con más personas.',
            correcta: false,
            impacto: -15,
            explicacion:
              'Difundir consejos sin fuente puede hacer daño. Mejor señalar Orientación.',
          },
        ],
      },
      {
        enunciado: 'Terminas de conversar en una sala con buen ambiente.',
        opciones: [
          {
            texto: 'Despedirme y agradecer la conversación.',
            correcta: true,
            impacto: 15,
            explicacion: 'Los pequeños gestos hacen que todos quieran volver.',
          },
          {
            texto: 'Salir sin decir nada.',
            correcta: false,
            impacto: 0,
            explicacion: 'Está bien salir, pero una despedida suma al buen clima.',
          },
        ],
      },
    ],
  },
];

/** Clima inicial de la comunidad en el juego de decisiones (0–100). */
export const CLIMA_INICIAL = 30;

// ── Retos rápidos: parejas de memoria y asociación, y tres preguntas cortas ──────────────
export type ParejaReto = { id: string; concepto: string; significado: string };

export const PAREJAS_RETO: ParejaReto[] = [
  { id: 'alias', concepto: 'Alias', significado: 'El nombre que usas aquí en vez del real' },
  { id: 'reportar', concepto: 'Reportar', significado: 'Avisar a moderación sin exponerte' },
  { id: 'dato', concepto: 'Dato personal', significado: 'Teléfono, dirección o colegio' },
  { id: 'fuente', concepto: 'Fuente', significado: 'Quién publicó y verificó la información' },
];

export const PREGUNTAS_RAPIDAS: Juego = {
  id: 'retos-rapidos',
  titulo: 'Preguntas rápidas',
  descripcion: 'Tres preguntas cortas para cerrar el reto.',
  tema: 'Retos rápidos',
  minutos: 1,
  pasos: [
    {
      enunciado: '¿Quién puede ver lo que escribes en esta sala?',
      opciones: [
        {
          texto: 'Solo personas de mi comunidad que están en la sala',
          correcta: true,
          explicacion: 'Las salas son de tu comunidad y el chat no se guarda.',
        },
        {
          texto: 'Cualquier persona en internet',
          correcta: false,
          explicacion: 'No: nadie de otro rango de edad ni de fuera de la plataforma ve la sala.',
        },
      ],
    },
    {
      enunciado: 'Si un mensaje tuyo no se publicó, ¿qué pasó?',
      opciones: [
        {
          texto: 'El filtro encontró un dato personal o lenguaje ofensivo',
          correcta: true,
          explicacion: 'El filtro revisa antes de publicar para cuidarte. Puedes corregirlo.',
        },
        {
          texto: 'Me castigaron para siempre',
          correcta: false,
          explicacion: 'No es un castigo: solo se evita publicar algo que te exponga o lastime.',
        },
      ],
    },
    {
      enunciado: '¿Dónde encuentras canales de apoyo de instituciones?',
      opciones: [
        {
          texto: 'En «Necesito ayuda», siempre visible arriba',
          correcta: true,
          explicacion: 'Lleva directo a canales verificados, sin pasos intermedios.',
        },
        {
          texto: 'Pidiéndoselos a alguien por mensaje privado',
          correcta: false,
          explicacion: 'Los canales oficiales están en «Necesito ayuda», con su fuente.',
        },
      ],
    },
  ],
};

/** Actividades del rincón de cada sala (los juegos viven dentro de las salas). */
export type IdActividad = Juego['id'];

export const ACTIVIDADES_SALA: { id: IdActividad; titulo: string; descripcion: string }[] = [
  ...JUEGOS.map((j) => ({ id: j.id as IdActividad, titulo: j.titulo, descripcion: j.descripcion })),
  {
    id: 'retos-rapidos',
    titulo: 'Retos rápidos',
    descripcion: 'Memoria y asociación: encuentra las parejas y responde tres preguntas.',
  },
];

// ── Tareas rápidas de las salas (5 a 10 segundos). Todo es local: nada se guarda. ────────
/** Conectar ideas: cada concepto con la idea que le corresponde. */
export const CONECTAR_IDEAS: { id: string; concepto: string; idea: string }[] = [
  { id: 'alias', concepto: 'Alias', idea: 'Participar sin dar tu nombre real' },
  { id: 'reporte', concepto: 'Reporte', idea: 'Avisar a moderación sin exponerte' },
  { id: 'fuente', concepto: 'Fuente', idea: 'Saber de dónde viene la información' },
];

/** Ordenar ideas: los pasos en el orden correcto. */
export const ORDENAR_IDEAS = {
  enunciado: 'Ordena los pasos antes de publicar un mensaje',
  pasos: [
    'Escribe lo que quieres decir',
    'Revisa que no tenga datos personales',
    'Léelo otra vez: ¿suena respetuoso?',
    'Publícalo',
  ],
};

/** Estado de ánimo: cinco niveles con una respuesta breve. No se guarda ni se comparte. */
export const NIVELES_ANIMO: { etiqueta: string; respuesta: string; ayuda?: boolean }[] = [
  {
    etiqueta: 'Muy mal',
    respuesta:
      'Gracias por contarlo. No tienes que pasarlo sola o solo: en «Necesito ayuda» hay canales de instituciones para hablar con alguien.',
    ayuda: true,
  },
  {
    etiqueta: 'Mal',
    respuesta:
      'Hay días difíciles. Hablar con una persona de confianza puede ayudar, y «Necesito ayuda» siempre está arriba.',
    ayuda: true,
  },
  {
    etiqueta: 'Más o menos',
    respuesta: 'Está bien no estar al cien. Una pausa corta o una conversación tranquila puede sumar.',
  },
  { etiqueta: 'Bien', respuesta: '¡Qué bueno! Aprovecha para compartir algo positivo con tu comunidad.' },
  { etiqueta: 'Muy bien', respuesta: '¡Excelente! Tu buena energía también contagia a la sala.' },
];
