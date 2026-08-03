# kalam-plugins — estado y guía para sesiones

Repo de plugins de Claude para Kalam (construcción). El trabajo activo es
**hopper**. (También existe `morse/`, otro plugin, no es el foco.)

## ⚠️ LEE ESTO PRIMERO — dónde se desarrolla y dónde vive la verdad

**El desarrollo del producto NO ocurre en este repo.** Gerardo trabaja en local
(Cowork, carpeta OneDrive `13_KalamHopper`), sobre el HTML, con el corpus de 40
MQT al lado. Allí hay **su propio `CLAUDE.md`**, que es el que refleja el día a
día del producto.

| dónde | qué es | cuándo se toca |
|---|---|---|
| `13_KalamHopper/` (local de Gerardo) | **el producto**. `kalam_normalizador_MQT_v1.html` + corpus + su CLAUDE.md | a diario |
| este repo | **el plugin** + foto del motor para cuando haya que retomarlo | cuando se sincroniza o se trabaja el plugin |

`hopper/app/hopper_multicapa.html` **es el mismo fichero** que
`kalam_normalizador_MQT_v1.html` en local, con el nombre del repo. No son dos
variantes: es una copia sincronizada.

**Al retomar el plugin: lo primero es preguntar a Gerardo por su HTML y su
CLAUDE.md locales y comprobar si el repo se ha quedado atrás.** Ya pasó una vez
(julio 2026: el repo se quedó 4 días y 2 sesiones por detrás sin que saltara
ninguna alarma, y el plugin corrió semanas con una auditoría vieja que no
marcaba archivos que la app sí marcaba).

### Sincronizado el 2026-08-03
Repo == local en esa fecha. Verificado `core embebido == standalone`. Antes de
esto el repo iba por el 2026-07-02 y le faltaban las sesiones del 07-04 y 07-06
(auditoría ampliada, semáforo, panel «Hojas y avisos», mapaResumo generalizado).

## hopper — normalizador de mediciones (MQT)

Convierte Excels de medición portugueses (MQT, *Mapa de Quantidades*) — muy
heterogéneos — en **una tabla canónica**. Y genera un segundo Excel "hoja de
costes" para pegar en el sistema de costes de Kalam.

### Dos líneas
- **El producto** (`hopper/app/`): app **HTML autónoma, sin IA en runtime y sin
  servidor**. Los datos no salen del navegador del cliente. **Esto es lo que se
  entrega y se cobra**; la privacidad es contractual (ver «Estrategia»).
- **El plugin** (`hopper/skills/normalizar/`): hace **lo mismo que la app**
  ejecutando el **mismo motor** con `assets/normalizar.js` (Node), y además
  permite **interacción para casos difíciles** (playbook en `SKILL.md`,
  diagnóstico con `assets/inspeccionar.js`). `assets/extraer.py` es **legacy**.

### Para qué existe el plugin (no es «la app en Node»)
1. **La salida de emergencia** para las hojas que la app marca en rojo/ámbar:
   flujo interactivo por fichero (preguntar al usuario lo que solo él sabe,
   `overrides`, `mapa-jerarquia.js`). Resuelve ESE fichero, no toca el motor.
2. **El bucle de desarrollo**: el archivo rebelde se diagnostica y se convierte
   en regla validada contra el corpus.
3. **El upgrade de pago** (1.800 € en la oferta). Se acopla a la app por la
   **idempotencia**: Claude produce la tabla canónica de 13 columnas, la app la
   recarga, la audita y saca la hoja de costes. Por eso las 13 columnas son un
   contrato, no un detalle.

> Si el plugin no corre el mismo motor que la app, **no es la salida de
> emergencia de nada**: diagnostica peor y falla en silencio, justo lo que su
> propio principio prohíbe. Mantener la sincronía es su razón de existir.

### Ficheros clave (app)
- **`hopper/app/hopper_multicapa.html`** — **la fuente de verdad**. El motor
  vive embebido dentro (hoy, líneas ~326–1417).
- **`hopper/app/normalizar.core.js`** — **copia** del motor embebido, para que
  Node pueda usarlo. Se genera **desde el HTML**, nunca al revés.
- **`hopper/app/hopper_normalizador.html`** — versión estable de **una pasada**,
  **congelada** como fallback (motor embebido antiguo). No tocar.
- **`hopper/app/banco-pruebas.js`** — auto-éxito sobre un lote.
- **`hopper/app/test-regresion.js`** — invariantes + snapshot + verifica
  `embebido == standalone`. **Está versionado aquí**: no hay que reconstruirlo.

