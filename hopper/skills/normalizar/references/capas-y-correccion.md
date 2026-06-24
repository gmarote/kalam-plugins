# Arquitectura por capas y autocorrección

La normalización no es una sola pasada: es un pipeline determinista (sin IA) de
tres capas. La idea: **detectar dónde algo no cuadra y corregirlo solo cuando se
puede demostrar que mejora** — y, cuando no, **señalarlo en vez de fallar en
silencio**.

## Capa 0 — ¿Es un MQT?
Antes de fiarse de nada, el motor calcula una señal estructural por archivo
(`esMQT`): la mejor hoja debe tener un mínimo de filas con **número + unidad
real** (`estMedidas >= 8`). Calibrado con muestras: un Excel ajeno (inventario,
listado de máquinas, fichero de otra app) puntúa 0–3; los MQT reales, 23–345.
No bloquea —los datos se muestran igual— pero la UI/CLI **no fingen fiabilidad**:
avisan «esto no parece un MQT». (El vocabulario de obra NO sirve como señal: los
no-MQT también mencionan «grúa», «retroexcavadora»…; manda la estructura.)

## Capa 1 — Extracción
Lee cada hoja de arriba abajo, detecta columnas por contenido (código,
descripción, unidad, cantidad), clasifica cada fila (título / partida / parcial /
nota / subtotal) y vuelca la tabla canónica. El discriminante universal de
partida sigue siendo: **¿tiene unidad y medición?**

### Detección de columnas — anclas y posición
La descripción **parte la hoja**: es el ancla fiable (columna con el texto más
largo), junto con la unidad (tokens de unidad). A partir de ahí:
- **El código va a la IZQUIERDA de la descripción; la cantidad a la DERECHA.**
  Evita el fallo típico en MQT donde una columna de **decimales** (cantidades o
  dimensiones) se confunde con el código y ambos se intercambian (Lx Factory,
  Hidden Away, Av5Out77). Una columna nunca es código si su cabecera dice
  cantidad/precio/dimensión.
- **Códigos cortos sin puntos** tipo `A`, `A1`, `B2` (familia *formato*): se
  reconocen como columna de código aunque no tengan jerarquía con puntos
  (CASA_RAMIREZ/ARQUITECTURA). Antes el motor cogía una columna de decimales y
  generaba códigos basura.
- En *formato*, el **capítulo es la pestaña**, no la etiqueta de columna: si el
  texto del encabezado es «Designação»/«Descrição», el capítulo pasa a ser el
  nombre de la hoja.

### Capítulo: de dónde sale (familia código)
El capítulo no siempre es un título numérico interno. El motor reconoce:
- **Nombre de hoja = disciplina** (`ARQUITECTURA`, `ESTRUTURA`, `AVAC`, `ÁGUAS`,
  `ELECTRICIDADE`, `ITED`, `SCIE`…): es el patrón más frecuente del corpus (una
  pestaña por disciplina). La disciplina pasa a `capitulo` y los títulos internos
  bajan un nivel; lo que quede por debajo de sección va a la `ruta`. Admite prefijo
  de código en el nombre (`A - ARQUITETURA`, `2.DEMOLIÇÕES`, `MQT-AVAC`), que se
  limpia. No actúa si la disciplina ya figura exactamente como capítulo.
- **Columna-sección aparte**: el capítulo va en una columna propia (`SECÇÃO`
  `1.`, `2.`…) a la izquierda del artículo, con el nombre del capítulo en la fila
  donde el artículo va vacío (RUA DA BOMBARDA). Se combina sección+artículo.
- **Esquema por letra** (`A`, `B`, `C`…, ≥3 distintas): los códigos numéricos que
  reinician debajo cuelgan un nivel bajo la letra (Casa das Nunes, Lx Factory,
  Varandas). Una letra aislada no es esquema (no se nivela).
- **Rótulo de documento** en la columna de código (`MAPA DE QUANTIDADES`, `MQT`…)
  NO es capítulo: se ignora para no meter un nivel falso (Rua do Alecrim).

