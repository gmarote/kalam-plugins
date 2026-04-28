---
name: alertas
description: >
  Muestra el estado de las comunicaciones abiertas del proyecto: hilos pendientes
  de respuesta propia y pendientes por parte del cliente, agrupados por tema.
  También detecta temas marcados como críticos en TEMAS.txt aunque no tengan
  comunicaciones pendientes. Úsala cuando el jefe quiera ver qué tiene abierto
  o qué necesita atención urgente.
---

# MORSE · Comunicaciones abiertas

Revisa las comunicaciones pendientes y los temas críticos activos, y presenta un resumen claro de todo lo que requiere atención.

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

## 1. Lectura de datos

**Lee `COMUNICACIONES.xlsx`** completo. Filtra las filas cuyo campo `Estado` sea `"Pendiente respuesta"` o `"Pendiente cliente"`. Lee cada una de esas filas entera para entender el contexto del hilo.

**Lee `Documentacion/TEMAS.txt`** e identifica los bloques que contienen la línea `CRÍTICO`. Estos temas requieren seguimiento activo independientemente de su estado en el Excel. Para cada uno de estos temas, localiza en el Excel su comunicación más reciente (cualquier estado) para mostrar la fecha y el estado de la última actividad.

---

## 2. Agrupar por tema

Separar primero los registros con `Tema` = **"General"** del resto. Estos son comunicaciones transversales que afectan a varios temas y se presentan en su propia sección.

Para cada valor de `Tema` (excluido "General") que aparezca entre las filas filtradas:

1. Reúne todas sus filas pendientes.
2. Redacta una frase que describa el estado actual del hilo: qué se está esperando, quién debe actuar y, si hay una fecha relevante, cuándo.

Para los temas marcados `CRÍTICO` en TEMAS.txt que **no** aparezcan entre las filas pendientes, prepara un apunte con la descripción del bloque en TEMAS.txt y la fecha y estado de su última comunicación en el Excel.

---

## 3. Responder en el chat

Escribe la respuesta con este formato:

```
Hay N comunicaciones abiertas: X pendientes de respuesta por nuestra parte y Y en espera de respuesta del cliente.

---

**Pendientes de responder**

- **Nombre del tema:** descripción del estado del hilo.
- **Nombre del tema:** descripción del estado del hilo.

---

**Pendientes por parte del cliente**

- **Nombre del tema:** descripción del estado del hilo.
- **Nombre del tema:** descripción del estado del hilo.

---

**Pendientes transversales** *(afectan a varios temas)*

- descripción del estado de la comunicación transversal.

---

**Temas críticos** *(marcados CRÍTICO en TEMAS.txt — seguimiento activo)*

- **Nombre del tema:** descripción del riesgo o situación. Última comunicación: [fecha] — [estado].

---

[Párrafo de recomendación: qué acciones concretas se deben priorizar, en qué orden y por qué. Integrar tanto las pendientes como los temas críticos en la priorización.]
```

Si no hay hilos en alguna de las categorías, indica "Sin comunicaciones pendientes en esta categoría." o "Sin temas críticos en seguimiento." según corresponda. La sección **Temas críticos** solo aparece si hay al menos un bloque `CRÍTICO` en TEMAS.txt; si ese bloque ya aparece en las secciones de pendientes (porque también tiene comunicaciones abiertas), incluirlo igualmente aquí para dejar claro que su criticidad va más allá del estado puntual de la comunicación.
