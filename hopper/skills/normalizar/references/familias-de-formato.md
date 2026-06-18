# Familias de formato y reglas de clasificación

Los Mapas de Quantidades (MQT) que envían los arquitectos vienen en maquetación
libre, pero **no son infinitos**. Lo importante no es catalogar cada maqueta,
sino aplicar unas **reglas universales** de clasificación de filas (las mismas
para todos) y, encima, una **receta de jerarquía** según la familia.

La detección de familia y el mapeo de columnas los propone el agente leyendo el
fichero, **y los confirma el cliente** (ver Fases en SKILL.md). Lo afinado para
un fichero concreto se guarda en su **perfil** (por *tipo de fichero*, no solo
por estudio: un mismo proyecto puede traer varias maquetas — p. ej. Ferragial
ARQ y Ferragial ESP).

---

## Reglas universales (valen para CUALQUIER fichero)

### Regla madre — el único discriminante

**¿La fila tiene unidad y medición?** Esa pregunta —y solo esa— decide si una
fila es una medición. **Ni el código, ni el formato, ni la posición** deciden
eso; solo ayudan a colocar la jerarquía. La evidencia lo confirma: el código ha
aparecido limpio (`1.1.2.1`), como prefijo repetido (`ARQ-`), como un simple `.`,
o directamente ausente, y aun así la presencia de unidad+medición nunca falla.

### Clasificación de cada fila

1. **unidad + medición** → **partida** (o **parcial**). Se emite **siempre**,
   aunque el código sea pobre o falte.
2. **texto sin medición que encabeza** → **título**. Fija el nivel vigente.
3. **texto sin medición que no encabeza** → **nota** (`CG.xx`, `Nota:`,
   `NOTA PRÉVIA`, `NOTAS INICIAIS`, condições gerais). No es medición; va a la
   hoja `Notas` si se conserva.
4. **`TOTAL …` / `SubTotal …` sin medición** → **subtotal**. Se descarta.
5. **sin código, sin texto y sin medición** → **vacía/ruido**. Se descarta.

### El código nunca se inventa y nunca hace perder la fila

- Código fiable → se conserva **literal**.
- Código pobre (`.`, prefijo repetido, vacío) → `codigo` queda **vacío**, pero
  la fila **se emite igual** colgando de los títulos vigentes
  (`capitulo`/`subcapitulo`/`seccion`/`ruta`). *Perder una medición por no tener
  código limpio es inaceptable* (en Palácio Mendia eran ~30% de las partidas).

### El «0» fantasma

Muchas maquetas arrastran ceros de fórmula en las columnas numéricas y de unidad
de filas que **no** son medición (cabeceras, separadores). Reglas:

- Un `"0"` en la columna de **unidad** nunca es una unidad → se trata como vacío.
- Columnas numéricas inundadas de `0` (a veces *todas* las filas, como en
  Ferragial ARQ) no son la medición real.
- **La medición está en la columna `Totais`/`Total`, no en `Parciais`** cuando
  el fichero trae ambas (Quantidades: Parciais | Totais). Mapear a `Totais`.

### La cabecera se localiza por contenido aproximado

- Suele estar **desplazada** (no en la fila 1) y ser **multilínea**
  (`Nº\nArtigo`, `Custo\nUnitário`): normalizar `\n` a espacio y buscar por
  *contenido aproximado*, no por texto exacto.
- Puede ocupar **dos filas** (grupo + subetiqueta): una fila con `Dimensões`,
  `Quantidades`, `Preços` y debajo `Comp | Largura | Parciais | Totais | …`.
- Marcadores difusos típicos: `item`, `art(igo)`, `designa(ção)`, `nº`,
  `descri(ção)`, `un(idade)`, `quant`.

### Jerarquía: 3 buckets con nombre + ruta

Sea cual sea la familia, la salida es siempre `capitulo` › `subcapitulo` ›
`seccion` (+ `ruta` con la cadena completa de títulos, a cualquier profundidad).
Lo único que cambia entre familias es **cómo se deduce** esa jerarquía.

### Pestañas fuente vs no-fuente

- Excluir pestañas de **resumen** (`Resumo`, `RESUMO`, `Resumen`), **duplicadas**
  y de relleno (`Folha3`, `Folha4`).
- Si va **una pestaña por especialidad** (TRABP, ARQ, EST, AVAC…), el nombre de
  la pestaña suele ser el **capítulo**.

---

