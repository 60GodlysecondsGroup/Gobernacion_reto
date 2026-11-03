-- 0011 · DLP de convivencia: nombres de los órganos sexuales externos en foros, hilos y salas.
-- Decisión de producto: en la comunidad no se nombran los genitales, ni con términos clínicos ni
-- coloquiales («pene», «vagina», «pito», «chocha»…). Excepciones de contexto: «pito» como silbato
-- o bocina y «penne» (la pasta, que al quitar letras repetidas queda «pene»). No se incluyen los
-- órganos internos (útero, ovarios) ni «partes íntimas». Solo agrega la regla: no reactiva reglas
-- desactivadas. La misma regla está en db/seed/reglas_dlp.json (test/dlp-lenguaje.test.ts lo
-- comprueba); mientras esta migración no se aplique, el DLP la usa igual desde el seed.

insert into app.regla_dlp (codigo, categoria, descripcion, patron) values
  ('sexual-organos-genitales', 'contenido_sexual',
   'Nombres de los órganos sexuales externos, clínicos o coloquiales (pene, vagina, vulva, clítoris, testículos, pito, nepe, pichula, chocha, panocha…), también en inglés. «Pito» se permite si el mensaje habla de un silbato o una bocina, y «pene» si habla de pasta («penne»). No incluye órganos internos (útero, ovarios) ni «partes íntimas», para no silenciar preguntas de salud menstrual ni a quien cuenta que lo tocaron.',
   '^(?!.*\b(?:pasta|penne|macarron\w*|espagueti\w*|pesto|bolonesa|bolognesa)\b).*\b(?:penes?|penecitos?)\b|\b(?:vaginas?|vaginitas?|vulvas?|clitoris|testiculos?|escrotos?|glandes?|prepucios?|genitales|organos?\s+genital(?:es)?)\b|\b(?:nepes?|pichulas?|porongas?|chochas?|chochitas?|chochitos?|panochas?|totonas?|cricas?|pirulas?)\b|\b(?:penis(?:es)?|testicles?)\b|^(?!.*\b(?:arbitr[oa]s?|silbatos?|silbar|pitazos?|pitar|car+os?|bus|buseta|busetas|motos?|taxis?|camion(?:es)?|tren(?:es)?|bicicletas?|partidos?|cancha|futbol|educacion\s+fisica)\b).*\bpit(?:o|os|ico|icos|ito|itos|ote|otes)\b')
on conflict (codigo) do nothing;
