# Superadministración

Gestión segura de las cuentas de administración de la plataforma: rol `superadmin`, sección
**Superadmin** del panel (`/panel/superadmin`) e inicialización controlada del primer superadmin.
Las decisiones resumidas están en `DECISIONES.md` («Superadministración»).

## 1. Estado inicial (auditoría AUTH)

**Autenticación.** Un solo mecanismo propio, sin dependencias externas:

- Jóvenes: registro y acceso con nametag + contraseña (`POST /api/sesion/registro`, `POST /api/sesion`).
- Personal (moderación, gestión de fuentes): correo + contraseña (`POST /api/sesion/personal`), cuentas
  creadas por la administración.
- Contraseñas: hash scrypt (N=2^17, r=8, p=1) en `app.credencial`, aparte de `app.usuario`;
  comparación en tiempo constante y verificación de relleno para no revelar qué cuentas existen.
- Sesiones: fila en `app.sesion` + cookie HttpOnly con el id firmado (HMAC-SHA256). En cada solicitud
  se exige que la sesión exista, no haya vencido ni sido revocada y que la cuenta siga **activa**; el
  rol se lee de la base en cada solicitud. Límite de intentos por IP y por cuenta.
- Administración: `Admin_001` (nametag `AdminDemo`, rol `admin_plataforma`) nace **sin correo y sin
  contraseña**. Solo podía entrar por el acceso con nametag de los jóvenes, después de que quien
  opera el servidor le definiera la contraseña por consola (`npm run admin:contrasena`). No podía
  entrar por «Acceso del equipo» (exige correo), nadie podía gestionar su acceso desde la interfaz
  y no había forma de crear otra administración.

**Autorización.** Matriz de permisos única en el backend (`seguridad/permisos.ts`), aplicada con
`exigirPermiso` en cada ruta y otra vez en los servicios. El frontend solo oculta secciones según los
`permisos` que devuelve `/api/sesion`. El registro público usa esquemas `.strict()`: no acepta `rol`,
`estado` ni `codigo`. Las cuentas de personal solo pueden tener roles de personal.

**Hallazgos**

| #   | Hallazgo                                                                                                                                   | Riesgo                                                                                    | Corrección                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Una administración podía suspender a **otra administración** con `PATCH /api/admin/usuarios/:id` (la regla solo limitaba a la moderación). | Una cuenta de administración comprometida podía dejar fuera a las demás.                  | Ese endpoint rechaza (403) cualquier cuenta de administración o superadministración; esas cuentas solo se gestionan en Superadmin. |
| 2   | La administración no tenía correo ni otra vía de gestión de su acceso que la consola.                                                      | Sin rotación ni revocación desde la plataforma.                                           | Regularización con correo (panel o consola) y gestión completa desde Superadmin.                                                   |
| 3   | No había jerarquía para gestionar la administración ni protección contra quedarse sin ella.                                                | Bloqueo total de la plataforma.                                                           | Rol `superadmin` y disparador del último superadmin activo.                                                                        |
| 4   | El registro de acciones era visible entero para la administración.                                                                         | La gestión de sus propias cuentas sería visible y discutible por las cuentas gestionadas. | Entidad `cuenta_administracion`, visible solo para superadmin.                                                                     |

Lo que ya estaba bien y se reutiliza tal cual: hash scrypt, sesiones revocables, lectura del rol y
del estado en cada solicitud, esquemas estrictos, `exigirPermiso`, registro de auditoría de solo
inserción con la acción y su registro en la misma sentencia.

## 2. Jerarquía

| Rol                | Puede                                                                                                                                                                         | No puede                                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `superadmin`       | Todo lo de `admin_plataforma` y `gestionar_administradores`: crear, editar, activar, desactivar, restablecer la contraseña, subir, bajar o revocar cuentas de administración. | Actuar sobre su propia cuenta; dejar la plataforma sin superadmin activo; entrar sin correo.                            |
| `admin_plataforma` | Lo de siempre (usuarios, personal, salas, comunidades, DLP, registro, asistente).                                                                                             | Ver o usar Superadmin; tocar cuentas de administración desde el panel general; crear administración o asignarse un rol. |

Controles en el backend (la interfaz solo es comodidad):

- Cada ruta de `/api/superadmin/*` exige `gestionar_administradores`; el servicio lo vuelve a
  comprobar y **cada sentencia SQL** vuelve a exigir que el actor siga siendo superadmin activo
  (si lo degradan o desactivan a mitad de camino, no cambia nada).
- Nadie actúa sobre su propia cuenta (403). Un id que no es de administración responde 404.
- Esquemas `.strict()`: ni `estado`, ni `codigo`, ni roles fuera de la lista.
- Bajar de rol, revocar, desactivar o restablecer la contraseña **revocan todas las sesiones** de la
  cuenta; además el rol y el estado se leen de la base en cada solicitud, así que un token emitido
  antes deja de servir de inmediato.
- Base de datos: `usuario_rol_check` (lista cerrada de roles), `usuario_superadmin_con_correo` y el
  disparador `usuario_ultimo_superadmin`, que rechaza cualquier cambio o borrado que deje cero
  superadmins activos. Un candado de transacción serializa esos cambios: dos superadmins que se
  degradan mutuamente a la vez no pueden dejar la plataforma vacía.

