-- Fase 10 · Filtros de contenido: lenguaje ofensivo y ajuste de redes externas.
--
-- 1. Nueva categoría DLP «lenguaje_ofensivo» con sus reglas (acción por defecto: bloquear).
--    Reutiliza el DLP existente: mismas tablas, mismo analizador y mismo registro de eventos,
--    que nunca guarda el texto.
-- 2. Falso positivo de la auditoría: «Sigo el ig de la Gobernación» se bloqueaba. «ig» suelto deja
--    de bloquear (pasa a la regla con contexto «redes-ig-contexto») y las referencias a cuentas
--    institucionales («el Instagram de la Gobernación») se permiten.
--
-- Idempotente y sin borrar nada: los inserts no duplican (on conflict do nothing) y los cambios de
-- patrón solo se aplican si la regla conserva su patrón original. Las mismas reglas están en
-- db/seed/reglas_dlp.json (para db:seed); test/filtros.test.ts comprueba que coinciden.
-- Los patrones van entre $re$ … $re$ para no tener que escapar comillas ni barras.

insert into app.categoria_dlp (codigo, nombre, descripcion, orden) values
  ('lenguaje_ofensivo', 'Lenguaje ofensivo',
   'Insultos dirigidos a otras personas, groserías fuertes, expresiones discriminatorias y agresiones o amenazas verbales.', 7)
on conflict (codigo) do nothing;

