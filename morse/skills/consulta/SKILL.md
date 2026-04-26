---
name: consulta
description: >
  Consulta el estado de las comunicaciones de un proyecto de obra. Úsala
  cuando el usuario pregunte por comunicaciones pendientes, pida un resumen
  de un hilo o tema, busque comunicaciones por remitente o fecha, o quiera
  una visión general del estado del proyecto.
---

# MORSE · Consulta de Comunicaciones de Obra

Permite consultar, filtrar y resumir el registro de comunicaciones sin modificar ningún archivo.

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


## 1. Arranque

**Paso 1 — Lee `Documentacion/RESUMEN.txt`**
Proporciona el contexto de la obra necesario para interpretar correctamente las consultas. Si no existe, avisa y continúa solo con los datos del Excel.

**Paso 2 — Lee el Excel**
Abre `COMUNICACIONES.xlsx` y carga la hoja **Comunicaciones** completa. No es necesario verificar lock file — esta skill es de solo lectura.

---

## 2. Tipos de consulta

**Estado general**
Resumen del proyecto: total de comunicaciones, cuántas están pendientes de respuesta, cuántas pendientes de cliente, cuántas cerradas. Mencionar los hilos con más actividad reciente o con riesgo contractual o económico activo.

**Por tema**
Todas las comunicaciones de un tema: cronología, estado actual, qué está pendiente y quién debe actuar.

**Por remitente o interlocutor**
Todas las comunicaciones de o hacia una persona o entidad concreta.

**Por estado**
Listar comunicaciones con un Estado específico: `Pendiente respuesta`, `Pendiente cliente`, `Registrada`, `Cerrada`.

**Por fecha o período**
Comunicaciones dentro de un rango de fechas.

**Búsqueda libre**
Si la consulta no encaja en los tipos anteriores, buscar en las columnas Asunto y Resumen por palabras clave.

---

## 3. Formato de respuesta

- Responder de forma directa y concisa. No mostrar tablas completas salvo que el jefe lo pida.
- Si la consulta implica riesgo contractual o económico, destacarlo explícitamente.
- Si hay comunicaciones pendientes de respuesta con plazo próximo o vencido, mencionarlo siempre aunque no se haya preguntado por ello.
- No modificar ningún archivo. Si el jefe quiere registrar algo a raíz de la consulta, indicarle que use la skill de registro.

---

## 4. Actualizar el dashboard (silencioso)

Después de responder al jefe, actualizar el dashboard en segundo plano. No mencionar este paso.

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
   - `update_summary`: `Datos actualizados tras consulta`
