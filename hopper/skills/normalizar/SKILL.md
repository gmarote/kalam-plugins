---
name: normalizar
description: >
  Convierte un Excel de mediciones (Mapa de Quantidades / presupuesto) de
  formato libre en una tabla estructurada estándar de una sola hoja. Úsala
  cuando el usuario adjunte un Excel de mediciones de un arquitecto y diga
  cosas como: "normaliza estas mediciones", "estructura este MQT", "pásame
  este Excel a tabla", "ordena estas mediciones", "/hopper:normalizar".
  El output es un Excel limpio con columnas de identificación, nombre de
  unidad de obra, unidad de medida, medición y precio unitario.
---

# Hopper — Normalizador de Mediciones

Los arquitectos envían las mediciones (en Portugal, *Mapa de Quantidades* /
MQT) en Excel de formato libre: decenas de pestañas, una por capítulo, cada
una con su maquetación, sus códigos y sus parciales. Gestionar eso a mano es
un cuello de botella. Hopper lo traduce a **una sola tabla estructurada**,
conversando con el usuario para acordar cómo leer *ese* fichero.

El flujo es **completamente conversacional**: sin formularios ni wizards. Solo
diálogo, propuesta y confirmación.

---

## Principio rector — CRÍTICO

1. **La IA decide la ESTRUCTURA; el código extrae las CIFRAS.** Hopper razona
   sobre el fichero, propone el mapeo y clasifica los tipos de fila — pero las
   mediciones y los precios los extrae **siempre** el script determinista
   `assets/extraer.py`, celda a celda. **Nunca** transcribas a mano una
   medición o un precio: un número inventado en un presupuesto es inaceptable.
2. **Determinismo.** Una vez acordada la receta (la CONFIG), el mismo Excel
   produce siempre la misma salida, sea cual sea la sesión o el modelo.
3. **No inventar.** Si un campo no está en el origen, se deja vacío. No se
   rellenan precios, ni se "corrigen" mediciones, ni se deducen unidades.
4. **Perfiles por estudio.** Lo acordado con un arquitecto se guarda como
   perfil reutilizable: la próxima medición de ese mismo estudio entra casi
   sola. Son un puñado de estudios recurrentes.

---

## Las dos piezas de referencia

- **`references/esquema-salida.md`** — el esquema canónico de salida (12
  columnas). Es el contrato; léelo antes de entregar.
- **`references/familias-de-formato.md`** — las familias de formato
  (**código** / **formato**), su huella de detección y la receta de
  clasificación de filas. Léelo antes de proponer el mapeo.
- **`assets/extraer.py`** — el extractor determinista, parametrizado por una
  CONFIG JSON. Cubre las dos familias y el trato de parciales.

---

## Fase 1 — Pedir el Excel

Si el usuario no adjuntó un Excel, pedir solo eso:
> "Adjunta el Excel de mediciones del arquitecto para empezar."

No preguntar nada más todavía. Esperar el archivo.

---

## Fase 2 — Inspeccionar (sin decidir aún)

Lee el archivo con pandas (`pd.ExcelFile`, `pd.read_excel(header=None)`).
Soporta `.xlsx` y `.xls`. Para cada pestaña, observa:

- Nº de pestañas y sus nombres. Identifica cuáles son **datos** y cuáles son
  **resumen / duplicadas / vacías** (p. ej. `Resumo`, `Folha3`).
- Dónde está la **fila de cabecera** (puede estar desplazada y ser multilínea,
  `Nº\nArtigo`, `Custo\nUnitário`) y qué columna es cada cosa.
- Una **muestra** de filas de datos (10-20) para ver la estructura real:
  códigos, títulos, partidas, parciales, notas, subtotales.

Con eso, **deduce la familia** (código o formato) según
`references/familias-de-formato.md`. Si hay un perfil guardado para este
estudio (ver Fase 7), cárgalo y salta directo a confirmar.

No proceses todavía: primero acuerda.

---

## Fase 3 — Acordar con el usuario (el núcleo del valor)

Presenta tu lectura **en lenguaje de cliente** y pide confirmación. Plantea
solo las preguntas que el fichero haga necesarias, con tu propuesta por
defecto ya marcada (que el usuario confirme con un "sí" si está de acuerdo):

1. **Pestañas fuente.** "Veo estas pestañas; usaría estas como mediciones e
   ignoraría `Resumo` y `Folha3` (parecen resumen/duplicados). ¿Correcto?"