insert into app.regla_dlp (codigo, categoria, descripcion, patron) values
  ('ofensivo-groserias-fuertes', 'lenguaje_ofensivo',
   'Groserías e insultos fuertes que casi nunca tienen un uso inocuo (hijueputa, malparido, carechimba, comemierda, maricón…), con variantes ortográficas. Se bloquean en cualquier posición.',
   $re$\b(?:hij[ou]e?\s?p[uv]t[ao]s?|hijos?\s+de\s+(?:la\s+)?(?:gran\s+|mil\s+)?putas?|jueputas?|hpt[ao]s?|malpari[dt][oa]s?|malpario|mal\s?nacid[oa]s?|care\s?(?:verga|chimba|monda|culo|pinga|mondas?)|come\s?mierdas?|mama\s?(?:g?[uw]e[bv]o|huevo|vergas?)s?|pirob[oa]s?|maricon(?:a|es|as)?|marikon(?:es)?)\b$re$),
  ('ofensivo-insulto-dirigido', 'lenguaje_ofensivo',
   'Palabras que solo son insulto cuando se dirigen a alguien («eres un idiota», «no seas tan imbécil», «ustedes son unos tarados»). Mencionarlas en otro contexto («me sentí como un idiota», «la gonorrea es una ITS») no se bloquea.',
   $re$\b(?:eres|sos|seas|fueras|pareces|andas|te\s+ves|te\s+crees|vos\s+sos|tu\s+eres|usted\s+es|ustedes\s+son|son\s+(?:unos|unas)|no\s+sea|no\s+sean)\s+(?:(?:un|una|unos|unas|el|la|los|las|muy|tan|re|bien|super|todo|toda|alto|gran|el\s+mas|la\s+mas|grandisim[oa]|maldit[oa]|tremend[oa]|tremenda|flor\s+de|pedazo\s+de)\s+){0,3}(?:idiotas?|estupid[oa]s?|imbecil(?:es)?|pendej[oa]s?|tarad[oa]s?|retrasad[oa]s?|retardad[oa]s?|mongolic[oa]s?|subnormal(?:es)?|babos[oa]s?|gonorreas?|perras?|zorras?|putas?|maric[ao]s?|(?:g|h)?[uw]e[bv]on(?:a|es|as)?|inutil(?:es)?|asqueros[oa]s?|basuras?|escorias?|indi[oa]s?|hp|h\s?\.\s?p\.?|hpt[ao]?)\b$re$),
  ('ofensivo-vocativo', 'lenguaje_ofensivo',
   'Insulto usado para dirigirse a alguien («cállate idiota», «oye estúpido», «maldita perra», «idiota de mierda»). Excluye vocativos coloquiales amistosos como «marica» o «huevón».',
   $re$\b(?:callate|callese|callense|cierra\s+la\s+boca|largate|largo|vete|oye|oiga|ey|ome|vea|mira|chao|adios)\s*,?\s+(?:(?:pedazo\s+de|so|maldit[oa]s?|grandisim[oa]s?)\s+)?(?:idiotas?|estupid[oa]s?|imbecil(?:es)?|pendej[oa]s?|tarad[oa]s?|retrasad[oa]s?|retardad[oa]s?|mongolic[oa]s?|subnormal(?:es)?|perras?|zorras?|putas?|gonorreas?|hp|h\s?\.\s?p\.?|hpt[ao]?)\b|\b(?:pedazo\s+de|so|maldit[oa]s?|grandisim[oa]s?)\s+(?:idiotas?|estupid[oa]s?|imbecil(?:es)?|pendej[oa]s?|tarad[oa]s?|retrasad[oa]s?|retardad[oa]s?|mongolic[oa]s?|subnormal(?:es)?|perras?|zorras?|putas?|gonorreas?|hp|h\s?\.\s?p\.?|hpt[ao]?)\b|\bpedazo\s+de\s+(?:mierda|basura|escoria)\b|\b(?:idiotas?|estupid[oa]s?|imbecil(?:es)?|pendej[oa]s?|tarad[oa]s?|retrasad[oa]s?|retardad[oa]s?|mongolic[oa]s?|subnormal(?:es)?|perras?|zorras?|putas?|gonorreas?|hp|h\s?\.\s?p\.?|hpt[ao]?)\s*,?\s+(?:callate|callese|callense|largate|vete|cierra\s+la\s+boca)\b|\b(?:idiotas?|estupid[oa]s?|imbecil(?:es)?|pendej[oa]s?|tarad[oa]s?|retrasad[oa]s?|retardad[oa]s?|mongolic[oa]s?|subnormal(?:es)?|babos[oa]s?|gonorreas?|perras?|zorras?|putas?|maric[ao]s?|(?:g|h)?[uw]e[bv]on(?:a|es|as)?|inutil(?:es)?|asqueros[oa]s?|basuras?|escorias?|indi[oa]s?|hp|h\s?\.\s?p\.?|hpt[ao]?)(?:\s+[a-z]+)?\s+(?:eres|sos)\b|\b(?:idiotas?|estupid[oa]s?|imbecil(?:es)?|pendej[oa]s?|tarad[oa]s?|retrasad[oa]s?|retardad[oa]s?|mongolic[oa]s?|subnormal(?:es)?|babos[oa]s?|gonorreas?|perras?|zorras?|putas?|maric[ao]s?|(?:g|h)?[uw]e[bv]on(?:a|es|as)?|inutil(?:es)?|asqueros[oa]s?|basuras?|escorias?|indi[oa]s?|hp|h\s?\.\s?p\.?|hpt[ao]?)\s+(?:de\s+mierda|hijueputa|malparid[oa])\b$re$),
  ('ofensivo-mensaje-insulto', 'lenguaje_ofensivo',
   'Mensajes que son solo un insulto claro («IDIOTA», «estúpido!!», «h.p.»), incluso escritos con números o separados («1d10t4», «i d i o t a»).',
   $re$^[^a-z0-9]*(?:idiotas?|estupid[oa]s?|imbecil(?:es)?|pendej[oa]s?|tarad[oa]s?|retrasad[oa]s?|retardad[oa]s?|mongolic[oa]s?|subnormal(?:es)?|h\s?\.\s?p\.?|hpt[ao]?)[^a-z0-9]*$$re$),
  ('ofensivo-agresion-verbal', 'lenguaje_ofensivo',
   'Agresiones verbales dirigidas: mandar a alguien «a la mierda», insultos a la familia («me cago en tu madre») y amenazas o incitación a hacerse daño («te voy a pegar», «mátate»).',
   $re$\b(?:vete|vayase|vallase|andate|anda|largate|vayanse|vallanse|idos)\s+(?:a\s+la|al|pa(?:'|\s)?l|pa\s+la)\s+(?:mierda|verga|carajo|porra|puta\s+mierda|culo|chingada)\b|\bme\s+cago\s+en\s+(?:tu|su|sus|tus|vuestra)\b|\bla\s+(?:puta\s+)?madre\s+que\s+te\s+pario\b|\btu\s+puta\s+madre\b|\b(?:tu|su)\s+(?:mama|madre)\s+es\s+una\s+(?:puta|perra|zorra)\b|\bte\s+(?:voy|vamos)\s+a\s+(?:matar\b(?!\s+de\s+(?:la\s+)?risa)|cascar\b|chuzar\b|apunalar\b|quebrar\b|partir\s+la\s+cara\b|romper\s+la\s+cara\b|(?:pegar|reventar)(?=\s*(?:$|[.,;!?])|\s+(?:una\s+paliza|un\s+puno|una\s+cachetada|una\s+golpiza|duro)\b))|\b(?:matate|suicidate|ojala\s+te\s+mueras|ojala\s+se\s+muera|muerete)\b(?!\s+de\b)$re$)
on conflict (codigo) do nothing;

update app.regla_dlp
   set patron = $re$\b(?:instagram|insta|tiktok|tik tok|whatsapp|whats|wasap|wsp|wpp|discord|telegram|snapchat|snap|facebook|face|fb|messenger|twitter|threads|signal|kik|onlyfans)\b(?!\s+(?:oficial\s+)?(?:de|del)\s+(?:la\s+|el\s+|los\s+|las\s+)?(?:gobernacion|alcaldia|ministerio|secretaria|icbf|policia|defensoria|personeria|procuraduria|fiscalia|hospital|universidad|sena|colegio|institucion|plataforma|comunidad\s+protegida|refugio|cruz\s+roja|bomberos|linea\s+\d+)\b)$re$,
       descripcion = 'Menciones de redes sociales y mensajería externas (Instagram, TikTok, WhatsApp, Discord, Telegram y similares). No bloquea las referencias a cuentas institucionales («el Instagram de la Gobernación»).',
       fecha_actualizacion = now()
 where codigo = 'redes-plataformas'
   and patron = $re$\b(?:instagram|insta|ig|tiktok|tik tok|whatsapp|whats|wasap|wsp|wpp|discord|telegram|snapchat|snap|facebook|face|fb|messenger|twitter|threads|signal|kik|onlyfans)\b$re$;

update app.regla_dlp
   set patron = $re$\b(?:g?uasa+p+|wasa|wats?a+p+|whats?ap|guatsap|watsa|insta\s?gr[ae]m|instagran|instagrm|ig\s?gram|tik\s?toc|tic\s?toc|tic\s?tok|telegran|telegr[ae]m|disc[o0]rd|disco?rt|snap\s?chat|faceb[o0]{2}k|feisbuk|feis)\b(?!\s+(?:oficial\s+)?(?:de|del)\s+(?:la\s+|el\s+|los\s+|las\s+)?(?:gobernacion|alcaldia|ministerio|secretaria|icbf|policia|defensoria|personeria|procuraduria|fiscalia|hospital|universidad|sena|colegio|institucion|plataforma|comunidad\s+protegida|refugio|cruz\s+roja|bomberos|linea\s+\d+)\b)$re$,
       descripcion = 'Nombres de redes y mensajería escritos de forma alterada (guasap, uasap, instagran, tiktoc, telegran…). Fase 8, F23. No bloquea las cuentas institucionales.',
       fecha_actualizacion = now()
 where codigo = 'redes-variantes'
   and patron = $re$\b(?:g?uasa+p+|wasa|wats?a+p+|whats?ap|guatsap|watsa|insta\s?gr[ae]m|instagran|instagrm|ig\s?gram|tik\s?toc|tic\s?toc|tic\s?tok|telegran|telegr[ae]m|disc[o0]rd|disco?rt|snap\s?chat|faceb[o0]{2}k|feisbuk|feis)\b$re$;

insert into app.regla_dlp (codigo, categoria, descripcion, patron) values
  ('redes-ig-contexto', 'redes_externas',
   'La abreviatura «ig» solo cuando se usa para pasar o pedir una cuenta («mi ig», «por ig», «ig: …», «sígueme en ig»). Mencionar «el ig de la Gobernación» se permite.',
   $re$(?:\b(?:mi|tu|su|mis|tus|sus|por|al|x)\s+ig\b|\b(?:pasa|pasame|dame|manda|mandame|escribe|escribeme|hablame|sigueme|agregame|buscame|sigue|agrega|busca|seguime)\s+(?:(?:en|por|al|a|mi|tu)\s+)*ig\b)(?!\s+(?:oficial\s+)?(?:de|del)\s+(?:la\s+|el\s+|los\s+|las\s+)?(?:gobernacion|alcaldia|ministerio|secretaria|icbf|policia|defensoria|personeria|procuraduria|fiscalia|hospital|universidad|sena|colegio|institucion|plataforma|comunidad\s+protegida|refugio|cruz\s+roja|bomberos|linea\s+\d+)\b)|\big\s*[:=@]$re$)
on conflict (codigo) do nothing;
