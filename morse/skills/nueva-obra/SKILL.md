---
name: nueva-obra
description: >
  Crea desde cero la estructura Morse de un nuevo proyecto de obra:
  carpetas, RESUMEN.txt y COMUNICACIONES.xlsx. Úsala cuando el jefe inicie
  un proyecto nuevo o seleccione una carpeta vacía donde montar el
  seguimiento de comunicaciones.
---

# MORSE · Nueva obra

Inicializa la estructura Morse en la carpeta seleccionada por el jefe. Una vez ejecutada, las skills `registro` y `consulta` pueden trabajar sobre ella sin más.

La carpeta raíz la elige el jefe al seleccionarla en Cowork. Esta skill no decide ubicación: trabaja siempre sobre la carpeta activa.

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

## 1. Verificaciones previas

**Paso 1 — Comprobar que la carpeta no tiene ya estructura Morse**
Si existe cualquiera de estos elementos, abortar y avisar al jefe:
- `COMUNICACIONES.xlsx`
- `Comunicaciones/`
- `Documentacion/`

No sobreescribir nunca. Si el jefe confirma que quiere reinicializar, pedirle que mueva o borre lo existente antes de continuar.

**Paso 2 — Si la carpeta tiene otros archivos (no Morse)**
Listarlos brevemente y preguntar si está bien crear la estructura conviviendo con ellos.

---

## 2. Crear estructura de carpetas

Crear en la raíz:
- `Comunicaciones/`
- `Documentacion/`

---

## 3. Formulario guiado para `RESUMEN.txt`

`RESUMEN.txt` es el archivo de contexto que las skills `registro` y `consulta` leen al arrancar. Su calidad determina lo bien que el sistema asigna temas, detecta riesgo contractual y redacta respuestas.

**Regla fundamental: siempre usar `AskUserQuestion` para recoger los datos. Nunca preguntar de forma conversacional libre.**

---

### Llamada 1 — Identificación de la obra *(imprescindible)*

Lanzar `AskUserQuestion` con estas 4 preguntas simultáneas:

1. `"¿Nombre del proyecto?"` — opciones: `["Rehabilitación de edificio", "Reforma de vivienda", "Construcción de obra nueva"]` + Other para escribir el nombre real.
2. `"¿Dirección de la obra?"` — opciones: `["Calle...", "Avenida...", "Plaza..."]` + Other para escribir la dirección real.
3. `"¿Código interno del proyecto?"` — opciones: `["Sin código interno", "Asignar ahora"]` + Other para escribir el código.
4. `"¿Abreviatura corta para IDs? (ej: FUEN, GRAN, MAD)"` — opciones: `["Sin abreviatura", "Usar las 4 primeras letras del nombre"]` + Other para escribir la abreviatura.

---

### Llamada 2 — ¿Añadir más datos ahora?

Lanzar `AskUserQuestion` con una pregunta:

`"¿Quieres completar más datos del proyecto ahora?"` — opciones:
- `"Sí, añadir partes, contrato e interlocutores"` — descripción: "Recomendado. Cuanto más contexto, mejor trabajan registro y consulta."
- `"Solo lo básico por ahora"` — descripción: "Puedes completar el RESUMEN.txt más adelante."

Si elige **solo lo básico**, saltar al paso de escritura del archivo.

---

### Llamada 3 — Partes implicadas y contrato *(si el jefe quiere continuar)*

Lanzar `AskUserQuestion` con hasta 4 preguntas:

1. `"¿Promotor o cliente?"` — opciones: `["Comunidad de propietarios", "Promotora privada", "Administración pública"]` + Other.
2. `"¿Dirección Facultativa (DF)?"` — opciones: `["Arquitecto externo", "Arquitecto técnico", "Sin DF definida"]` + Other para escribir nombre y estudio.
3. `"¿Fecha de inicio y fin prevista?"` — opciones: `["Ya comenzada", "Pendiente de acta de inicio"]` + Other para escribir las fechas.
4. `"¿Penalización por retraso?"` — opciones: `["Sin penalización", "A definir en contrato"]` + Other para escribir importe y condiciones.

---

### Llamada 4 — Interlocutores y estilo *(si el jefe quiere continuar)*

Lanzar `AskUserQuestion` con hasta 3 preguntas:

1. `"¿Persona de contacto principal en la DF?"` — opciones: `["No definida aún"]` + Other para escribir nombre, rol y abreviatura.
2. `"¿Persona de contacto principal en el promotor?"` — opciones: `["No definida aún"]` + Other para escribir nombre, rol y abreviatura.
3. `"¿Estilo de redacción por defecto?"` — opciones: `["Formal", "Técnico", "Cordial"]`.

---

**Normas generales**
- No inventar datos. Si el jefe no sabe algo, usar `[pendiente]`.
- El jefe puede saltar cualquier llamada. Solo la Llamada 1 es imprescindible.
- Si el jefe escribe datos adicionales fuera del formulario (en el chat), incorporarlos al RESUMEN.txt igualmente.

**Escritura del archivo**
Una vez el jefe cierre el formulario, escribir `Documentacion/RESUMEN.txt` con un bloque por sección. Estructura sugerida:

```
# [Nombre del proyecto]

## Identificación
...

## Partes implicadas
...

## Contrato
...

## Planning
...

## Interlocutores habituales
...

## Instrucciones del jefe
...

## Notas
...
```

Bloques omitidos pueden marcarse como `[pendiente]` o no incluirse, según prefiera el jefe.

---

## 4. Crear `COMUNICACIONES.xlsx`

**No regenerar el Excel por código.** La plantilla `references/COMUNICACIONES_template.xlsx` preserva la tabla `TablaComunicaciones`, su estilo (`TableStyleMedium2`), la validación de la columna Estado, los anchos de columna, el freeze pane y la fila de ejemplo `00_…` que sirve de guía visual y no interfiere con la numeración correlativa.

**Pasos:**
1. Copiar `references/COMUNICACIONES_template.xlsx` a la raíz del proyecto como `COMUNICACIONES.xlsx`.
2. Abrir el archivo recién copiado con `load_workbook()` y escribir en `A1` el nombre del proyecto recogido en el Bloque 1.
3. Guardar con `wb.save()`. No es necesario el patrón de parcheo de tabla de `registro/references/escritura-excel.md` porque no estamos añadiendo filas; solo modificando una celda existente.

---

## 5. Cierre

Resumir al jefe lo que se ha creado:
- Ruta de `COMUNICACIONES.xlsx`
- Ruta de `Documentacion/RESUMEN.txt`
- Carpetas `Comunicaciones/` y `Documentacion/`

Indicar que ya puede:
- Empezar a archivar comunicaciones con la skill `registro`.
- Hacer consultas con la skill `consulta`.

Si algún bloque del `RESUMEN.txt` quedó como `[pendiente]`, recordárselo brevemente para que pueda completarlo cuando tenga los datos.
