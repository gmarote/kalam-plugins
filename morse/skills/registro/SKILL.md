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

---

## 0. Bienvenida

Antes de nada, usar la herramienta `mcp__visualize__show_widget` para mostrar el logo de Morse con este HTML:

```html
<div style="text-align:center; padding: 16px 0 8px 0;">
  <img src="https://cdn.jsdelivr.net/gh/gmarote/morse-plugins@main/morse/Morse.jpg"
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

**Paso 2 — Verifica el lock file del Excel**
Comprueba programáticamente si existe `~$COMUNICACIONES.xlsx` en la carpeta. Si existe, intenta abrir el archivo como verificación secundaria (puede ser caché residual):
- Si el archivo **no se puede abrir** → Excel está abierto. Avisa al jefe y no continúes hasta que el lock desaparezca.
- Si el archivo **sí se puede abrir** → lock residual, puedes continuar.

**Paso 3 — Lee el Excel**
Abre `COMUNICACIONES.xlsx` y revisa la hoja **Comunicaciones** para:
- Saber cuál es el último ID registrado. Si la hoja está vacía (primera comunicación del proyecto), el próximo ID será `01`.
- Extraer los temas existentes (columna Tema) y repasar los resúmenes (columna Resumen) para construir una imagen del estado actual de la obra: qué hilos están abiertos, qué está pendiente, si hay exposición económica o contractual activa. Este contexto es imprescindible para asignar correctamente el tema de cualquier comunicación nueva. Si no hay registros previos, no hay temas con los que contrastar — proponer un tema nuevo basándose solo en el contenido de la comunicación.

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
Usando el contexto construido en el arranque, contrastar la nueva comunicación con los temas existentes:
- Si encaja en uno ya abierto, asignarlo y decirlo en voz alta.
- Si no encaja, proponer un tema nuevo y justificarlo brevemente.

El jefe puede corregir el tema directamente en el Excel.

**Campos:** ver `references/campos-excel.md`

**Escritura segura:** usar siempre el patrón de `references/escritura-excel.md`. Nunca guardar directamente sobre el original.

---

## 4. Acciones tras registrar

**Contextualizar el hilo**
- Hilo existente: resumir el estado acumulado — cuántas comunicaciones, qué está pendiente, si hay riesgo contractual o exposición económica.
- Hilo nuevo: indicar que se ha abierto un tema nuevo y cuál es el resumen del primer registro.

**Proponer siguiente paso** y esperar confirmación antes de ejecutar:
- **Redactar respuesta** — si la comunicación registrada o el contexto del hilo requieren respuesta, sugerir la redacción de dicha respuesta, sugerir estilo (Formal / Técnico / Cordial) y esperar aprobación. Una vez aprobado redactar la respuesta y mostrar para validar o iterar. Una vez validada, guardar como `.txt` en `Comunicaciones/` con su ID OUT y actualizar el Estado de la comunicación IN relacionada: a **Pendiente cliente** si se espera confirmación o nueva respuesta del otro lado; a **Cerrada** si la respuesta resuelve el asunto sin acción pendiente en ningún lado.
- **Revisar documentación** — si la comunicación registrada el contexto del hilo sugieren la revisión de la documentación del contrato, preguntar al jefe de obra si se deben consultar documentos del proyecto como el contrato, planning u otros documentos, existentes en `Documentacion/` o que deban ser aportados por el jefe de obra.
- **Solo registrar** — si el jefe no necesita acción inmediata.
- **Otras opciones** — sugerir otras opciones al jefe de obra relacionadas con el contexto de la comunicación registrada o del hilo.

Iterar con el jefe hasta cerrar la acción o dejarla aparcada conscientemente.

---

## 5. Actualizar el dashboard (silencioso)

Tras cerrar la acción con el jefe, actualizar el dashboard del proyecto en segundo plano. No mencionar este paso.

1. Llamar a `mcp__cowork__list_artifacts` y buscar el artifact con id `morse-[nombre-carpeta]-dashboard`.
   Si no existe, terminar aquí sin avisar.

2. Leer el HTML actual del artifact con la herramienta Read sobre la ruta devuelta.

3. Construir el JSON con todos los datos actuales del proyecto:
   ```python
   import json, re
   from datetime import datetime

   # Leer todas las filas del Excel (ya cargado en el paso 1)
   # excluyendo la fila de ejemplo 00_...
   rows = [...]  # lista de dicts con todas las columnas

   data = {
       "project_name": project_name,  # celda A1 del Excel
       "folder": folder_name,
       "updated_at": datetime.now().strftime("%d/%m/%Y %H:%M"),
       "rows": rows
   }
   new_json = json.dumps(data, ensure_ascii=False)
   ```

4. Reemplazar el bloque de datos en el HTML:
   ```python
   html_new = re.sub(
       r'/\* MORSE_DATA_START \*/.*?/\* MORSE_DATA_END \*/',
       f'/* MORSE_DATA_START */{new_json}/* MORSE_DATA_END */',
       html_current,
       flags=re.DOTALL
   )
   ```

5. Llamar a `mcp__cowork__update_artifact`:
   - `id`: `morse-[nombre-carpeta]-dashboard`
   - `html`: el HTML modificado
   - `update_summary`: `Datos actualizados tras registrar [ID de la comunicación recién registrada]`