### ⚠️ La dirección de la sincronía (esto se invirtió y causó la divergencia)
El HTML manda. Al editar el motor **se edita el HTML** y luego se **extrae** el
core:

```bash
sed -n '326,1417p' hopper/app/hopper_multicapa.html > hopper/app/normalizar.core.js
node --check hopper/app/normalizar.core.js
node hopper/app/test-regresion.js <corpus>   # confirma «embebido == standalone»
```

(Los números de línea cambian al editar el HTML: localizar el `<script>` que
empieza por `/* Motor de normalización` y acaba en `})(typeof window...)`.)

### Arquitectura por capas (ver `references/capas-y-correccion.md`)
1. **Extracción** — detecta columnas por contenido, clasifica filas, vuelca.
2. **Auto-auditoría** — con la tabla montada, detecta incoherencias (sobre todo
   *jerarquía rota*: capítulo vacío con subcapítulo lleno) y pone **confianza
   0..1 por hoja**. No repara.
3. **Corrección dirigida** — la señal de la capa 2 dispara recetas (cabecera
   escondida `ARQ 1.`, nivel constante `A.x`, cero final `1.0`, código en 2
   columnas tipo Bloco); se queda la que **sube la confianza**. Y la **regla
   universal**: el `capitulo` nunca queda vacío (compactación desde la ruta).

### Esquema v3 (contrato) — 13 columnas
`archivo, hoja, fila_origen, division, capitulo, subcapitulo, seccion, ruta,
codigo, partida, detalle, unidad, medicion`.
- **`division`** = nivel sobre el capítulo (edificio/bloque/fase, p. ej.
  `BLOCO A`). Vacío salvo que la obra lo traiga. `capitulo` = disciplina.
- **Sin precio ni importe**: un MQT mide, no presupuesta.
- Documentado en `references/esquema-salida.md`. El oráculo `extraer.py` lleva la
  columna pero **aún no rellena `division`** (la receta vive solo en el core).

### Dos salidas
1. **Excel normalizado** (tabla canónica) + hoja `Notas`.
2. **Hoja de costes** (`Código · Nat · Ud · Partida · CanPres`) con cabeceras
   `División`/`Capitulo`/`Subcapitulo`/`Sección` y filas `TOTAL …` intercaladas
   vacías, para copy/paste en la plantilla de costes de Kalam.
   Existe además la variante **formulada** (plantilla de estudios, columnas
   A..AV, totales con `SUM()` para tolerar celdas de input vacías, bandas de
   color por fila y borde separando bloques). Hecha el 2026-07-02 y **sin
   documentar hasta ahora** — está en el código, `costesFormulados` en el core.

### Idempotencia (passthrough)
La app **reconoce su propia salida**: si el libro trae la cabecera canónica v3
exacta (las **13 columnas**), el motor **no re-detecta** nada y lo carga tal cual
(`desdeNormalizado` en el core) — reconstruye estructura de costes y títulos de
jerarquía desde las propias filas (`estDesdeMed`/`titulosDeMed`), regrupando por
la columna `hoja`. Así `normalizar(normalizado) == normalizado`. Pensado para el
flujo **descargar → editar a mano → recargar → re-exportar / sacar la hoja de
costes**. Exige las 13 columnas: firma inequívoca, no confundible con un MQT
real (verificado: roundtrip de Palmira, 524 partidas idénticas).
Es también el acoplamiento del plugin con la app (ver «Para qué existe»).

## Archivo de cliente que falla — SIEMPRE en este orden

Son **dos arreglos distintos**. No mezclarlos: el primero es para el cliente, el
segundo para el producto. Mezclarlos convierte cada caso puntual en un cambio de
reglas globales hecho con prisa.

### 1) Arreglar EL ARCHIVO (sin tocar el motor) ← empezar SIEMPRE por aquí
Es el flujo del plugin, y también sirve en local. Rápido y sin riesgo.
1. `node assets/inspeccionar.js <xlsx> "<hoja>" 30` — ver familia, `headerRow`,
   `cols` detectados y las filas crudas.
2. **Preguntar al usuario lo que solo él sabe**: «esta hoja se llama AVAC, ¿es el
   capítulo de todo?», «`A` ¿es capítulo o es un bloque/división?».
3. **`overrides`** — 4º argumento de `core.normalizar`, o `--overrides ov.json`
   en el ejecutor:
   ```json
   { "AVAC": { "familia":"codigo", "headerRow":6,
               "cols":{"code":0,"desc":2,"unit":4,"qty":5} } }
   ```
