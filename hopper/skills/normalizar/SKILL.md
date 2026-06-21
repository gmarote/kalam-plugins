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
- **`references/esquema-salida.md`** — el contrato (13 columnas, v3 con `division`).
- **`references/familias-de-formato.md`** — familias **código**/**formato** y su huella.
- **`references/capas-y-correccion.md`** — arquitectura por capas y las recetas de
  corrección. **Léelo antes de tocar un caso difícil.**
- **`assets/normalizar.js`** — el ejecutor (usa el motor compartido). *Esta es la
  ruta principal.*
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

Cuando el informe marca una hoja, el objetivo es dejarla correcta **y**, si es un
patrón nuevo, **enseñárselo al motor** (que quede resuelto para siempre). Rutina:

1. **Mira el aviso.** El más importante es **«jerarquía rota»** (capítulo vacío
   con subcapítulo/sección llenos): casi siempre la cabecera de capítulo no se
   reconoció por el formato del código.
2. **Abre el original y mira el patrón** de la hoja marcada:
   ```bash
   node assets/inspeccionar.js <archivo.xlsx> "<nombre_hoja>" 30
   ```
   Muestra hojas, columnas detectadas y las primeras filas crudas. Fíjate en las
   filas-título (código sin cantidad) y en cómo se escribe el código.
3. **Compáralo con las causas ya conocidas** (`references/capas-y-correccion.md`):
   cabecera escondida (`ARQ 1.`, `A 1.1.1.1`, `1.`), nivel constante (`A.x`), cero
   final (`1.0`), código en dos columnas (Bloco). Si es una de ellas y aun así
   falla, comprueba por qué la receta no disparó.
4. **Si es un patrón NUEVO**, añádelo como **receta de capa 3** en
   `../../app/normalizar.core.js`:
   - una hipótesis en el banco del reintento (gatillo: «jerarquía rota»), que se
     queda **solo si la confianza sube** (nunca empeora), o
   - una normalización de código si es general y segura.
5. **Re-incrusta el motor en el HTML** (`hopper_multicapa.html`) y **mide sin
   regresión**: `node app/banco-pruebas.js <corpus>` (recuento de mediciones +
   auto-éxito) antes/después. La copia embebida debe quedar idéntica al standalone.
6. **Confirma con el usuario** el resultado de esa hoja y entrega.

Cada arreglo así **no es un parche de un archivo: es una regla permanente** que
sube el auto-éxito para todos los ficheros futuros.

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
