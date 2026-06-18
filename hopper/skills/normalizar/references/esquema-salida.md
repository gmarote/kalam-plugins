# Esquema de salida canónico

Toda normalización produce **una sola hoja** con estas columnas, en este orden.
Es el contrato: no se renombran ni se reordenan sin acuerdo expreso con el
cliente. Si un campo no existe en el Excel de origen, se deja **vacío** (no se
inventa).

| # | columna           | tipo    | qué es                                                        |
|---|-------------------|---------|---------------------------------------------------------------|
| 1 | `archivo`         | texto   | Nombre del Excel de origen (trazabilidad).                    |
| 2 | `hoja`            | texto   | Pestaña de origen (trazabilidad; útil si el capítulo = hoja). |
| 3 | `capitulo`        | texto   | Capítulo / especialidad (ARQUITETURA, ESTRUTURAS, AVAC…).     |
| 4 | `subcapitulo`     | texto   | Título(s) de subcapítulo vigentes (anidados con ` > `).       |
| 5 | `cod_partida`     | texto   | Código/identificación de la partida tal cual viene.           |
| 6 | `nivel`           | entero  | Profundidad jerárquica (1 = capítulo). Vacío si no aplica.    |
| 7 | `unidad_obra`     | texto   | **Columna principal**: nombre/descripción de la unidad de obra.|
| 8 | `detalle`         | texto   | Texto del parcial (desglose de medición), si se conserva.     |
| 9 | `unidad_medida`   | texto   | m, m², m³, ml, Un, Vg, kg, mês… (normalizada, ver abajo).     |
| 10| `medicion`        | número  | Cantidad medida. Decimal con punto. Vacío si no la trae.      |
| 11| `precio_unitario` | número  | Precio unitario. **Suele venir vacío** (MQT para licitar).   |
| 12| `importe`         | número  | `medicion × precio_unitario` si ambos existen; si no, vacío.  |

## Reglas de tipado y normalización

- **Números**: se interpretan respetando el formato portugués (coma decimal,
  punto de millares) y se emiten como número real, nunca como texto. Los
  símbolos `€` y los espacios se eliminan.
- **`unidad_medida`**: se conserva el texto original del Excel. La
  homogeneización (`m2` → `m²`, `un`/`Un`/`u` → `Un`) es **opcional** y solo se
  aplica si el cliente la pide; en ese caso se documenta el diccionario usado
  en el perfil del estudio. Por defecto NO se altera, para no perder fidelidad.
- **`cod_partida`**: se conserva literal. Si el origen no trae código útil
  (p. ej. solo el prefijo del capítulo repetido), se puede **generar** un código
  secuencial `capitulo.orden` — pero solo con acuerdo del cliente, y marcándolo
  en el perfil.

## Qué NO va al esquema (se descarta o se registra aparte)

- Filas de **membrete** (Cliente / Projeto / Local / fecha).
- **Notas** y condiciones generales (texto sin medición). Se pueden volcar a una
  hoja secundaria `Notas` si el cliente las quiere conservar, nunca mezcladas con
  las mediciones.
- **Subtotales** y totales (`TOTAL …`, `SubTotal`).
- Pestañas de **resumen** o **duplicadas** que el cliente marque como no-fuente.

## Importe desglosado por zonas (caso estudio A)

Algunos MQT reparten el importe/medición en varias columnas por zona del
edificio (p. ej. "Pisos 0 a 3", "Piso 4", "Arranjos Exteriores"). Opciones a
acordar con el cliente:
1. **Sumar** todas las zonas en `medicion`/`importe` (por defecto).
2. **Conservar** cada zona como columna extra `zona_<nombre>` (si el cliente
   trabaja por fases/zonas). En tal caso se añaden al final, sin tocar las 12
   columnas canónicas.