4. **¿Hay hoja Resumo/Índice?** Suele traer la jerarquía completa y es la vía más
   fiable: `node assets/mapa-jerarquia.js <xlsx> --out <dir>`.
5. Entregar los dos Excel **y anotar el patrón** por si merece regla.

### 2) Arreglar EL MOTOR (regla nueva) — solo si el patrón se repetirá
Editar el HTML, re-extraer el core, validar contra los 40. Test triple antes de
aceptar una regla:
1. ¿Enuncia una verdad sobre los MQT **en general**, no sobre este archivo?
2. ¿Dispara por **firma estructural**, no por coincidencia (nombre de hoja…)?
3. ¿El diff sobre los 40 confirma que **solo** cambia lo que exhibe la firma?

**Ningún cambio del recuento total de mediciones sin explicación.** Dos arreglos
nacieron rotos y los cazó ese diff (una exclusión que se comía 191k de obra real;
una firma que degradaba Rua do Ouro).

No hay ni una referencia a un archivo concreto en el motor. Los nombres en los
comentarios (`caso Rossio Place`) documentan **dónde se descubrió** el patrón, no
dónde aplica.

## Estado actual

- Corpus de **40 MQT reales**, ~30k mediciones, 0 errores de lectura.
  **Invariante**: 0 partidas con capítulo vacío teniendo ruta.
  ⚠️ El recuento exacto está **sin re-medir** tras la sincronía: el corpus cambió
  (se retiró `MQT - Imprensa Nacional.xlsx`) y el motor avanzó. **Re-medir y
  re-fijar la línea base** (`test-regresion.js <corpus> --save`) antes de tocar
  nada.
- **Semáforo de 3 niveles** en la UI: verde / ámbar («Revisa antes de usar») /
  ROJO si la peor hoja <70%. El agregado es el eslabón más débil, no un promedio.
- **Panel «Hojas y avisos» con acciones**: cada hoja con su chip de confianza y
  sus avisos; botón cuando existe un arreglo determinista pre-verificado («usar
  el nombre de la hoja como capítulo», «excluir esta hoja», ambos reversibles).
- **Auditoría ampliada**: jerarquía a trozos, partidas sin descripción, columna
  de unidad con valores casi únicos, y **reconciliación como veredicto**
  (`estMedidas` vs `nMed` tira la confianza). Es la red de seguridad agnóstica al
  formato para archivos nunca vistos.
- **mapaResumo**: la hoja-índice manda cuando existe (arregló Hidden Away: de 61
  «capítulos» a los 13 reales).
- **Validación humana en curso**: existe `Validacion_capitulos_Hopper.xlsx` (en
  local, generado 2026-07-06) circulando por el equipo de estudios de Kalam —
  518 filas archivo×capítulo con columnas SÍ/NO. Cuando vuelva relleno: los SÍ →
  léxico de disciplinas; los NO → lista priorizada de errores.

### ⚠️ Lección aceptada: verde ≠ sin errores
Verde significa «coherente **según las reglas actuales**». Palácio Mendia iba con
confianza 1 y capítulos falsos (TUBAGEM, VÁLVULAS, DESCONTO COMERCIAL). El
barrido visual de la lista de capítulos es parte del procedimiento, no un extra.

## Pendiente (por valor)

- **URGENTE — Plausibilidad de capítulos con léxicos.** Extraer del corpus los
  léxicos de disciplinas/cabeceras/unidades reales e incrustarlos, y que la capa
  2 baje la confianza cuando los capítulos detectados no se parezcan a los del
  sector (prosa larga, «Nota…», frases). Es la anticipación real ante formatos
  nunca vistos: no reconocerlos, sino **detectar que no se han entendido**.
  (Regla acordada: **vocabulario sí se anticipa; estructura solo con evidencia** —
  una regla estructural especulativa es riesgo gratuito.)
- **Oráculo ARQUITECTURA: 3 archivos rotos** (ancla presente pero no cae en
  capítulo): **ROSSIO 85 a 89** (`ARQUITECTURA` con código `1.`), **Calçada
  Memória** (`ARQUITETURA` como título de texto), **Palácio Mendia** (`ARQ`,
  prefijo-palabra).
- **Formato «dimensiones con cantidad en la fila inferior»** (Imprensa Nacional ›
  `medições ARQ`: ~257 mediciones aparentes, 0 extraídas). Único caso de pérdida
  masiva conocida; sale en ROJO (0.3). El fichero ya no está en el corpus.
- **Dedup hoja-resumen vs hoja-detalle** (Rossio Place: `MQT_Plengil` es el
  resumen de `Medições_Plengil`; contención 0.45 < 0.8 porque los códigos
  difieren, 1.1 vs 1.1.x). Idea: comparar también partida+total.