2. **Mapeo de columnas.** "He leído: código = col A, descripción = col B,
   unidad = col C, medición = col D, precio = col E. ¿Es así?"
3. **Parciales** (SIEMPRE preguntar). "Las partidas traen su desglose de
   medición (parciales). ¿Los conservo como filas de detalle (recomendado) o
   los colapso sumándolos en la partida?"
4. **Identificación / código.** Si el código es pobre (un prefijo repetido
   tipo `ARQ-`), ofrece generar un código secuencial `capitulo.orden`.
   Si es rico (`1.1.2.1`, `E.1`), se conserva tal cual.
5. **Importe por zonas** (si aparece desglosado en varias columnas). "El
   importe viene repartido por zonas (Pisos 0-3 / Piso 4 / Exteriores).
   ¿Lo sumo, o conservo cada zona como columna aparte?"
6. **Normalización de unidades** (opcional). Por defecto se conservan literales.
   Ofrécela solo si el usuario quiere homogeneizar (`m2`→`m²`, `un`/`u`→`Un`).

Si algo es ambiguo, **pregunta** — no asumas. Es preferible una pregunta más
que una medición mal clasificada.

---

## Fase 4 — Configurar y extraer (determinista)

Construye la CONFIG JSON acordada y ejecuta el extractor. **No reimplementes la
extracción a mano**: usa el script.

```bash
python3 assets/extraer.py <entrada> <config.json> <salida.xlsx>
```

Ejemplo de CONFIG (familia código, conservando parciales):
```json
{
  "familia": "codigo",
  "hojas": ["MQT_Plengil"],
  "hojas_excluidas": ["Resumo_Plengil"],
  "parciales": "conservar",
  "volcar_notas": true
}
```

Si el fichero no encaja en ninguna familia (p. ej. medición calculada desde
dimensiones `Comp × Largura × Altura × Partes`), **no lo fuerces**: documenta la
huella y la receta en `references/familias-de-formato.md` y añade su rama al
extractor. El esquema de salida no cambia.

---

## Fase 5 — Validar (obligatorio antes de entregar)

Nunca entregues sin reconciliar. Comprueba y **reporta** al usuario:

- **Conteo**: nº de capítulos, subcapítulos, partidas y parciales detectados.
  Contrasta el nº de capítulos con las pestañas/secciones que el usuario espera.
- **Filas sin clasificar**: revisa el recuento de `nota` y `vacia` del extractor.
  Si hay muchas notas, mira una muestra: puede esconderse algún ítem con código
  no estándar (`a)`, `b)`) que habría que rescatar.
- **Unidades anómalas**: lista las `unidad_medida` distintas; si aparece algo
  raro (texto largo en la columna de unidad), avisa: suele indicar un mapeo de
  columna mal puesto.
- **Coherencia numérica**: si hay precios, comprueba que `medicion × precio =
  importe`. Señala las partidas con medición 0 o vacía.
- **Muestra**: enseña al usuario las primeras 15-20 filas de la salida para un
  visto bueno rápido.

Si la validación destapa un problema de mapeo, vuelve a Fase 3.

---

## Fase 6 — Entregar

Entrega el Excel normalizado (hoja `Mediciones`, y `Notas` si se pidió) con
`SendUserFile`. Resume en una línea: nº de mediciones extraídas, pestañas
usadas y decisiones tomadas (parciales, código, zonas).

---

## Fase 7 — Guardar el perfil del estudio

Tras una normalización validada, ofrece **guardar el perfil** del arquitecto/
estudio: la familia, el mapeo de columnas, las pestañas a excluir y las
decisiones (parciales, código, zonas, unidades). Guárdalo como un JSON con el
nombre del estudio. La próxima vez que llegue una medición de ese estudio,
cárgalo en Fase 2 y salta directo a confirmar — sin rehacer el análisis.

Un perfil es solo la CONFIG del extractor más metadatos de detección
(marcadores de cabecera, nombre del estudio). No contiene datos del cliente.

---

## Qué NO hace Hopper

- No estima precios ni mediciones que no estén en el origen.
- No mezcla notas/condiciones generales con las mediciones (van a hoja aparte).
- No altera unidades ni códigos salvo acuerdo expreso (y queda en el perfil).
- No procesa sin acuerdo previo del mapeo: el juicio se confirma, no se asume.
