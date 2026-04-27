---
name: consulta
description: >
  Búsquedas transversales sobre el registro de comunicaciones: estado general
  del proyecto, comunicaciones por remitente, por estado, por fecha o por
  palabras clave. Úsala cuando el jefe quiera localizar algo concreto o tener
  una visión de conjunto. Para el análisis en profundidad de un tema concreto
  (cronología, riesgos, propuesta de acción) usa la skill resumen.
---

# MORSE · Consulta de Comunicaciones de Obra

Permite consultar, filtrar y resumir el registro de comunicaciones sin modificar ningún archivo.

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


## 1. Arranque

**Paso 1 — Lee `Documentacion/RESUMEN.txt`**
Proporciona el contexto de la obra necesario para interpretar correctamente las consultas. Si no existe, continúa solo con los datos del Excel.

**Paso 2 — Identifica el tipo de consulta**
Antes de abrir el Excel, determina qué tipo de consulta es (ver sección 2). Esto define qué columnas necesitas procesar.

**Paso 3 — Lee el Excel (solo las columnas necesarias)**
Abre `COMUNICACIONES.xlsx` sin verificar lock file — esta skill es de solo lectura. Carga únicamente las columnas relevantes para el tipo de consulta:

| Tipo de consulta     | Columnas a procesar                          |
|----------------------|----------------------------------------------|
| Estado general       | ID, Tema, Estado, Fecha                      |
| Por remitente        | ID, Remitente, Asunto, Fecha, Estado, Tema   |
| Por estado           | ID, Tema, Asunto, Fecha, Remitente, Estado   |
| Por fecha            | ID, Fecha, Tema, Asunto, Remitente, Estado   |
| Búsqueda libre       | ID, Asunto, Resumen, Tema, Fecha, Remitente  |

La columna **Resumen** es la más voluminosa: cargarla solo en búsqueda libre. En el resto de consultas no aporta y ralentiza el procesado.

---

## 2. Tipos de consulta

**Estado general**
Resumen del proyecto: total de comunicaciones, cuántas están pendientes de respuesta, cuántas pendientes de cliente, cuántas cerradas. Mencionar los hilos con más actividad reciente o con riesgo contractual o económico activo.

**Por remitente o interlocutor**
Todas las comunicaciones de o hacia una persona o entidad concreta.

**Por estado**
Listar comunicaciones con un Estado específico: `Pendiente respuesta`, `Pendiente cliente`, `Registrada`, `Cerrada`.

**Por fecha o período**
Comunicaciones dentro de un rango de fechas.

**Búsqueda libre**
Si la consulta no encaja en los tipos anteriores, buscar en las columnas Asunto y Resumen por palabras clave.

**Nota — Consultas por tema**
Si el jefe pregunta por un tema concreto y quiere ver su cronología, valoración de riesgos o propuesta de acción, redirigirle a la skill `resumen`: es la herramienta adecuada para el análisis en profundidad de un hilo. `consulta` puede dar un recuento rápido (cuántas comunicaciones, qué estados), pero no entra en el análisis.

---

## 3. Formato de respuesta

- Responder de forma directa y concisa. No mostrar tablas completas salvo que el jefe lo pida.
- Si la consulta implica riesgo contractual o económico, destacarlo explícitamente.
- Si hay comunicaciones pendientes de respuesta con plazo próximo o vencido, mencionarlo siempre aunque no se haya preguntado por ello.
- No modificar ningún archivo. Si el jefe quiere registrar algo a raíz de la consulta, indicarle que use la skill de registro.
