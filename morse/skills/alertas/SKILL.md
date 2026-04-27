---
name: alertas
description: >
  Muestra el estado de las comunicaciones abiertas del proyecto: hilos pendientes
  de respuesta propia y pendientes por parte del cliente, agrupados por tema.
  Úsala cuando el jefe quiera ver qué comunicaciones están abiertas o qué tiene pendiente.
---

# MORSE · Comunicaciones abiertas

Revisa las comunicaciones pendientes y presenta un resumen claro de los hilos abiertos.

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

---

## 2. Agrupar por tema

Separar primero los registros con `Tema` = **"Tema General"** del resto. Estos son comunicaciones transversales que afectan a varios temas y se presentan en su propia sección.

Para cada valor de `Tema` (excluido "Tema General") que aparezca entre las filas filtradas:

1. Reúne todas sus filas pendientes.
2. Redacta una frase que describa el estado actual del hilo: qué se está esperando, quién debe actuar y, si hay una fecha relevante, cuándo.

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

[Párrafo de recomendación: qué acciones concretas se deben priorizar, en qué orden y por qué.]
```

Si no hay hilos en alguna de las categorías, indica "Sin comunicaciones pendientes en esta categoría." en su lugar.
