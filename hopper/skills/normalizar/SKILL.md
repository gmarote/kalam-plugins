---
name: normalizar
description: >
  Convierte un Excel de mediciones (Mapa de Quantidades / MQT) de formato libre
  en una tabla estructurada estándar, y genera además una "hoja de costes" lista
  para pegar en el sistema de costes de Kalam. Úsala cuando el usuario adjunte un
  Excel de mediciones y diga cosas como: "normaliza estas mediciones",
  "estructura este MQT", "pásame este Excel a tabla", "/hopper:normalizar".
  El motor es autónomo (detecta, audita y corrige solo); para los casos difíciles
  se diagnostica e interactúa con el usuario. Un MQT mide, no presupuesta: sin
  precio ni importe.
---

# Hopper — Normalizador de Mediciones

Los arquitectos envían las mediciones (en Portugal, *Mapa de Quantidades* / MQT)
en Excel de formato libre: decenas de pestañas, maquetaciones distintas, códigos
y parciales. Hopper lo traduce a **una sola tabla estructurada** + una **hoja de
costes**. El motor es **autónomo y determinista** (sin IA en su núcleo): detecta
columnas, clasifica filas, se auto-audita y se autocorrige. La IA (tú) entra solo
para **los casos que el motor marca como dudosos**, y para **enseñarle un patrón
nuevo** cuando aparece.

## Principios — CRÍTICO
1. **Un solo motor: `../../app/normalizar.core.js`.** El plugin lo **ejecuta**
   (Node), no lo reimplementa. Hace *exactamente* lo mismo que la app. Cualquier
   mejora se hace en ese fichero y beneficia a las dos cosas a la vez.
2. **Nunca fallar en silencio.** Si el motor no está seguro, lo dice (confianza
   <100%, avisos). Ante la duda, **señalar**, no inventar. No se rellenan precios,
   ni se "corrigen" mediciones, ni se deducen unidades que no estén en el origen.
3. **El capítulo nunca queda vacío** teniendo niveles por encima (regla universal,
   ver `references/capas-y-correccion.md`).

