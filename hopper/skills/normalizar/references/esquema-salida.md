# Esquema de salida canónico (v2)

Toda normalización produce **una sola hoja** (`Mediciones`) con estas columnas,
en este orden. Es el contrato: no se renombran ni se reordenan sin acuerdo
expreso con el cliente. Si un campo no existe en el Excel de origen, se deja
**vacío** (no se inventa).

| # | columna       | tipo   | qué es                                                                 |
|---|---------------|--------|------------------------------------------------------------------------|
| 1 | `archivo`     | texto  | Nombre del Excel de origen (trazabilidad).                             |
| 2 | `hoja`        | texto  | Pestaña de origen (trazabilidad; útil si el capítulo = hoja).         |
| 3 | `fila_origen` | entero | Nº de fila en el Excel de origen (1-based, como se ve en Excel).       |
| 4 | `capitulo`    | texto  | Nivel 1 de la jerarquía (especialidad / capítulo).                    |
| 5 | `subcapitulo` | texto  | Nivel 2.                                                               |
| 6 | `seccion`     | texto  | Nivel 3 (más niveles intermedios sobrantes, concatenados con ` > `).  |
| 7 | `codigo`      | texto  | Código/identificación de la partida tal cual viene (`1.1.2.1`, `E.1`). |
| 8 | `partida`     | texto  | **Columna principal**: nombre/descripción de la unidad de obra.        |
| 9 | `detalle`     | texto  | Texto del parcial (desglose de medición). Vacío en la fila de partida. |
| 10| `unidad`      | texto  | m, m², m³, ml, Un, Vg, kg, mês…                                        |
| 11| `medicion`    | número | Cantidad medida. Decimal con punto. Vacío si no la trae.               |

> Cambios respecto a v1: se elimina `precio_unitario` e `importe` (un MQT para
> licitar no los trae), se elimina `nivel` (la jerarquía pasa a columnas con
> nombre), se renombra `unidad_obra` → `partida` y `unidad_medida` → `unidad`, y
> se añade delante el bloque de trazabilidad `archivo` / `hoja` / `fila_origen`.

## Jerarquía: 4 niveles fijos con nombre

La jerarquía se aplana **siempre** a cuatro niveles: `capitulo` › `subcapitulo`
› `seccion` › `partida`. La regla de mapeo es fija:

- `capitulo`  = título del nivel 1.
- `subcapitulo` = título del nivel 2.
- `seccion`   = título del nivel 3. Si el código baja más (nivel 4, 5…), los
  títulos intermedios sobrantes se **concatenan en `seccion`** con ` > `.
- `partida`   = la fila que trae **unidad + medición** (la hoja de medición).

Ejemplo con código `2.1.2.1.1`:

```
capitulo     = título del 2
subcapitulo  = título del 2.1
seccion      = título del 2.1.2  (y, si aplica, " > " + título del 2.1.2.1)
codigo       = 2.1.2.1.1
partida      = descripción del ítem
```

El discriminante para saber si una fila es **título** (fija nivel) o **partida**
(se emite) es siempre el mismo: **¿tiene unidad y medición?**

## Parciales (desglose de la medición)

Algunas partidas traen su medición desglosada en varias líneas debajo (los
"parciales"). Se aplanan así:

- La fila de **partida** lleva su descripción en `partida` y `detalle` **vacío**.
- Cada **parcial** se emite como fila propia: `partida` = descripción de la
  partida madre (se repite), `detalle` = el texto del parcial, y su `unidad` /
  `medicion` propias.

Consecuencia útil: las filas con `detalle` **lleno** son parciales y las de
`detalle` **vacío** son partidas. Para totalizar sin doble conteo, se suma un
grupo o el otro, nunca ambos a la vez (el total de la partida y la suma de sus
parciales son la misma cantidad).

## Reglas de tipado y normalización

- **Números**: se interpretan respetando el formato portugués (coma decimal,
  punto de millares) y se emiten como número real, nunca como texto. Los
  símbolos `€` y los espacios se eliminan.
- **`unidad`**: se conserva el texto original del Excel. La homogeneización
  (`m2` → `m²`, `un`/`Un`/`u` → `Un`) es **opcional** y solo se aplica si el
  cliente la pide; en ese caso se documenta el diccionario usado en el perfil
  del estudio. Por defecto NO se altera, para no perder fidelidad.
- **`codigo`**: se conserva literal. Si el origen no trae código útil (p. ej.
  solo el prefijo del capítulo repetido, o un `.`), se deja **vacío** — la fila
  no se pierde: se emite igualmente como partida/parcial colgando de los títulos
  vigentes (`capitulo`/`subcapitulo`/`seccion`).

## Qué NO va al esquema (se descarta o se registra aparte)

- Filas de **membrete** (Cliente / Projeto / Local / fecha).
- **Notas** y condiciones generales (texto sin medición, p. ej. `CG.xx`,
  `Nota:…`). Se vuelcan a una hoja secundaria `Notas` si el cliente las quiere
  conservar, nunca mezcladas con las mediciones.
- **Subtotales** y totales (`TOTAL …`, `SubTotal`).
- Pestañas de **resumen** o **duplicadas** que el cliente marque como no-fuente.

## Importe desglosado por zonas (familia B, opcional)

Algunos MQT reparten la medición en varias columnas por zona del edificio
(p. ej. "Pisos 0 a 3", "Piso 4", "Arranjos Exteriores"). Cuando aparezca, y solo
entonces, se añaden columnas extra `zona_<nombre>` **al final**, sin alterar las
11 columnas canónicas.
