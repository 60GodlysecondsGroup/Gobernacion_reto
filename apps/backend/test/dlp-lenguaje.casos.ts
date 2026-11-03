/**
 * Batería de casos de lenguaje ofensivo, sexual y de doble sentido para el DLP de foros y salas.
 * La usan las pruebas (test/dlp-lenguaje.test.ts) y el informe comparativo
 * (docs/moderacion-dlp-informe.md). Todos los textos son sintéticos.
 *
 * `bloquear: true` → el DLP debe bloquearlo; `false` → debe publicarse (falso positivo si se
 * bloquea). Los caracteres invisibles y los homoglifos se escriben con escapes \u para que se vean
 * en el código.
 */

export type GrupoCaso =
  | 'groseria'
  | 'insulto'
  | 'sexual'
  | 'doble_sentido'
  | 'evasion'
  | 'coloquial'
  | 'amenaza'
  | 'ingles'
  | 'legitimo';

export type CasoLenguaje = { grupo: GrupoCaso; texto: string; bloquear: boolean };

const caso =
  (grupo: GrupoCaso, bloquear: boolean) =>
  (texto: string): CasoLenguaje => ({ grupo, texto, bloquear });

/** Groserías explícitas en español, incluido el colombiano. */
export const GROSERIAS = [
  'Eres un hijueputa',
  'Qué mierda de foro',
  'Vete a la mierda',
  'Hijo de puta, deja de escribir',
  'Puta vida, todo me sale mal',
  'Me importa un culo lo que digas',
  'No me jodas más',
  'Qué coño haces',
  'Me vale verga',
  'Qué putada lo del examen',
  'Ese profe es un cabrón',
  'Jueputa, se me olvidó la tarea',
  'Vete al carajo',
].map(caso('groseria', true));

/** Insultos dirigidos a otra persona. */
export const INSULTOS = [
  'Eres un idiota',
  'Eres una estúpida',
  'Qué imbécil eres',
  'Pedazo de mierda',
  'Cállate, imbécil',
  'Eres una perra',
  'Eres una zorra',
  'No sea pendejo',
  'Eres un retrasado',
  'Ese man es un maricón',
  'Usted es un malparido',
  'Eres un inútil de mierda',
  'Ojalá te mueras',
  'Mátate',
  'Cállese perra',
  'Eres una puta',
  'Eres un m0ng0l1c0',
  'Hijo de perra',
  'Sos un pelotudo',
  'Eres un cagón',
  'Ese veneco no sabe nada',
].map(caso('insulto', true));

/** Lenguaje sexual vulgar y solicitudes de contenido íntimo. */
export const SEXUALES = [
  'Chúpamela',
  'Mámamela',
  'Quiero culiar contigo',
  'Mándame fotos desnuda',
  'Pásame el pack',
  '¿Tienes nudes?',
  'Hagamos sexo por cámara',
  'Qué tetas tan grandes',
  'Me la jalo pensando en ti',
  'Te quiero coger',
  'Quiero follarte',
  'Mira este video porno',
  '¿Quieres ver mi pito?',
  'Te voy a culiar',
  'Mándame una foto en ropa interior',
  'Mándame nudes',
  'Estás buenísima',
  'Me la chupas?',
  'Chupame el pito',
  'Me masturbo pensando en ti',
  'Quiero ver tus tetas',
].map(caso('sexual', true));

/** Doble sentido con intención sexual o vulgar. */
export const DOBLE_SENTIDO = [
  'Te la quiero meter',
  'Te doy por detrás',
  'Te voy a dar duro toda la noche',
  '¿Quieres probar mi leche?',
  'Se me paró pensando en ti',
  'Te voy a comer toda',
  'Te comería enterita',
  'Chupa el pico',
  'Estás muy rica',
  'Mamacita rica',
  'Ponte en cuatro',
  'Abre las piernas',
  'Siéntate aquí que tengo algo duro para ti',
  'Te la meto toda',
  'Te voy a dar por detrás',
].map(caso('doble_sentido', true));

