# Guion de demostración (7 minutos)

Prototipo TRL 4 con datos sintéticos. Todo lo que se muestra funciona de verdad; nada es una maqueta.

## Antes de empezar (10 minutos antes)

1. `npm run db:reset` para dejar los datos sintéticos limpios (borra solo el esquema `app`).
2. Para ensayar el cierre automático rápido, pon `SALA_CIERRE_SEGUNDOS=30` en el `.env` (por defecto son 180, es decir, los 3 minutos del documento). En la demo real, dilo en voz alta si lo reduces.
3. `npm run dev` y abre <http://localhost:3000>: la tarjeta «Estado del sistema» debe decir **backend OK** y la base **conectada**.
4. Ten listos **dos navegadores** (o una ventana normal y una de incógnito) y una terminal.

## Usuarios de prueba

| Código          | Alias           | Rol                | Comunidad      |
| --------------- | --------------- | ------------------ | -------------- |
| `Usuario_003`   | `RioDemo`       | Joven              | A · 10–12 años |
| `Usuario_001`   | `LunaDemo`      | Joven (B.7)        | B · 13–15 años |
| `Usuario_002`   | `SolDemo`       | Joven              | B · 13–15 años |
| `Usuario_004`   | `NubeDemo`      | Joven              | C · 16–17 años |
| `Usuario_005`   | `MarDemo`       | Joven              | D · 18–22 años |
| `Moderador_001` | `ModeradorDemo` | Moderación         | —              |
| `Admin_001`     | `AdminDemo`     | Administración     | —              |
| `Gestor_001`    | `GestorDemo`    | Gestión de fuentes | —              |

## Guion

**0:00 · Presentación (30 s).** En el inicio, señala el edificio: cuatro pisos, cuatro comunidades por edad, sin escaleras entre ellas. Pulsa los botones A–D para explicarlo. Señala el pie: lo que la plataforma no hace.

**0:30 · Segmentación (45 s).** Navegador 1 → **Entrar** → `LunaDemo` → **Mi comunidad** (Comunidad B). Escribe en la barra de direcciones `/comunidades/C`: «No encontramos esa comunidad». Busca «Demo» en «Buscar personas»: solo aparecen LunaDemo y SolDemo.

**1:15 · Orientación y fuentes (45 s).** **Orientación** → **Líneas y canales de ayuda** → **CanalDemo**: institución, canal, fuente, fecha de verificación y estado, marcado como dato de demostración. Abre **¿Cómo funciona?** (Cocuyo, la guía) → «¿Dónde encuentro orientación?»: respuestas preparadas, sin chat libre ni diagnósticos.

**2:00 · «Necesito ayuda» (20 s).** Pulsa el botón rojo, que está en todas las páginas: canales institucionales en un paso y el aviso de límites.

**2:20 · Hilo con bloqueo DLP (50 s).** **Mi comunidad** → **Crear hilo** en «Bienestar cotidiano» con `escríbeme al 3000000000` → mensaje estándar, el texto queda para corregir. Prueba la evasión: `tres cero cero cero cero cero cero cero cero cero` → también se bloquea. Quita el número → **Publicar hilo**.

**3:10 · Sala con dos personas y movimiento (70 s).** Navegador 2 → `SolDemo`. Los dos → **Salas** → **Bienestar cotidiano** → **Entrar a la sala** (`2/10`). Muévete con **W A S D**; haz **clic en una casilla libre** y el avatar llega rodeando los muebles; la otra pantalla lo ve. Choca con la mesa: «Hay un mueble en esa dirección.». En el chat, SolDemo escribe «Hola»; LunaDemo intenta `búscame en i n s t a g r a m`: solo ella ve el aviso.

**4:20 · Capacidad de 10 (40 s).** En la terminal: `npm run salas:simular -- --cantidad 8`. La sala llega a `10/10`. En otra terminal: `npm run salas:simular -- --cantidad 1 --desde 9` → «La sala está llena.». Ctrl+C en ambas.

**5:00 · Cierre automático (30 s).** Los dos pulsan **Salir de la sala**. Cuenta el tiempo configurado: la antesala dice «Esta sala se cerró…» y ofrece la instancia nueva del mismo tema.

**5:30 · Reporte y panel de moderación (80 s).** Navegador 1 (LunaDemo) → **Mi comunidad** → «Me cuesta adaptarme a los cambios de este año». Tiene una respuesta grosera sintética de SolDemo que el filtro no detecta porque no contiene datos personales: para eso existe la segunda capa. **Reportar** sobre esa respuesta → «Acoso» → «Tu reporte fue registrado.». Navegador 2 → **Salir** → `ModeradorDemo` → **Panel**: el resumen muestra los reportes pendientes con datos reales. **Reportes** → abre el de «Acoso»: motivo, fecha y contenido, sin decir quién reportó. **Ocultar contenido** → **Confirmar** → **Marcar como resuelto**. LunaDemo recarga el hilo: la respuesta ya no está. **Registro de acciones**: quién, qué y cuándo.

**6:50 · Administración (20 s, opcional).** `AdminDemo` → **Panel** → **Salas**: deshabilita una sala (quien esté dentro sale con un aviso) y abre **Incidencias DLP** para ver los bloqueos de la demo por categoría y por día, sin texto ni autor.

## Plan B si algo falla en vivo

- **Sin conexión a la base:** muestra las capturas de [`EVIDENCIAS/capturas/`](EVIDENCIAS/capturas/) en el orden del guion; cada una tiene el nombre de su escenario.
- **Falla el WebSocket o un navegador:** muestra [`AV-04-AV-08`](EVIDENCIAS/capturas/AV-04-AV-08-movimiento-visto-por-otra-sesion.png) y [`AV-05`](EVIDENCIAS/capturas/AV-05-clic-visto-por-otra-sesion.png), y la salida de `npm run test:db`, que prueba el tiempo real con conexiones reales.
- **No da tiempo para el cierre automático:** muestra [`TRL-08`](EVIDENCIAS/capturas/TRL-08-sala-cerrada.png) y su [registro](EVIDENCIAS/registros/TRL-08-log-backend.txt).
- **Pregunta del jurado sobre pruebas:** abre [`EVIDENCIAS/MATRIZ.md`](EVIDENCIAS/MATRIZ.md): 24 de 24 escenarios ejecutados y aprobados, con sus límites.
