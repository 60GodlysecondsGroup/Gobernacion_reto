# Arquitectura en una página

Prototipo local (TRL 4, datos sintéticos). Tres piezas: el navegador, el backend y la base de datos. **El backend es el único que toca los datos** y es donde se aplican la segmentación por edad, los permisos y el DLP.

```mermaid
flowchart LR
  subgraph Navegador["Navegador (Next.js 16 · React 19)"]
    UI["Páginas públicas<br/>Inicio · Orientación · Ayuda · Guía · Reglas"]
    PRIV["Páginas con sesión<br/>Comunidad · Hilos · Salas · Perfil · Mi avatar"]
    PANEL["Panel (moderación y administración)<br/>Reportes · Incidencias DLP · Usuarios · Salas · Reglas · Registro"]
    ESC["Escenario 2D (SVG) + chat"]
  end

  subgraph Backend["Backend (Node.js 22 · Express 5)"]
    SES["Sesión<br/>cookie HttpOnly firmada"]
    PER["Permisos (matriz A.2)"]
    SEG["Segmentación<br/>comunidad = rango de la sesión"]
    DLP["DLP<br/>reglas en datos + detección de evasión"]
    MOD["Módulos REST /api<br/>comunidad · reportes · orientación · fuentes<br/>moderación · administración · avatar"]
    WS["Salas en tiempo real<br/>WebSocket /ws/salas/:id<br/>el servidor es la autoridad"]
    AUD["Registro de acciones"]
  end

  DB[("PostgreSQL · esquema app<br/>disparador de segmentación<br/>CHECK capacidad ≤ 10<br/>bitácora y auditoría de solo inserción")]

  UI -- HTTPS JSON --> MOD
  PRIV -- cookie de sesión --> MOD
  PANEL -- cookie de sesión --> MOD
  ESC <-- intenciones: mover, ir, mensaje, salir / estado difundido --> WS
  MOD --> SES --> PER --> SEG
  MOD --> DLP
  WS --> DLP
  MOD --> AUD
  MOD --> DB
  WS --> DB
  AUD --> DB
  DLP -- eventos sin texto --> DB
```

## Cómo viaja una acción

1. **Publicar un hilo.** El navegador envía título y contenido, nunca la comunidad. El backend lee la sesión, toma la comunidad del rango, pasa el texto por el DLP (incluidas sus variantes contra evasión) y, si no hay bloqueo, guarda. La base vuelve a comprobar que el hilo sea de la comunidad de la persona.
2. **Moverse en una sala.** El navegador envía una intención (`mover` con una dirección o `ir` a una casilla). El servidor calcula el camino, valida cada paso contra límites y obstáculos y difunde la posición a todos los de la sala.
3. **Moderar un reporte.** El panel pide el reporte; el backend comprueba el permiso, devuelve el motivo y el contenido (sin decir quién reportó) y aplica la acción en una sola sentencia SQL junto con su registro de auditoría.

## Decisiones clave

| Tema              | Elección                                                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| Datos             | PostgreSQL con SQL directo (`pg`), migraciones numeradas y seed sintético.                                     |
| Autenticación     | Selector de usuarios sintéticos (solo demo) y cookie firmada. La verificación de edad está pendiente.          |
| Tiempo real       | WebSocket (`ws`) en el mismo servidor; estado en memoria de un proceso.                                        |
| Interfaz          | CSS Modules con tokens, `motion` para animaciones (respeta «reducir movimiento») y `lucide-react` para iconos. |
| Recursos gráficos | Pixel art propio dibujado por código; fuentes OFL alojadas en el proyecto.                                     |

Detalle completo en [`DECISIONES.md`](../DECISIONES.md) y el modelo de datos en [`MODELO_DE_DATOS.md`](MODELO_DE_DATOS.md).