### Herencia de unidad
Patrón frecuente: una partida `1.1 …(m2)` declara la unidad, pero la cantidad
está en sus filas hijas `1.1.1`, `1.1.2`… que no la repiten. Una fila **con
código y cantidad pero sin unidad propia hereda la unidad del título padre**
(con ámbito: se limpia al salir de su subárbol). Las filas-subtotal sin código
siguen siendo notas, para no duplicar (CASA_RAMIREZ/ESTRUTURA, MQT inspektion).

### Descarte de no-fuente (resúmenes)
Una hoja de **resumen** lista disciplinas/capítulos con su importe pero sin
unidades ni mediciones reales. Cuando el estimador independiente no ve **ninguna**
medición (`estMedidas===0`) y las «partidas» emitidas **no tienen unidad** (≥95%),
la hoja se marca como no-fuente (resumen/lista de importes). Garantía: solo actúa
con `estMedidas===0`; una hoja con mediciones reales nunca se descarta.

## Capa 2 — Auto-auditoría (con la tabla ya montada)
Busca incoherencias internas que una pasada hacia delante no puede ver, **sin
reparar**: solo señala y pone una **confianza 0..1 por hoja**. Señales:

- **Jerarquía rota**: `capitulo` vacío PERO `subcapitulo`/`seccion` con contenido
  es imposible "bien" → se perdió/no se reconoció la cabecera de capítulo. (Es el
  detector más potente; distinto del caso benigno en que todo el nivel está
  vacío = el capítulo es la propia hoja.)
- Una descripción que domina la hoja con el texto real en `detalle` (título
  colado como descripción).
- Reconciliación: conteo independiente de filas con número+unidad para cazar
  pérdidas silenciosas.
- Unidades raras / cantidades a 0, proporcionales.

## Capa 3 — Corrección dirigida (recetas)
La señal de la capa 2 **dispara** un banco de recetas. Cada receta re-parsea la
hoja con una hipótesis y **solo se queda la que más sube la confianza** (medida
otra vez por la capa 2). Nunca empeora. Recetas actuales:

- **Cabecera escondida por formato**: códigos con espacio/punto final
  (`ARQ 1.`, `A 1.1.1.1`, `1.`) → se normalizan y la cabecera se reconoce.
- **Nivel constante degenerado**: si todos los códigos cuelgan de un primer
  segmento constante sin cabecera (`A.x`), se elimina ese nivel.
- **Cero final de cabecera**: convenio `1.0` = capítulo, `1.1.0` = subcapítulo,
  `1.1.1` = partida → se quita el `.0`.
- **Código partido en dos columnas**: prefijo (p. ej. Bloco `A.`, `A.1.`) + ítem
  (`1.1.1`) → se recombinan.

### Regla universal: el capítulo nunca queda vacío
Por definición toda partida tiene un nivel superior. Tras las recetas, si aún
queda `capitulo` vacío PERO hay `ruta` (existen títulos por encima), se
**compacta**: el título más alto presente pasa a `capitulo`, el siguiente a
`subcapitulo`, etc. (respetando `division` si es el más alto). Se marca con un
aviso "capítulo inferido" y la confianza se limita (≤0.9): se rellena, pero se
avisa de que la jerarquía venía incompleta en origen.

## Revisión humana de jerarquía — la ruta no pierde nada
Al reasignar niveles (designar la hoja como capítulo, mover un título de nivel…),
la `ruta` se reconstruye con **todos** los niveles activos, incluidos los que
quedan **por debajo de sección**: el esquema solo tiene 4 columnas
(división/capítulo/subcapítulo/sección), pero un quinto nivel no se tira — va al
migajero (`ruta`). Así, subir una disciplina a capítulo nunca borra el detalle
fino que había debajo.

## Confianza y validación
La app agrega la confianza por hoja (ponderada por nº de partidas) en un
indicador global. Es **autoevaluación de la herramienta**, no verdad validada:
el siguiente paso para fiarse del número es **validación humana** contra
estudios reales hechos a mano.

**Oráculo de capítulo** (`test-regresion.js`): `ARQUITECTURA`/`ARQUITETURA` es,
casi sin excepción, un capítulo. El test busca esa ancla como título en cada hoja
y comprueba que cae en la columna `capitulo`; si un archivo que lo cumplía deja de
cumplirlo, **falla** (red de seguridad barata contra regresiones de jerarquía).
Es una señal *vinculante* derivada del dominio, no una autoevaluación.
