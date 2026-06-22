# kalam-plugins — estado y guía para sesiones

Repo de plugins de Claude para Kalam (construcción). El trabajo activo es
**hopper**. (También existe `morse/`, otro plugin, no es el foco.)

## hopper — normalizador de mediciones (MQT)

Convierte Excels de medición portugueses (MQT, *Mapa de Quantidades*) — muy
heterogéneos — en **una tabla canónica**. Y genera un segundo Excel "hoja de
costes" para pegar en el sistema de costes de Kalam.

### Dos líneas
- **El producto** (`hopper/app/`): app **HTML autónoma, sin IA en runtime y sin
  servidor**. Los datos no salen del navegador del cliente.
- **El plugin** (`hopper/skills/normalizar/`): hace **lo mismo que la app**
  ejecutando el **mismo motor** con `assets/normalizar.js` (Node), y además
  permite **interacción para casos difíciles** (playbook en `SKILL.md`,
  diagnóstico con `assets/inspeccionar.js`). `assets/extraer.py` es **legacy**.

### Ficheros clave (app)
- **`hopper/app/normalizar.core.js`** — el motor. **Fuente de verdad** de la
  lógica. Funciona en navegador y en Node.
- **`hopper/app/hopper_multicapa.html`** — variante **en desarrollo** (capas 2 y
  3). Es la que sigue a `normalizar.core.js`. **Trabajar aquí.**
- **`hopper/app/hopper_normalizador.html`** — versión estable de **una pasada**,
  **congelada** como fallback (motor embebido antiguo). No tocar salvo decisión
  expresa. (Aún lleva el ejemplo incrustado; la multicapa ya no.)
- **`hopper/app/banco-pruebas.js`** — harness headless: `node banco-pruebas.js
  <carpeta>` mide auto-éxito sobre un lote.

### El HTML embebe el motor
`hopper_multicapa.html` lleva *dentro* una copia de `normalizar.core.js`. Tras
editar el core hay que **re-incrustarlo**: localizar el `<script>` que empieza
por `/* Motor de normalización` y termina en `})(typeof window...)` y sustituir
su contenido por el core. (En sesiones previas se hizo con un mini-script Node;
ver historial git.) Verificar siempre: `core embebido == standalone`.

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

### Estado actual (corpus de 35 MQT reales)
- Confianza media **~98%**, **29/35 ≥98%**. 24.365 mediciones, 0 errores de
  lectura. **Invariante**: 0 partidas con capítulo vacío teniendo ruta.
- Validación **humana** hecha solo a fondo en 2 archivos (1 verde correcto, 1
  rojo bien marcado). El 98% es **autoevaluación**, no verdad medida.

### Pendiente
- **Validación humana** sobre un lote real (lo que convierte el 98% estimado en
  medido y sube la confianza del precio). Es el siguiente paso de más valor.
- **Recuperar el nivel «sección» (regla de jerarquía esperada).** Lo normal es
  capítulo › subcapítulo › sección › partida. El motor debe **poblar todos los
  niveles que el origen aporte** para cada partida, buscándolos en códigos y
  títulos **aunque no estén en mayúsculas** (p. ej. `0.1. Montagem`, hoy se tira
  en `parseFormato`). **No inventa**: si la obra no trae un nivel, se deja vacío.
  Un **hueco intermedio** (nivel vacío entre dos llenos) es señal de
  sub-detección: intentar rellenarlo y, si no aparece, señalarlo. (Visto en
  Av5Out77: `0.1.` es sección real; pero `2.1.` cuelga directo de `2. PAREDES`
  sin sección — por eso NO se puede forzar el nivel.) — *aparcado, volver luego.*
- Long tail aún a 88-96%: Hidden Away, Lx Factory, Ferreria Borges, CASA_RAMIREZ.
- Si se consolida la multicapa, decidir si sustituye a la congelada.

### ⚠️ El corpus NO está en el repo
Los 35 MQT están en **`/tmp/lote/MQT/`** (contenedor **efímero**: se borran al
cerrar la sesión). Son datos de cliente; por eso no se versionan. Para reejecutar
el banco de pruebas hay que volver a subirlos.

## Convenciones
- Rama de trabajo: `claude/magical-euler-dxi9y7`.
- Commits descriptivos; medir en el corpus antes/después de tocar el motor
  (recuento de mediciones + confianza) para cazar regresiones.
- No añadir librerías/dependencias. Mantenerlo simple ("no complicar").
- Nunca producir salida mal en silencio: ante la duda, **señalar**.
