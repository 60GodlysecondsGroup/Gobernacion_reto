/**
 * Pasos suaves sintetizados en el navegador (Web Audio): un golpe corto de ruido filtrado, como
 * una pisada sobre madera o tierra. Sin archivos de audio. El contexto de audio se crea al
 * activar el sonido (con un gesto de la persona, como exigen los navegadores).
 */
let contexto: AudioContext | null = null;
let ruido: AudioBuffer | null = null;
let pie = 0;

function prepararContexto(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Constructor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Constructor) return null;
  contexto ??= new Constructor();
  if (!ruido) {
    const duracion = 0.09;
    ruido = contexto.createBuffer(
      1,
      Math.ceil(contexto.sampleRate * duracion),
      contexto.sampleRate,
    );
    const datos = ruido.getChannelData(0);
    for (let i = 0; i < datos.length; i++) {
      // Ruido que se apaga rápido: el «toc» de la pisada.
      const caida = Math.pow(1 - i / datos.length, 3);
      datos[i] = (Math.random() * 2 - 1) * caida;
    }
  }
  return contexto;
}

/** Llamar desde un clic: crea o reanuda el audio para que los pasos puedan sonar. */
export function activarAudio() {
  const ctx = prepararContexto();
  if (ctx && ctx.state === 'suspended') void ctx.resume();
}

/**
 * Suena un paso. `volumen` de 0 a 1 (los pasos ajenos suenan más bajo) y `suelo` cambia el
 * timbre según la sala: más grave en madera, más claro en baldosa.
 */
export function sonarPaso({ volumen = 1, suelo = 1 }: { volumen?: number; suelo?: number } = {}) {
  const ctx = contexto;
  if (!ctx || !ruido || ctx.state !== 'running') return;
  pie = 1 - pie;
  const ahora = ctx.currentTime;
  const fuente = ctx.createBufferSource();
  fuente.buffer = ruido;
  // Pie izquierdo y derecho suenan un poco distinto, con una pizca de azar.
  fuente.playbackRate.value = (pie ? 1 : 0.88) * (0.95 + Math.random() * 0.1);
  const filtro = ctx.createBiquadFilter();
  filtro.type = 'lowpass';
  filtro.frequency.value = 520 * suelo;
  filtro.Q.value = 0.7;
  const ganancia = ctx.createGain();
  ganancia.gain.setValueAtTime(0.0001, ahora);
  ganancia.gain.exponentialRampToValueAtTime(0.09 * volumen + 0.0001, ahora + 0.008);
  ganancia.gain.exponentialRampToValueAtTime(0.0001, ahora + 0.09);
  fuente.connect(filtro).connect(ganancia).connect(ctx.destination);
  fuente.start(ahora);
  fuente.stop(ahora + 0.1);
}
