# Arquitectura por capas y autocorrección

La normalización no es una sola pasada: es un pipeline determinista (sin IA) de
tres capas. La idea: **detectar dónde algo no cuadra y corregirlo solo cuando se
puede demostrar que mejora** — y, cuando no, **señalarlo en vez de fallar en
silencio**.

## Capa 1 — Extracción
Lee cada hoja de arriba abajo, detecta columnas por contenido (código,
descripción, unidad, cantidad), clasifica cada fila (título / partida / parcial /
nota / subtotal) y vuelca la tabla canónica. El discriminante universal de
partida sigue siendo: **¿tiene unidad y medición?**

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

## Confianza
La app agrega la confianza por hoja (ponderada por nº de partidas) en un
indicador global. Es **autoevaluación de la herramienta**, no verdad validada:
el siguiente paso para fiarse del número es **validación humana** contra
estudios reales hechos a mano.