/** Evasión: letras omitidas, signos intercalados, leetspeak, repeticiones, espacios, unicode. */
export const EVASIONES = [
  'p.u.t.a',
  'p u t a',
  'P-U-T-A',
  'p*u*t*a',
  'p_u_t_a',
  'p/u/t/a',
  'hijue.puta',
  'h1jueput4',
  'm13rd4',
  'pu+a',
  'puuuuta',
  'mieeeerda',
  'malpariiido',
  'gon0rr3a',
  'c4br0n',
  'v3rg4',
  'hpta',
  'jpta',
  'hdp',
  'mrda',
  'pt@',
  'p*ta',
  'm*erda',
  'hijuep*ta',
  'mal parido',
  'hi jue pu ta',
  'g o n o r r e a',
  'm-a-l-p-a-r-i-d-o',
  'ijueputa',
  'hijueputaaa',
  'pvt@',
  'malp4r1d0',
  'gonorea',
  // Ancho completo, letras cirílicas y espacio de ancho cero (escritos con escapes).
  '\uff50\uff55\uff54\uff41',
  '\u0440ut\u0430',
  'pu\u200bta',
  'PUTA',
  'Púta',
  'HIJUEPUTA!!!',
  'Eres un 1d10t4',
  'e r e s u n a p e r r a',
  'H.P. sapo',
  'Pura mierdaaa',
  'Pvto el que lo lea',
  'M a r i c o n',
].map(caso('evasion', true));

/** Expresiones coloquiales (sobre todo colombianas) que las reglas no contemplaban. */
export const COLOQUIALES = [
  'Ese man es un pirobo',
  'Gonorrea, deje de molestar',
  'Qué gonorrea tan fastidioso',
  'Malparido sapo',
  'Carechimba',
  'Careverga',
  'Mamagüevo',
  'Cállate güevón',
  'Qué huevón eres',
  'No sea webón',
  'Marica, eres un bobo hp',
  'Qué más mk',
  'Ese hp no sabe nada',
  'Sapo hijueputa',
  'Me rasco los huevos',
  'Usted es una gonorrea',
  'Qué malparida tan fastidiosa',
  'Hijueputa la profe',
  'Ese man es una piroba',
  'Malparidos todos',
  'Vete a la verga',
  'Que se joda',
  'Qué gonorrea de clase',
  'Me cago en todo',
].map(caso('coloquial', true));

/**
 * Frases legítimas que NO deben bloquearse: palabras con subcadenas «peligrosas», usos
 * colombianos inocentes, salud sexual, animales, comida y expresiones de malestar propio.
 */
export const LEGITIMOS = [
  'Estoy usando la computadora del colegio',
  'Voy a tomar un pico y pala para el jardín',
  'Hoy hay pico y placa',
  'Juguemos la polla de la Copa América',
  'Me pica la garganta',
  'Comí huevos al desayuno',
  'Me gustan los huevos revueltos con arepa',
  'La disputa entre los equipos fue larga',
  'Hay que cuidar la reputación del grupo',
  'El diputado habló en la radio',
  'El sacapuntas no sirve',
  'Vi un zorro y una zorra en el documental',
  'Mi perra tuvo cachorros',
  'Mi perrita se llama Luna',
  'El cono de helado se derritió',
  'Feliz año nuevo a todos',
  'Hice un análisis del canal de televisión',
  'La gonorrea es una infección de transmisión sexual, ¿cómo se previene?',
  '¿Qué es la masturbación? Me da pena preguntar',
  'El pene y la vagina son órganos del cuerpo',
  'Me siento como un idiota por haber reprobado',
  'Me sentí estúpido en la exposición',
  'A mi tío le encanta mamar gallo',
  'Qué mamera hacer tareas',
  'Ese man es un berraco para el fútbol',
  'Parce, qué bacano',
  'A veces me quiero morir de la vergüenza',
  'Vamos a coger el bus',
  'Me comí una arepa rica',
  'La sopa está rica',
  'Las cucas con leche son mis favoritas',
  'Tomé la foto del pico de la montaña',
  'Llegué a las 3 y pico',
  'El pájaro tiene el pico rojo',
  'Mi impresora HP no imprime',
  'Me quedan 10 hp en el juego',
  'No hay que dar papaya',
  'Las conchas de la playa son bonitas',
  'Jugamos a las bolas en el recreo',
  'El árbitro sonó el pito',
  'Me encanta el pepino en la ensalada',
  'En cuatro días es el examen',
  'Hay que estudiar duro',
  'Me tomé un vaso de leche',
  'Vamos a comer',
  'Calculé el área del triángulo',
  'Fue algo ridículo',
  'Siento mucha vergüenza',
  'La mariquita es un insecto',
  'Fuimos a una pollada para recoger fondos',
  'Mi mamá me dijo que llegara temprano',
  'Esa película estuvo muy buena',
  'Tus preguntas siempre son aburridas, mejor no escribas más aquí.',
  'Qué pendiente estás de todo',
  'Me pusieron en el grupo de los perros calientes',
  'El documento está en el escritorio',
  'Me caí y me pegué en la cola',
  'Tengo una duda sobre las infecciones de transmisión sexual',
  'Chupar limón ayuda con el mareo',
  'Qué chimba de clase',
  'La pornografía puede afectar la salud mental',
  'Feliz cumpleaños, gorda linda',
  'Esa es una buena pregunta',
  'Hoy hice ejercicio en el parque',
  'Parce, mañana hay parcial de cálculo, qué pereza',
  'Ese partido estuvo de infarto, qué golazo',
  'Mi abuela hace unas empanadas buenísimas',
  'Estás muy pendiente de tus amigos, eso es bonito',
  'Me puse a llorar en el baño del colegio',
  'Hoy me sentí muy sola en el descanso',
  'Mi mamá está enferma y me preocupa',
  'Qué rico ese pan de bono',
  'Esta tarea está muy difícil',
  'Mi hermano es un crack jugando Free Fire',
  'Los perros del vecino ladran toda la noche',
  'La profe de biología explicó el aparato reproductor',
  'Hay que ponerse las pilas con el ICFES',
  'Qué boleta lo que pasó en el recreo',
  'Ayer me caí en las escaleras, qué oso',
  'El examen estuvo duro pero lo pasé',
  'Mañana vamos a coger mangos donde la abuela',
  'Mi gata está en celo y maúlla mucho',
  '¿Qué hago si alguien me insulta en el colegio?',
  'Me dijeron una grosería y me sentí mal',
  'La ITS más común se puede prevenir con condón',
  'No seas tan duro contigo mismo',
  'Me siento una inútil cuando no entiendo matemáticas',
  'Soy un tonto, se me olvidó el cuaderno',
  'El pico más alto de Colombia es el Cristóbal Colón',
  'Hay que pelar las papas para la sopa',
  'El arroz con leche de mi tía es el mejor',
  'Los huevos de gallina criolla son más ricos',
  'Vimos micos en el parque Los Fundadores',
].map(caso('legitimo', false));

