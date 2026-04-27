---
name: registro
description: >
  Registra y archiva comunicaciones de obra: emails, actas, WhatsApps o
  documentos recibidos o enviados. Úsala cuando el usuario comparta una
  comunicación para archivar, quiera redactar una respuesta, o necesite
  añadir un nuevo registro al proyecto.
---

# MORSE · Sistema de Gestión de Comunicaciones de Obra

MORSE centraliza el registro, archivo y seguimiento de todas las comunicaciones de un proyecto de construcción en una estructura de carpetas estándar, con un archivo excel de seguimiento.

**Estructura de carpetas del proyecto:**
- `COMUNICACIONES.xlsx` — base de datos de todas las comunicaciones
- `Comunicaciones/` — archivos de todas las comunicaciones, entrantes y salientes
- `Documentacion/` — documentos de referencia del proyecto (resumen, contratos, planning, etc.)

Todo el contexto específico del proyecto está en `Documentacion/RESUMEN.txt`. Léelo al arrancar y úsalo como referencia para cualquier decisión de fondo. No inventes datos que no estén ahí.

**Regla de comunicación:** trabajar en silencio durante las comprobaciones de inicio, la lectura de archivos y la escritura del Excel. No narrar pasos internos ("leyendo el Excel", "sin lock file", "contexto cargado", etc.). Solo hablar al jefe cuando se necesite su input, cuando haya un error que le afecte, o al presentar el resultado final.

---

## 0. Bienvenida

Antes de nada, usar la herramienta `mcp__visualize__show_widget` para mostrar el logo de Morse con este HTML:

```html
<div style="text-align:center; padding: 16px 0 8px 0;">
  <img src="https://cdn.jsdelivr.net/gh/gmarote/assets@main/logos/Morse.jpg"
       alt="Morse" style="max-width: 320px; width: 100%;" />
</div>
```

- `title`: `morse_logo`
- `loading_messages`: `["Iniciando Morse..."]`

Mostrar el logo y continuar inmediatamente sin esperar respuesta del jefe.

---


## 1. Comprobaciones de inicio

**Paso 1 — Lee `Documentacion/RESUMEN.txt`**
Contiene el contexto de la obra e instrucciones específicas del jefe. Sin ese archivo, avisa de que falta y no proceses nada.

**Paso 2 — Lee `Documentacion/TEMAS.txt`**
Contiene el catálogo de temas abiertos del proyecto, con sus descripciones y líneas `Incluye:`. Úsalo para asignar el tema de la comunicación nueva. Si el archivo no existe o está vacío (sin bloques de tema), trátalo como catálogo vacío: cualquier comunicación abre un tema nuevo.

**Paso 3 — Verifica el lock file del Excel**
Comprueba programáticamente si existe `~$COMUNICACIONES.xlsx` en la carpeta. Si existe, intenta abrir el archivo como verificación secundaria (puede ser caché residual):
- Si el archivo **no se puede abrir** → Excel está abierto. Avisa al jefe y no continúes hasta que el lock desaparezca.
- Si el archivo **sí se puede abrir** → lock residual, puedes continuar.

**Paso 4 — Lee el Excel (solo el último ID)**
Abre `COMUNICACIONES.xlsx` y lee únicamente `max_row` de la hoja **Comunicaciones** para saber cuál es el último ID registrado. Si la hoja está vacía (primera comunicación del proyecto), el próximo ID será `01`. No leer más datos del Excel en esta fase.

---

## 2. Archivar la comunicación

**Paso 1 — Identificar el formato**
- **A — Imagen o screenshot:** extrae el contenido como texto.
- **B — Documento adjunto** (PDF, Word, etc.): se archivará directamente sin conversión.
- **C — Copy-paste de texto:** listo para guardar.

**Paso 2 — Asignar el ID**
Formato: `[NN]_[IN/OUT]_[YYYYMMDD]_[Remitente]-[descriptor-corto]`
Ejemplo: `07_IN_20260501_DF-penalizaciones-cubierta`
El número es correlativo global. Revisar siempre el último en el Excel antes de asignar.

**Paso 3 — Guardar en `Comunicaciones/`**
Guardar el archivo con el ID como nombre. Casos A y C: guardar como `.txt`. Caso B: guardar el archivo original tal cual.

**Adjuntos**
Todo lo que llega junto comparte número de ID y genera un único registro en el Excel. Los adjuntos se guardan con el mismo ID más un sufijo descriptivo:
```
32_IN_20260521_DF-penalizaciones.txt          ← registro en Excel
32_IN_20260521_DF-penalizaciones_foto-fachada.jpg
32_IN_20260521_DF-penalizaciones_informe.pdf
```
Si algún adjunto es un documento formal con entidad propia (acta firmada, burofax, informe técnico), indicárselo al jefe y preguntar si quiere registrarlo también por separado.

---

## 3. Actualizar el Excel con el nuevo registro

**Asignar el Tema**
Contrastar la comunicación contra los bloques de `Documentacion/TEMAS.txt`:
- Si encaja claramente en un único tema existente, asignarlo e indicar al jefe el motivo.
- Si toca dos o más temas existentes, asignar **Tema General** e indicar al jefe por qué.
- Si no encaja en ninguno, crear un nombre de tema descriptivo.

El jefe puede corregir el tema directamente en el Excel.

**Actualizar `Documentacion/TEMAS.txt`**
Modificar el archivo solo en estos casos:
- **Tema nuevo:** añadir al final un bloque con este formato:
  ```
  ## [Nombre del tema]
  [Una o dos frases describiendo de qué trata este tema.]
  ```
- **Matiz relevante en tema existente:** si la comunicación aporta un sub-hilo o detalle concreto que ayude a clasificar futuras comunicaciones en ese tema (un plazo específico, un actor nuevo, una variante del asunto), añadir una línea `Incluye:` al bloque correspondiente:
  ```
  Incluye: [descripción breve del sub-hilo o detalle]
  ```
- **Comunicación rutinaria dentro de un tema ya bien descrito:** no tocar el archivo.

**Campos:** ver `references/campos-excel.md`

**Escritura segura:** usar siempre el patrón de `references/escritura-excel.md`. Nunca guardar directamente sobre el original.

---

## 4. Llamar a `resumen`

Una vez completado el registro (archivo guardado en `Comunicaciones/`, fila escrita en el Excel, `TEMAS.txt` actualizado si procede), invocar automáticamente la skill `resumen` pasándole el tema asignado. No esperar confirmación del jefe ni proponer pasos intermedios: `resumen` se encarga del análisis del hilo y la propuesta de acción.
