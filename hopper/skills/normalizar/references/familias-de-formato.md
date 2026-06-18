# Familias de formato

Los Mapas de Quantidades (MQT) que envían los arquitectos vienen en maquetación
libre, pero **no son infinitos**: se agrupan en pocas familias según *cómo se
reconoce la jerarquía* capítulo › subcapítulo › partida › parcial. Sobre 5
ficheros reales de 4 estudios distintos, 4 caen en la familia **A (código)** y
1 en la familia **B (formato)**.

La detección de familia y el mapeo de columnas los propone el agente leyendo el
fichero, **y los confirma el cliente** (ver Fases en SKILL.md). Estas son las
recetas de partida; lo afinado por estudio se guarda en su **perfil**.

---

## Familia A — jerarquía por CÓDIGO

La jerarquía está en el **código de la partida**: el número de segmentos marca
el nivel (`1` → capítulo, `1.1` → subcapítulo, `1.1.2.1` → partida/sub-partida).

**Huella de detección**: hay una columna de código con valores tipo
`1`, `1.1.1`, `2.1.2.1.1`, y opcionalmente prefijo de letra (`E`, `E.1`, `ARQ.2`).

**Cómo clasificar cada fila**:
- código estructural **sin** unidad ni medición → **título** (capítulo si
  nivel 1; si no, subcapítulo). Fija el título vigente de ese nivel.
- código estructural **con** unidad y medición → **partida** (hoja de medición).
- código que NO es estructural (`CG.01`, `.`, texto libre) → **nota** /
  condición general. No es medición.
- fila vacía → se descarta.

**Reconstrucción**: se mantiene una pila de títulos por nivel; al emitir una
partida, `capitulo` = título de nivel 1, `subcapitulo` = nivel 2, `seccion` =
nivel 3, `ruta` = la cadena completa de títulos ancestros unida con ` > ` (a
cualquier profundidad, sin perder nivel 4+), `codigo` = el código tal cual.

**Casos reales en esta familia**: Palácio Mendia (`1.1.2.1`), Ferragial
(`1.4.1.7`, cabecera multilínea), Rossio · MQT_Plengil (`E.1`, prefijo de letra).

**Cuidado con**:
- Cabeceras a varias líneas (`Nº\nArtigo`, `Custo\nUnitário`): localizar la fila
  de cabecera por *contenido aproximado*, no por texto exacto.
- Prefijos de letra y capítulos solo-letra (`E` = ESTALEIRO).
- Códigos `CG.xx` (condiciones gerais) que parecen estructurales pero son notas:
  el discriminante fiable es **¿tiene unidad y medición?**.

---

## Familia B — jerarquía por FORMATO

No hay código jerárquico fiable (el código es un prefijo de capítulo repetido,
`ARQ-`). La jerarquía se deduce del **formato de la fila** y de la posición.
A menudo va **una pestaña por capítulo** (el nombre de la pestaña ES el capítulo).

**Huella de detección**: el código se repite (`ARQ-`, `TRABP`) y los títulos de
subcapítulo van en MAYÚSCULAS sin medición; hay parciales sin código debajo de
las partidas.

**Cómo clasificar cada fila** (con el mapeo de columnas ya acordado):
- con código + descripción **EN MAYÚSCULAS** y sin medición → **título de
  subcapítulo**.
- con código + texto normal → **cabecera de partida**. Si trae unidad y
  medición es una partida simple; si no, es **compuesta** y sus mediciones
  vienen debajo como parciales.
- sin código + con unidad y medición → **parcial** de la partida vigente
  (se cuelga de ella; `partida` = descripción de la madre repetida, su texto
  propio va a `detalle`).
- sin código + solo texto → **nota**.
- `TOTAL …` sin medición → **subtotal** (se descarta).

**Reconstrucción**: `capitulo` = nombre de la pestaña (o cabecera);
`subcapitulo` = último título en mayúsculas; `ruta` = `capitulo > subcapitulo`;
`partida` = descripción de la partida (repetida en sus parciales, con el texto
del parcial en `detalle`).

**Caso real en esta familia**: Calçada da Memória (pestañas TRABP, ARQ, EST…),
con importe desglosado por zonas en varias columnas.

---

## Decisión de parciales (transversal, SIEMPRE preguntar)

Las dos familias tienen "parciales" (el desglose que suma la medición de la
partida). El cliente decide:
- **Conservar** cada parcial como fila propia (máximo detalle) — por defecto.
- **Colapsar** a la partida, sumando las mediciones de sus parciales.

Se registra la elección en el perfil del estudio.

---

## Añadir una familia nueva

Si aparece un MQT que no encaja (p. ej. medición calculada desde dimensiones
`Comp × Largura × Altura × Partes`, como la hoja `Medições_Plengil` de Rossio),
**no forzarlo**: documentar la huella y la receta aquí, y añadir su rama al
extractor `assets/extraer.py`. El esquema de salida no cambia.