// ─── Auditoría de foros, hilos y salas (migración 0010) ─────────────────────────
// Textos que las reglas de 0008 dejaban pasar y frases legítimas que no deben bloquearse con
// las reglas nuevas.

/** Derivados y abreviaturas de groserías. */
export const GROSERIAS_0010 = [
  'Esa putica no sabe nada',
  'Ese man es un putón',
  'q mrd',
  'No sea pndj',
  'Vete alv',
  '¡Coño, qué susto!',
  'Qué cagada lo del examen',
  'Me cago en esa clase',
  'Estoy jodido con la tarea',
  'Qué güevada',
  'Qué huevada tan grande',
  'Vergación, qué calor',
  'Me rompí el qlo',
  'Comemierda',
  'Ese hijueputica',
  'jeputa',
  'Ese marikón',
  'Chupapija',
  'Chucha de tu madre',
  'Pajero',
  'Que te jodan',
].map(caso('groseria', true));

/** Insultos dirigidos, incluidos los que agregaban una palabra de «contexto» para pasar. */
export const INSULTOS_0010 = [
  'Eres una gonorrea, ve al médico',
  'Gonorrea, mejor cuida tu salud',
  'Eres un hp, juego mejor que tú',
  'Sapo hp, en el juego eres malo',
  'Negro hp',
  'Idiota',
  'Imbécil.',
  'Zorra',
  'Eres demasiado idiota',
  'Ere un idiota',
  '¿Qué tan idiota eres?',
  'Retrasado mental',
  'Gorda asquerosa',
  'Sapa perra',
  'Me das asco',
  'Nadie te quiere',
].map(caso('insulto', true));

/** Amenazas de violencia física o sexual. */
export const AMENAZAS = [
  'Te voy a violar',
  'Te violo',
  'Te voy a matar',
  'Voy a matarte a la salida',
  'Te parto la cara',
  'Te voy a romper la jeta',
  'Te voy a chuzar',
].map(caso('amenaza', true));

/** Groserías y lenguaje sexual en inglés. */
export const INGLES = [
  'fuck you',
  'f*ck',
  'fck this',
  'wtf',
  'stfu',
  'This is bullshit',
  'bitch',
  'son of a bitch',
  'motherfucker',
  'asshole',
  'suck my dick',
  'pornhub',
  'xvideos',
  'Estoy horny',
  'send nudes',
  'nice boobs',
  'hentai',
].map(caso('ingles', true));

