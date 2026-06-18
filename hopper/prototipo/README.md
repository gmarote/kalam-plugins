# Prototipo — Capa 1 sin IA (HTML standalone)

Prueba de concepto de normalizar un MQT **sin IA en tiempo de ejecución** y **sin
servidor**: un único HTML con todo el código dentro. Responde a la pregunta de si
hace falta IA en la primera capa. **No hace falta** para los ficheros regulares:
las "Reglas universales" de `../skills/normalizar/references/familias-de-formato.md`
son heurísticas deterministas, portables a JavaScript.

## Qué es

- **`hopper_normalizador.html`** — standalone (~900 KB). Lleva embebidos:
  - **SheetJS** (`xlsx.full.min.js`) para leer `.xlsx`/`.xls` en el navegador.
  - **`normalizar.core.js`** — el motor de reglas (port de `assets/extraer.py`).
  - una **UI** que recorre todas las pestañas, auto-detecta cabecera/familia/mapeo,
    deja **confirmar y corregir el mapeo con desplegables**, muestra preview y
    descarga el Excel normalizado (14 columnas + `Notas`).
- **`normalizar.core.js`** — el motor, también usable en Node (`module.exports`).

El Excel **nunca sale del navegador** (privacidad total). La IA solo haría falta
para mapear automáticamente los ficheros irregulares sin que nadie confirme.

## Resultados (mismos ficheros que el extractor Python)

El motor JS reproduce **exactamente** los conteos validados del extractor:

| Fichero | partidas | nota |
|---|---|---|
| Rossio · MQT_Plengil | 58 (2 notas, 10 subtotales) | = Python |
| Ferragial ESP · Estimativa | 220 | = Python |
| Palácio Mendia · MQT (+ESTALE+Limpezas) | 1.696 (497 rescatadas) | = Python |
| Calçada (familia formato) | jerarquía incompleta | necesita ajuste de mapeo en la UI + función de zonas |

La auto-detección de mapeo acierta los casos limpios; donde duda (maquetas ricas
tipo Ferragial ARQ, o formato con zonas) **la UI deja corregirlo a mano** — que es
justo el sustituto de la IA en la capa 1.

## Reconstruir el HTML

El HTML es: carcasa + `<script>` de SheetJS + `<script>` de `normalizar.core.js`
+ `<script>` de la UI. Para regenerarlo basta concatenar esas piezas (la librería
SheetJS embebida se tomó de un build offline). El motor (`normalizar.core.js`) es
la fuente de verdad y debe mantenerse en paridad con `assets/extraer.py`.

## Limitaciones (es un prototipo)

- Familia **formato** y **zonas** (`zona_<nombre>`) aún no completas en la UI.
- La auto-detección de columnas es heurística: confirmar siempre el mapeo.
- Sin perfiles guardados ni validaciones de Fase 5 (todavía).