## Referencias
- **`references/reglas.md`** — las 27 reglas del motor en orden, en una frase cada una.
- **`references/esquema-salida.md`** — el contrato (13 columnas, v3 con `division`).
- **`references/familias-de-formato.md`** — familias **código**/**formato** y su huella.
- **`references/capas-y-correccion.md`** — arquitectura por capas y las recetas de
  corrección. **Léelo antes de tocar un caso difícil.**
- **`assets/normalizar.js`** — el ejecutor (usa el motor compartido). *Esta es la
  ruta principal.*
- **`assets/mapa-jerarquia.js`** — extrae el **mapa de jerarquía** (código→título→
  nivel) de una hoja **Resumo/Índice** y, con `--out`, lo aplica a las partidas.
  Para casos donde la hoja-resumen trae la jerarquía completa que falta en las
  hojas de medición. No toca el motor.
- **`assets/inspeccionar.js`** — vuelca hojas, columnas detectadas y filas crudas
  de una hoja, para diagnosticar casos difíciles.
- **`assets/extraer.py`** — extractor antiguo parametrizado por CONFIG. **Legacy /
  oráculo de validación**; no es la ruta principal.

---

## Flujo estándar (la mayoría de los ficheros)

1. **Pide el Excel** si no lo han adjuntado. Soporta `.xlsx`, `.xlsm`, `.xls`.
2. **Ejecuta el motor:**
   ```bash
   node assets/normalizar.js <archivo.xlsx> [archivo2 …] --out <carpeta>
   ```
   Escribe `<nombre>_normalizado.xlsx` y `<nombre>_hoja-de-costes.xlsx`, e imprime
   un **informe de diagnóstico**: mediciones totales, **confianza global y por
   hoja**, avisos, y las correcciones de capa 3 que aplicó (`✓ …`).
3. **Lee el informe.**
   - **Aviso «no parece un MQT»** (el archivo no tiene columnas de medición
     habituales: unidad + cantidad) → díselo al usuario y **no afirmes fiabilidad**;
     probablemente se ha cargado un Excel que no es un Mapa de Quantidades.
   - **Confianza alta y sin avisos accionables** → entrega los dos Excel con
     `SendUserFile`, resumiendo en una línea (nº de mediciones, hojas usadas).
   - **Alguna hoja a revisar** (confianza <~95% por «jerarquía rota», unidades
     raras, muchas cantidades 0…) → pasa al flujo de casos difíciles.

No hay CONFIG ni mapeo manual en el caso normal: el motor lo resuelve solo.

---

## Flujo de casos difíciles (interactivo) — el valor diferencial

Cuando el informe marca una hoja, el objetivo es **dejar perfecto ESE fichero**
para este usuario, interactuando con él. **No se edita el motor** (eso es
mantenimiento, ver más abajo): se resuelve el caso con `overrides` y revisión de
jerarquía, que el motor ya soporta. Rutina:

1. **Mira el aviso.** El más importante es **«jerarquía rota»** (capítulo vacío
   con subcapítulo/sección llenos): casi siempre la cabecera de capítulo no se
   reconoció por el formato del código.
2. **Abre el original y mira el patrón** de la hoja marcada:
   ```bash
   node assets/inspeccionar.js <archivo.xlsx> "<nombre_hoja>" 30
   ```
   Muestra hojas, columnas detectadas y las primeras filas crudas. Fíjate en las
   filas-título (código sin cantidad) y en cómo se escribe el código.
3. **Pregunta al usuario lo que solo él sabe** (es el autor/lector del MQT).
   Enséñale lo que el motor detectó y plantea las dudas concretas, p. ej.:
   - «Esta hoja se llama AVAC, ¿es el capítulo de todo lo que contiene?»
   - «El código `A` ¿es capítulo (con 1, 2… debajo) o es un edificio/bloque (división)?»
   - «`0.1 Estaleiro` ¿es subcapítulo o ya una partida?»
   Compáralo con las causas conocidas (`references/capas-y-correccion.md`) para
   acertar con las preguntas.
4. **Compón el archivo correcto con sus respuestas**, sin tocar el motor:
   - **¿Hay hoja Resumo/Índice?** Suele traer la jerarquía completa (código→título).
     Extráela y aplícala: `node assets/mapa-jerarquia.js <archivo.xlsx> --out <carpeta>`.
     Es la vía más fiable cuando existe (la hoja descartada como fuente de
     mediciones sigue siendo fuente de jerarquía).
   - **`overrides`** por hoja, desde la CLI:
     ```bash
     node assets/normalizar.js <archivo.xlsx> --out <carpeta> --overrides ov.json
     ```
     ```json
     { "AVAC": { "familia":"codigo", "headerRow":6,
                 "cols":{"code":0,"desc":2,"unit":4,"qty":5} } }
     ```
     `headerRow` y `cols` van en base 0; solo hace falta lo que la detección
     falló. `inspeccionar.js` imprime esos tres valores tal como los detectó, así
     que se copian y se corrige lo que esté mal.
     Equivale al 4º argumento de `core.normalizar`: `familia`,
     `headerRow`, `cols` (mapeo de columnas) cuando la detección automática falló.
   - **Revisión de jerarquía** (`construirTitulos` + `aplicarTitulos`): designar
     hoja → Capítulo, mover niveles, marcar «no es título». La `ruta` conserva lo
     que quede por debajo de sección.
5. **Confirma el resultado con el usuario y entrega** los dos Excel (`SendUserFile`).
6. **Si has visto un patrón que se repetiría** en otros ficheros, **déjalo como
   nota** para el responsable del motor (no lo apliques aquí). Ej.: «AVAC venía
   como nombre de hoja y el motor no lo subió a capítulo — candidato a regla».

La salida del plugin es **un caso particular**: resuelve este fichero, **no
modifica el motor**.

## Mantenimiento del motor (fuera del runtime del plugin)

Mejorar el motor es una actividad **aparte**, en sesión de desarrollo con quien
mantiene el código (no la hace el plugin en ejecución, ni en casa del cliente).
Cuando un patrón es **nuevo y recurrente**, se convierte en **regla permanente**:
añadir la regla/receta en `../../app/normalizar.core.js`, **re-incrustar** el motor
en `hopper_multicapa.html`, y **medir sin regresión** con
`node app/test-regresion.js <corpus>` (invariantes, snapshot por archivo, oráculo
ARQUITECTURA, `embebido == standalone`) antes/después. Así cada caso difícil sube
el auto-éxito de la app base para todos los ficheros futuros.

### Cuándo preguntar al usuario
Si el patrón es **ambiguo** (dos lecturas válidas y solo el autor del MQT sabe
cuál; p. ej. si un `Bloco` es edificio o fase), **pregunta** — no asumas. Una
pregunta de más es mejor que una jerarquía mal puesta.

---

## Las dos salidas
1. **Excel normalizado** — hoja `Mediciones` (13 columnas) + `Notas`.
2. **Hoja de costes** — `Código · Nat · Ud · Partida · CanPres`, con cabeceras
   `División`/`Capitulo`/`Subcapitulo`/`Sección` y filas `TOTAL …` intercaladas
   vacías, para copy/paste en la plantilla de costes de Kalam.

## Qué NO hace Hopper
- No finge fiabilidad con archivos ajenos: si el Excel no parece un MQT (sin
  columnas de medición), lo avisa y no evalúa la confianza.
- No estima precios ni mediciones que no estén en el origen.
- No mezcla notas/condiciones generales con las mediciones (van a hoja aparte).
- No altera unidades ni códigos salvo que aporte (y se documenta como receta).
- No entrega una hoja dudosa sin avisar: la confianza y los avisos van al usuario.