## Familia A — jerarquía por CÓDIGO

La jerarquía está en el **código**: el número de segmentos marca el nivel
(`1` → capítulo, `1.1` → subcapítulo, `1.1.2.1` → sub-partida).

**Huella de detección**: columna de código con valores tipo `1`, `1.1.1`,
`2.1.2.1.1`, opcionalmente con prefijo de letra (`E`, `E.1`, `ARQ.2`).

**Clasificación**: la universal de arriba. El código estructural sin medición
fija título de su nivel; con medición es partida; un código `CG.xx` o `.` no es
estructural → cae en la regla madre (¿tiene medición? → partida; si no → nota).

**Reconstrucción**: pila de títulos por nivel; al emitir una partida,
`capitulo` = título de nivel 1, `subcapitulo` = nivel 2, `seccion` = nivel 3,
`ruta` = cadena completa de títulos ancestros unida con ` > `, `codigo` = literal.

**Casos reales**: Palácio Mendia (`1.1.2.1`, `.xls`, ítems con código `.`),
Ferragial ESP (`1.4.1.7`, cabecera `Nº\nArtigo`), Rossio · MQT_Plengil (`E.1`,
prefijo de letra), Rossio (cabeceras `0.2`/`0.3` con `0` fantasma).

**Cuidado con**: capítulos solo-letra (`E` = ESTALEIRO, `ARQ` = ARQUITECTURA);
no confundir el prefijo de notas `CG` con un capítulo.

---

## Familia B — jerarquía por FORMATO

No hay código jerárquico fiable (es un prefijo repetido, `ARQ-`). La jerarquía
se deduce del **formato** y la **posición**, y a menudo **una pestaña por
capítulo** (el nombre de la pestaña ES el capítulo).

**Huella de detección**: el código se repite (`ARQ-`, `TRABP`); los títulos de
subcapítulo van en MAYÚSCULAS sin medición; hay parciales sin código debajo.
Ojo: a veces hay un **código jerárquico útil en otra columna** (en Calçada, el
nº `1`, `1.1` va en una columna aparte del prefijo `ARQ-`); si es fiable, vale
la pena mapearlo como código y tratar la hoja como familia A.

**Clasificación** (sobre la universal):
- código + descripción **EN MAYÚSCULAS** sin medición → **título de subcapítulo**.
- código + texto normal → **cabecera de partida** (simple si trae medición;
  compuesta si sus mediciones vienen debajo como parciales).
- sin código + unidad y medición → **parcial** de la partida vigente: `partida`
  = descripción de la madre repetida, su texto propio va a `detalle`.

**Reconstrucción**: `capitulo` = nombre de la pestaña (o cabecera);
`subcapitulo` = último título en MAYÚSCULAS; `ruta` = `capitulo > subcapitulo`.

**Caso real**: Calçada da Memória (pestañas TRABP, ARQ, EST…), con **importe
desglosado por zonas** en varias columnas (`Pisos 0 a 3`, `Piso 4`, `Arranjos
Exteriores`, `Empreitada Geral`) → ver "Importe por zonas".

---

## Parciales (transversal, SIEMPRE preguntar)

Las dos familias tienen "parciales" (el desglose que suma la medición de la
partida). El cliente decide:
- **Conservar** cada parcial como fila propia (máximo detalle) — por defecto.
- **Colapsar** a la partida, sumando las mediciones de sus parciales.

Se registra la elección en el perfil.

---

## Importe / medición por zonas

Algunos MQT reparten la medición o el importe en varias columnas por zona del
edificio. Cuando aparezca (y solo entonces) se añaden columnas extra
`zona_<nombre>` **al final**, sin alterar las columnas canónicas (ver
`esquema-salida.md`).

---

## Casos límite — cuándo NO forzar

Si un fichero no encaja en ninguna familia, **no forzarlo**: documentar aquí la
huella y la receta, y añadir su rama al extractor. El esquema de salida no
cambia. Casos vistos:

- **Medición calculada desde dimensiones** (`Comp × Largura × Altura × Partes`,
  hoja `Medições_Plengil` de Rossio): usar la columna `Totais` ya calculada;
  no recalcular.
- **Maqueta rica e irregular** (Ferragial ARQ, ~16 columnas, `0` fantasma
  masivo y sin código jerárquico por fila): requiere una sesión de mapeo
  dedicada (Fase 3) antes de procesar; el mapeo por defecto no sirve.
