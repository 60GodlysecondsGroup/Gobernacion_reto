# Fuentes institucionales: cómo cargar las reales

El prototipo **no inventa** instituciones, teléfonos ni enlaces. Hoy solo tiene registros de demostración (`InstituciónDemo`, `CanalDemo`…) marcados con `"esDemo": true`. Se muestran con la etiqueta «DATO DE DEMOSTRACIÓN» y sin enlaces ni llamadas activas.

Para reemplazarlos por fuentes reales verificadas no hace falta tocar código: se edita un archivo y se ejecuta un comando.

## 1. Editar el archivo

[`apps/backend/db/seed/fuentes_institucionales.json`](../apps/backend/db/seed/fuentes_institucionales.json) es una lista. Cada registro tiene estos campos (todos obligatorios; los opcionales pueden ir en `null`):

| Campo               | Qué es                                                                           | Reglas                                                                                                                                  |
| ------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `codigo`            | Clave estable del registro. Si la cambias, el sistema lo trata como otra fuente. | Minúsculas, números y guiones (3 a 60). Única en el archivo.                                                                            |
| `institucion`       | Entidad responsable del servicio.                                                | 2 a 120 caracteres.                                                                                                                     |
| `servicio`          | Nombre del servicio o línea.                                                     | 2 a 120 caracteres.                                                                                                                     |
| `descripcion`       | Qué ofrece, con las palabras de la fuente oficial.                               | 10 a 1000 caracteres. Sin diagnósticos ni recomendaciones clínicas.                                                                     |
| `tipoCanal`         | `telefono`, `web`, `presencial`, `chat` u `otro`.                                | Un `telefono` necesita `telefono`. Un `web` o un `chat` necesitan `enlace`.                                                             |
| `telefono`          | Número institucional.                                                            | Solo números, espacios, `+`, paréntesis o guiones (3 a 20), o `null`.                                                                   |
| `enlace`            | Sitio oficial.                                                                   | Debe empezar por `https://` o `http://`, o ser `null`.                                                                                  |
| `horario`           | Horario de atención, si se conoce.                                               | Hasta 200 caracteres, o `null`.                                                                                                         |
| `fuenteOriginal`    | Sitio o documento oficial de donde sale la información.                          | 3 a 300 caracteres. **Obligatorio**: sin fuente no se publica.                                                                          |
| `fechaVerificacion` | Cuándo se comprobó en la fuente original.                                        | `AAAA-MM-DD`, no futura. **Obligatoria** (B.6).                                                                                         |
| `estado`            | `activo`, `requiere_revision` o `inactivo`.                                      | Las inactivas no se muestran como opción.                                                                                               |
| `necesidades`       | Temas del navegador donde aparece.                                               | Al menos uno de `bienestar`, `hablar_con_alguien`, `situacion_preocupa`, `amigo_preocupa`, `lineas_ayuda`, `informacion_institucional`. |
| `observaciones`     | Notas internas del equipo.                                                       | Hasta 500 caracteres, o `null`. **No se muestran al público.**                                                                          |
| `esDemo`            | `true` solo para datos ficticios.                                                | Una fuente real y verificada lleva `false`.                                                                                             |

Los canales de `lineas_ayuda` y `hablar_con_alguien` son los que aparecen en «Necesito ayuda».

Ejemplo de un registro (con valores de demostración):

```json
{
  "codigo": "demo-canal-demo",
  "institucion": "InstituciónDemo",
  "servicio": "CanalDemo",
  "descripcion": "DATO DE DEMOSTRACIÓN. Canal ficticio…",
  "tipoCanal": "telefono",
  "telefono": "000 000 0000",
  "enlace": null,
  "horario": "Horario de demostración",
  "fuenteOriginal": "Registro de demostración del prototipo (no es una fuente real)",
  "fechaVerificacion": "2026-10-20",
  "estado": "activo",
  "necesidades": ["lineas_ayuda", "hablar_con_alguien"],
  "observaciones": null,
  "esDemo": true
}
```

## 2. Cargar

```bash
npm run fuentes:cargar
```

El comando sincroniza la base con el archivo, en una sola transacción:

- **Crea** los registros nuevos.
- **Actualiza** los que cambiaron.
- **Desactiva** los que ya no están en el archivo. No los borra: su historial se conserva.
- Todo cambio queda en la bitácora con la observación «Carga desde fuentes_institucionales.json».
- Si el archivo tiene un error, **no carga nada** y dice qué registro y qué campo fallaron.

Para usar otro archivo:

```bash
npm run fuentes:cargar -- ruta/a/otro-archivo.json
```

Para quitar los datos de demostración, bórralos del archivo (o cambia su `estado` a `inactivo`) y vuelve a cargar.

## 3. Mantenerlas al día

Desde la aplicación, con el usuario **GestorDemo** o **AdminDemo**, en **Fuentes**:

- **Marcar para revisión** (con motivo): el canal no respondió, cambió o hay dudas. Se sigue mostrando, con un aviso.
- **Registrar verificación** (con fecha): se comprobó en la fuente oficial. Vuelve a Activo.
- **Desactivar** (con motivo): ya no está disponible. Deja de mostrarse.
- **Editar datos**: cada campo modificado queda en la bitácora con su valor anterior y el nuevo.

**Pendiente del equipo:** quién es responsable de la revisión y cada cuánto se hace (sección 30).
