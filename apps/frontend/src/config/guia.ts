/**
 * Contenido preestablecido de la guía virtual (F25, Fase 8). La guía NO es un chatbot: no recibe
 * texto libre, no simula ser una persona profesional, no diagnostica y no da consejos médicos.
 * Solo explica cómo usar la plataforma y dónde encontrar orientación institucional.
 */
export type TemaGuia = {
  id: string;
  pregunta: string;
  parrafos: string[];
  enlace?: { href: string; texto: string };
  /** Muestra los canales institucionales con su fuente y fecha de verificación. */
  conCanales?: boolean;
};

export const PRESENTACION_GUIA =
  'Hola, soy Cocuyo. Te explico cómo funciona la plataforma con respuestas preparadas. No soy una persona profesional: no doy diagnósticos ni consejos médicos.';

export const TEMAS_GUIA: TemaGuia[] = [
  {
    id: 'que-es',
    pregunta: '¿Qué es esta plataforma?',
    parrafos: [
      'Un lugar para encontrar información de instituciones sobre bienestar y canales de apoyo, y para conversar con jóvenes de tu misma edad.',
      'La información institucional siempre dice de dónde viene y cuándo se verificó. Esta plataforma no presta servicios de salud: te acerca a quienes sí lo hacen.',
    ],
    enlace: { href: '/orientacion', texto: 'Ir a Orientación' },
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
  },
  {
    id: 'privacidad',
    pregunta: '¿Por qué no se publicó mi mensaje?',
    parrafos: [
      'Antes de publicar, un filtro revisa el texto. Si encuentra datos como un teléfono, un correo, una dirección, una red social o tu edad exacta, el mensaje no se publica.',
      'Tu texto queda en el campo para que lo corrijas. Nadie más lo ve y el sistema no guarda lo que escribiste.',
      'El filtro no detecta todo. Por eso también existen los reportes y las personas de moderación.',
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
  },
  {
    id: 'reportar',
    pregunta: '¿Qué hago si algo me incomoda?',
    parrafos: [
      'Usa «Reportar» en el hilo, la respuesta, el perfil o la sala. Elige un motivo y, si quieres, cuenta brevemente qué pasó.',
      'Verás «Tu reporte fue registrado.». Una persona de moderación lo revisa y puede ocultar el contenido o suspender una cuenta. No se le dice a nadie quién reportó.',
    ],
    enlace: { href: '/reglas', texto: 'Leer las reglas de la comunidad' },
  },
  {
    id: 'orientacion',
    pregunta: '¿Dónde encuentro orientación?',
    parrafos: [
      'Estos son canales de instituciones. Cada uno indica quién lo ofrece, de dónde sale la información y cuándo se verificó.',
    ],
    conCanales: true,
    enlace: { href: '/ayuda', texto: 'Abrir «Necesito ayuda»' },
  },
  {
    id: 'limites',
    pregunta: '¿Qué no puede hacer la plataforma?',
    parrafos: [
      'No hace diagnósticos, no reemplaza la atención profesional y no presta servicios de salud. Tampoco es un canal oficial de ninguna institución.',
      'Si necesitas hablar con alguien de una institución, el botón «Necesito ayuda» está siempre arriba, en todas las páginas.',
    ],
  },
];