## 3. Sección Superadmin (`/panel/superadmin`)

- Lista de cuentas de administración: nombre, correo (o «Sin correo»), rol, estado, último acceso,
  sesiones abiertas y si tiene contraseña. La propia cuenta aparece marcada y sin acciones.
- Aviso de **cuentas por regularizar** (sin correo).
- Nueva cuenta (nombre, correo, contraseña con confirmación, rol administración o superadministración).
- Editar nombre y correo (asignar un correo regulariza una cuenta antigua).
- Restablecer contraseña (cierra todas sus sesiones).
- Cambiar rol: subir, bajar o **revocar la administración** pasándola a moderación o gestión de
  fuentes (la cuenta y su historial se conservan y pasa a «Cuentas de personal»).
- Desactivar / reactivar (desactivar cierra sus sesiones).
- Registro de cambios de cuentas de administración (quién, qué, cuándo; sin secretos).

API:

| Método y ruta                                         | Cuerpo                                                                                  |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `GET /api/superadmin/administradores`                 | —                                                                                       |
| `POST /api/superadmin/administradores`                | `{ nombre, correo, contrasena, confirmacion, rol }` (`admin_plataforma` o `superadmin`) |
| `PATCH /api/superadmin/administradores/:id`           | `{ nombre?, correo? }`                                                                  |
| `PATCH /api/superadmin/administradores/:id/rol`       | `{ rol }` (`superadmin`, `admin_plataforma`, `moderador`, `gestor_fuentes`)             |
| `PATCH /api/superadmin/administradores/:id/estado`    | `{ estado }` (`activo` o `suspendido`)                                                  |
| `POST /api/superadmin/administradores/:id/contrasena` | `{ contrasena, confirmacion }`                                                          |

Errores con explicación: `ULTIMO_SUPERADMIN` (409), `CORREO_REQUERIDO` (409), `CORREO_EN_USO` /
`NOMBRE_EN_USO` (409), `CAMBIO_CONCURRENTE` (409).

## 4. Inicialización del primer superadmin

No hay ruta HTTP, ni credenciales por defecto, ni elevación desde el frontend. El primer superadmin
lo crea quien opera el servidor, con acceso a la base del entorno:

```bash
npm run superadmin:inicializar -- --correo persona@entidad.gov.co
```

- Sin más opciones, **regulariza** la única cuenta `admin_plataforma` (en la base compartida,
  `AdminDemo`): le asigna el correo, pide una contraseña nueva sin mostrarla (dos veces), la sube a
  `superadmin` y conserva su id, su contenido y su historial. Cierra sus sesiones previas.
- `-- --alias <nametag>` elige la cuenta si hay varias; `-- --nombre "Nombre"` crea una cuenta nueva.
- Se niega si ya hay un superadmin activo con contraseña. Solo si nadie puede entrar:
  `-- --recuperacion`.
- Queda en el registro: `inicializar_superadmin`, actor «Sistema», origen consola, sin secretos.
- Sin terminal interactiva toma la contraseña de la primera línea de la entrada estándar (útil en
  CI); nunca la pases como argumento.

Por entorno:

| Entorno                            | Procedimiento                                                                                                                                                                                                                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base compartida (Supabase, `.env`) | `npm run db:migrate` (aplica `0009_superadmin.sql`) y luego `npm run superadmin:inicializar -- --correo <correo real de quien administra>`. Entra en `/acceso/personal`.                                                                                                                                |
| Local (`npm run dev:local`)        | `npm run dev:local` aplica las migraciones. Para inicializar contra la base local: `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/comunidad DATABASE_SSL=disable npm run superadmin:inicializar -- --correo <correo>` (`Superadmin_001` de la semilla no tiene contraseña y no lo impide). |
| Pruebas (`npm run test:db`)        | Nada que hacer: la semilla de pruebas trae `Superadmin_001` (sin contraseña) y las pruebas abren su sesión directamente.                                                                                                                                                                                |
| Vercel / producción                | Igual que la base compartida, ejecutado desde una máquina de confianza con el `DATABASE_URL` de ese entorno. El despliegue no inicializa nada por sí solo.                                                                                                                                              |

Después, el resto de cuentas se gestionan desde **Panel → Superadmin → Administradores**. Se
recomienda tener al menos **dos** superadmins activos.

`npm run admin:contrasena` sigue disponible como recuperación por consola de la contraseña de una
cuenta de administración o superadministración.

## 5. Registro de auditoría

Reutiliza `app.registro_auditoria` (solo inserción). Entidad `cuenta_administracion`, visible solo
para superadmin. Acciones: `crear_cuenta_administracion`, `actualizar_cuenta_administracion`
(qué campos cambiaron, no sus valores), `cambiar_rol_administracion`,
`revocar_privilegios_administracion`, `cambiar_estado_administracion`, `restablecer_contrasena` e
`inicializar_superadmin`. Nunca guarda contraseñas, hashes, tokens ni correos.

## 6. Pendiente

- Restablecimiento de contraseña por correo y cambio de la propia contraseña: no hay envío de
  correos en el proyecto. Hoy la superadministración asigna una contraseña y la comunica por un canal
  seguro; no se fuerza el cambio en el primer acceso.
- Segundo factor (MFA) para cuentas de administración.
- El límite de intentos vive en memoria por instancia (ya documentado en `DECISIONES.md`).
