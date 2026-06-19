# dev — Capa 1 sin IA (HTML standalone)

Zona de **desarrollo** de la Capa 1, donde se evoluciona la maqueta (lo estable
se irá consolidando en el resto del plugin). Primera maqueta funcional.

Prueba de concepto de normalizar un MQT **sin IA en tiempo de ejecución** y **sin
servidor**: un único HTML con todo el código dentro. Responde a la pregunta de si
hace falta IA en la primera capa. **No hace falta** para los ficheros regulares:
las "Reglas universales" de `../skills/normalizar/references/familias-de-formato.md`
son heurísticas deterministas, portables a JavaScript.

## Qué es

- **`hopper_normalizador.html`** — standalone (~900 KB). Lleva embebidos:
  - **SheetJS** (`xlsx.full.min.js`) para leer `.xlsx`/`.xls` en el navegador.
  - **`normalizar.core.js`** — el motor de reglas (port de `assets/extraer.py`).
  - una **UI 100% automática**: sueltas el fichero y sale el Excel. **Sin
    formularios de mapeo** (no escalan a un Excel de muchas pestañas). Revisa
    **todas** las hojas (no se descarta nada por nombre), muestra un **panel de
    avisos** que marca *solo* las hojas dudosas (0 partidas, unidades raras,
    cabecera de baja confianza, mediciones a 0), un **detalle por hoja** compacto
    (tabla de solo lectura) y descarga el Excel normalizado (14 columnas + `Notas`).
  - **deduplicación entre hojas**: si los ítems de una hoja están contenidos
    (≥80%) en otra mayor, se descarta como duplicada (evita el doble conteo del
    patrón "hoja agregado + hojas por capítulo", p. ej. Palácio: `MQT` master,
    `ESTALE`/`Limpezas`/`Folha3` descartadas al 100%).
- **`normalizar.core.js`** — el motor, también usable en Node (`module.exports`).
  Incluye la **autoevaluación** (`avisosDe`): la red de seguridad sin interacción.
- **`banco-pruebas.js`** — arnés headless para "entrenar con muchos ficheros":
  `node banco-pruebas.js <carpeta>` normaliza todos los Excel de una carpeta con
  el mismo motor y reporta mediciones, hojas usadas y **auto-éxito** (% de hojas
  sin avisos). No instala nada: usa el SheetJS embebido en el HTML.

El Excel **nunca sale del navegador** (privacidad total). El modelo es **auto +
avisos**: cero interacción obligatoria; los avisos son una red de seguridad que
puedes ignorar. La IA solo haría falta para resolver *automáticamente* los
ficheros irregulares que hoy quedan marcados para revisar.

## Resultados (banco de pruebas, 5 ficheros reales)

`node banco-pruebas.js <carpeta>` → **auto-éxito 60%** (9/15 hojas sin avisos).
El motor JS reproduce **exactamente** los conteos del extractor Python en los
ficheros limpios (Rossio 58, Ferragial ESP 220, Palácio 1.696 con 497 rescatadas).

Las hojas marcadas para revisar (y por qué el panel hace bien en marcarlas):
- Rossio · `Medições_Plengil` → 0 partidas (es la hoja de dimensiones, no fuente).
- Palácio · `ESTALE`/`Limpezas` → cabecera dudosa / no localizada.
- Calçada · `TRABP` → 0 partidas.

Falsos negativos conocidos (lo que aún hay que endurecer):
- **Ferragial ARQ** sale "limpio" con 1.555 filas **sin verificar** — maqueta rica
  e irregular; el motor confía de más. Necesita reglas específicas o verificación.
- **Calçada (formato)** extrae partidas pero la **jerarquía queda incompleta**
  (familia formato + zonas a medio hacer); el aviso no lo detecta todavía.

## Reconstruir el HTML

El HTML es: carcasa + `<script>` de SheetJS + `<script>` de `normalizar.core.js`
+ `<script>` de la UI. Para regenerarlo basta concatenar esas piezas (la librería
SheetJS embebida se tomó de un build offline). El motor (`normalizar.core.js`) es
la fuente de verdad y debe mantenerse en paridad con `assets/extraer.py`.

## Limitaciones (es una maqueta en desarrollo)

- Familia **formato** y **zonas** (`zona_<nombre>`) aún no completas.
- La auto-detección de columnas es heurística: por eso existe el panel de avisos.
  Hay falsos negativos (ver arriba) que se irán cazando con más ficheros.
- Sin perfiles guardados ni validaciones completas de Fase 5 (todavía).

## Próximos pasos

1. Completar **familia formato + zonas** en el motor (desbloquea Calçada).
2. Endurecer la **auto-detección** y los **avisos** (cazar los falsos negativos:
   maquetas ricas tipo ARQ, jerarquía formato incompleta).
3. Ampliar el **corpus** y medir el auto-éxito con `banco-pruebas.js`.
4. Mantener `normalizar.core.js` en **paridad** con `assets/extraer.py`.
