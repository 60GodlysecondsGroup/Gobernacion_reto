-- 0012 · Horario semanal estructurado de las fuentes institucionales.
-- `horario_semanal` guarda, por día, los intervalos de atención:
--   {"lunes": [{"apertura": "08:00", "cierre": "12:00"}, …], …, "domingo": []}
-- (un día sin intervalos es un día sin atención). La aplicación lo valida y, a partir de él,
-- escribe en `horario` el texto legible que siguen leyendo la ficha pública, el asistente y la
-- bitácora. Compatibilidad: no se toca ningún `horario` existente. Las fuentes ya registradas
-- quedan con `horario_semanal` en null y conservan su texto tal cual hasta que alguien configure
-- su horario semanal desde el panel (el cambio queda en la bitácora con el texto anterior).

alter table app.fuente_institucional
  add column if not exists horario_semanal jsonb
  check (horario_semanal is null or jsonb_typeof(horario_semanal) = 'object');