- **Recuperar el nivel «sección»** cuando el origen lo aporta en minúsculas
  (`0.1. Montagem`, hoy se tira en `parseFormato`), **sin forzarlo** cuando no
  existe (en Av5Out77 `2.1.` cuelga directo de `2. PAREDES` sin sección). Un
  hueco intermedio es señal de sub-detección: intentar rellenarlo y, si no
  aparece, señalarlo. — *aparcado*.
- Partida multilínea bajo títulos con guiones (Pátio Salema bloque F): el
  subcapítulo queda como `partida` y el texto real en `detalle`. Jerarquía
  correcta, reparto mejorable.
- Receta capa 3 para «título pegado como descripción» (Hidden Away, 0.55): la
  capa 2 lo detecta pero no hay reparación.
- **`tabla.js` no existe en ninguna parte** — es el script que generaba el Excel
  de validación (recorre el corpus y vuelca `tabla_validacion.json`; luego un
  script openpyxl monta las 3 hojas). Vivía en un scratchpad y se perdió. Hará
  falta si el motor cambia antes de que Kalam devuelva el Excel relleno.
- Long tail a 88-96%: Hidden Away, Lx Factory, Ferreria Borges, CASA_RAMIREZ.
- Decidir si la multicapa sustituye a la congelada.

## Estrategia y contexto de producto (decidido con Gerardo, 2026-07-04)

- **Oferta a Kalam (OF26006/01)**: app base 4.900 € con compromiso de reducir
  ≥75% del trabajo manual; opcionales: asistente IA con Claude 1.800 €,
  integración con fichero de costes 900 €, mejoras a 90 €/h. La oferta promete
  «sin envío de información a servidores externos» → **la privacidad es
  CONTRACTUAL**: la IA solo puede entrar como upgrade explícito, nunca de serie.
- **Arquitectura reglas+IA**: las reglas son el runtime (gratis, instantáneo,
  determinista, privado, auditable); la IA vive en el bucle de desarrollo y en el
  plugin/upgrade. El semáforo es el router que decide cuándo merece pagar IA.
  **El valor del producto no es el archivo de reglas: es el bucle que lo
  alimenta.**
- **Miedo principal de Gerardo**: que el cliente meta sus primeros archivos y
  falle. Respuesta acordada: fallar A GRITOS (auditoría + semáforo), fase sombra
  antes de entregar, acompañar la primera semana, y que todo rojo tenga salida.
- **Nota contractual**: la «herramienta de revisión asistida para ajustar la
  jerarquía» de la oferta fue sustituida por el panel «Hojas y avisos» con
  acciones (misma función, menos fricción). Defendible como evolución.

## Procedimiento acordado para el equipo de estudios (reunión 2026-07-06)

1. Arrastrar todos los Excel del proyecto de golpe.
2. Mirar el anillo: verde → seguir; ámbar/rojo → abrir «Hojas y avisos».
3. **Barrer la lista de capítulos** (¿son disciplinas de obra?): es el detector de
   mentiras — Mendia demuestra que el verde no exime de este paso.
4. Avisos con botón → aplicarlo; sin botón → decidir (excluir, o corregir en
   Excel y recargar).
5. Contrastar nº de partidas con lo esperado.
6. Descargar los dos Excel. **NADA que haya salido en rojo se pega en costes.**
7. Archivo que salga mal → a Gerardo. Dos tiempos: **el archivo resuelto en el
   día** (arreglo 1) y, si el patrón se repite, **regla nueva en días**.

Mensaje de venta: la app no promete acertar siempre — **promete no mentir**.

## ⚠️ El corpus NO está en el repo
Los 40 MQT son datos de cliente y no se versionan. Viven en **`01_Documentos/`
de la carpeta local de Gerardo**. En una sesión de este repo hay que volver a
subirlos para reejecutar banco de pruebas / regresión.

## Convenciones
- Rama de trabajo: `claude/hopper-plugin-version-sync-v68c3r`.
- Commits descriptivos; medir en el corpus antes/después de tocar el motor.
- No añadir librerías/dependencias. Mantenerlo simple ("no complicar").
- Nunca producir salida mal en silencio: ante la duda, **señalar**.
- **Aviso de propiedad**: `hopper_multicapa.html` lleva en la cabecera el
  copyright de Gerardo Marote (uso interno de Kalam, sin redistribución).
  Mantenerlo al editar. (La congelada `hopper_normalizador.html` aún no lo lleva.)
