-- 0014 · Número de WhatsApp de las fuentes institucionales (contacto directo, opcional).
--
-- `whatsapp`: celular al que la persona puede escribir por WhatsApp, con su indicativo
-- internacional y normalizado por la aplicación al formato E.164: «+» seguido solo de dígitos
-- (p. ej. «+573001234567»). La ficha pública arma con él el enlace oficial
-- `https://wa.me/<dígitos>`. No es lo mismo que `telefono` (línea para llamar), que no cambia.
--
-- Compatibilidad: la columna admite null. Las fuentes ya registradas quedan sin WhatsApp y siguen
-- funcionando igual; la ficha simplemente no muestra el botón.

alter table app.fuente_institucional
  add column if not exists whatsapp text;

alter table app.fuente_institucional
  -- E.164: el indicativo no empieza por 0 y el número completo tiene de 8 a 15 dígitos.
  add constraint fuente_whatsapp_formato check (whatsapp is null or whatsapp ~ '^\+[1-9][0-9]{7,14}$');