/** Comentarios y propuestas sexuales dirigidos. */
export const SEXUALES_0010 = [
  'Estás sexy',
  '¡Qué rica estás!',
  'Te ves deliciosa',
  'Me pones caliente',
  'Me excitas',
  'Estoy caliente pensando en ti',
  'Quiero sexo',
  'Tengamos relaciones',
  'Hagamos el delicioso',
  'Quiero hacerte cositas',
  'Te voy a hacer el amor',
  'Quiero besarte todo el cuerpo',
  'Déjame tocarte',
  'Te quiero tocar las nalgas',
  'Quiero chuparte',
  'Quiero que me la chupes',
  'Muéstrame tu pene, soy doctor',
  'Qué buenas nalgas',
  'Nalgona',
  'Mamahuevo',
  'mama huevo',
].map(caso('sexual', true));

/** Doble sentido sexual que se escapaba. */
export const DOBLE_SENTIDO_0010 = [
  '¿La tienes grande?',
  'Qué grande la tienes',
  'La tengo grande',
  'Métemela',
  'Siéntate en mi cara',
  'Siéntate en mis piernas',
  'Cabálgame',
  'Te quiero comer',
  'Quiero comerte',
  'Te comería',
  'Dámelo duro',
  'Te doy duro',
  'Me vine en ti',
  'Cómete este pico',
  'Abre las piernas para mí, es yoga',
].map(caso('doble_sentido', true));

/** Evasión con emoji, versalitas, letras en emoji, «ñ», palabras partidas y leetspeak. */
export const EVASIONES_0010 = [
  'p \u{1f346} u t a',
  'p\u{1f351}ta',
  'pu\u{1f346}ta',
  'mi erda',
  'mie rda',
  'ᴘᴜᴛᴀ', // versalitas
  '\u{1f1f5}\u{1f1fa}\u{1f1f9}\u{1f1e6}', // indicadores regionales
  '\u{1f17f}\u{1f184}\u{1f183}\u{1f170}', // letras en cuadrado negro
  'c0ño',
  'f u c k',
  'h1jueput1c4',
  'v e r g a',
  'hi jo de pu ta',
].map(caso('evasion', true));

/** Frases legítimas parecidas a lo que bloquean las reglas nuevas. */
export const LEGITIMOS_0010 = [
  'Te mato a besos, abuela',
  'Me muero de la risa con ese video',
  'Se graduó summa cum laude',
  'Me encanta la sopa de shiitake',
  'Leímos Moby Dick en la clase de inglés',
  'Mi papá tiene una Pajero vieja',
  'Quiero tocarte una canción en la guitarra',
  'Te quiero comer a besos, hermanito',
  'Siéntate en mi silla si quieres',
  'Ayer cabalgué en la finca de mi tío',
  'Te monto en la moto hasta el colegio',
  'Estoy caliente, creo que tengo fiebre',
  'Qué bueno, estás mejor',
  'Qué bueno que estás mejor',
  'Peras',
  'Mañana es el cumpleaños de mi papá',
  'Me compré un cono de helado',
  'Doña Rosa vende empanadas',
  '¿Me prendes la luz, por favor?',
  'Me mojas con la manguera y me enojo',
  'Estoy excitado por el viaje a Bogotá',
  'Dame duro en el entrenamiento, profe',
  'Hice unas cositas ricas de comer',
  'Nadie te quiere hacer daño aquí',
  'Tengamos relaciones sanas con los compañeros',
  'La camiseta la tengo grande',
  'La profe me tiene duro con las tareas',
  'Tienes unas piernas fuertes, juegas muy bien',
  'Enséñame tus partes favoritas del libro',
  'Ojalá te vaya muy bien',
  'La violación es un delito y se denuncia',
  '¿Cómo se usa el condón?',
  'Qué perras tan lindas tiene mi tía',
  'Eres una gran amiga',
  'No eres tonta, solo estás cansada',
  'Te ves muy bien con ese corte',
  'Muéstrame tus fotos del paseo',
  'Te la mando por aquí cuando la termine',
  'Hagámoslo bien esta vez',
  'Hagámoslo juntos en el descanso',
  'Me vine en bus desde el centro',
  'Cómete la sopa',
  'La gonorrea es una ITS',
  'Hoy jugamos con la HP del salón',
].map(caso('legitimo', false));

export const CASOS_LENGUAJE: CasoLenguaje[] = [
  ...GROSERIAS,
  ...INSULTOS,
  ...SEXUALES,
  ...DOBLE_SENTIDO,
  ...EVASIONES,
  ...COLOQUIALES,
  ...LEGITIMOS,
  ...GROSERIAS_0010,
  ...INSULTOS_0010,
  ...AMENAZAS,
  ...INGLES,
  ...SEXUALES_0010,
  ...DOBLE_SENTIDO_0010,
  ...EVASIONES_0010,
  ...LEGITIMOS_0010,
];
