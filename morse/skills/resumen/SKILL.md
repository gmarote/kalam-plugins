---
name: resumen
description: >
  Resume el historial completo de un tema: cronología narrativa de las
  comunicaciones, estado actual y propuesta de acción. Si no se especifica
  el tema, pregunta al usuario antes de continuar.
---

# MORSE · Resumen de tema

Construye un relato claro del historial de un tema y termina con una valoración y propuesta concreta.

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

## 1. Obtener el tema

Si el usuario no ha especificado un tema, lista los temas únicos presentes en `COMUNICACIONES.xlsx` y pregunta cuál quiere revisar. Espera la respuesta antes de continuar.

---

## 2. Lectura de datos

**Lee `Documentacion/RESUMEN.txt`** para obtener contexto del proyecto: partes, roles, plazos contractuales y condiciones relevantes. Si no existe, continúa sin él.

**Lee `COMUNICACIONES.xlsx`** y filtra todas las filas cuyo campo `Tema` coincida con el solicitado, más todas las filas con `Tema` = **"Tema General"**. Estas últimas se incluyen siempre al analizar cualquier hilo concreto. Ordénalas por `Fecha` de más antigua a más reciente. En la cronología, las filas de Tema General se marcan con `[Transversal]` para distinguirlas visualmente de las del tema específico.

---

## 3. Analizar el hilo

Con las filas del tema, determina:

- **Cronología:** qué se comunicó, en qué orden y quién tomó la iniciativa en cada momento.
- **Estado actual:** cuál es el `Estado` de las comunicaciones más recientes.
- **Inactividad:** cuánto tiempo lleva el hilo sin actividad. Si supera 3 semanas y sigue abierto, es relevante.
- **Contradicciones:** si en distintas comunicaciones hay posiciones, acuerdos o plazos que se contradicen entre sí.
- **Riesgo contractual:** aunque el tema parezca cerrado o inactivo, valora si hay implicaciones contractuales no resueltas (responsabilidades no asignadas, acuerdos verbales sin confirmación escrita, plazos que afectan a garantías o penalizaciones).

---

## 4. Responder en el chat

Escribe la respuesta con este formato:

```
## [Nombre del tema]

[Bullets cronológicos, uno por comunicación o agrupación lógica de comunicaciones cercanas.
Cada bullet es una frase narrativa: qué ocurrió, quién actuó, qué implicó.
Ejemplo: "— El 12/03, la DF solicitó documentación técnica del sistema de ventilación, con plazo de respuesta de 5 días hábiles."]

---

**Estado actual**
[Una o dos frases describiendo la situación a día de hoy.]

---

**Valoración**
[Aquí Claude aplica su criterio según los casos detectados en el paso 3. Puede incluir uno o varios de los siguientes bloques según corresponda:]

⚠️ **Inactividad prolongada**
[Si el hilo lleva más de 3 semanas sin movimiento y sigue abierto: explicar la situación y proponer si se debe retomar o cerrar por inactividad tácita.]

🔴 **Contradicción detectada**
[Si hay posiciones o acuerdos contradictorios: describir exactamente la contradicción, qué comunicaciones están involucradas y qué riesgo genera.]

📋 **Acción pendiente**
[Si hay comunicaciones con Estado "Pendiente respuesta": proponer la acción concreta o redactar un borrador de la respuesta.]

✅ **Propuesta de cierre**
[Si el tema está resuelto de facto pero tiene comunicaciones aún abiertas: proponer cerrarlas con /cierre [Tema] o indicar qué confirmación falta antes de cerrar.]

⚖️ **Riesgo contractual**
[Si el tema tiene implicaciones contractuales no resueltas aunque parezca cerrado: describir el riesgo y sugerir acciones concretas como enviar una comunicación de confirmación, solicitar acuse de recibo, o documentar un acuerdo verbal.]
```

Incluye solo los bloques de valoración que sean relevantes. Si el hilo está limpio y cerrado sin ningún riesgo, indica simplemente: "Sin acciones pendientes ni riesgos detectados."

**Si la acción propuesta es redactar una respuesta:**
Redactar el borrador y mostrarlo al jefe para validar o iterar. Una vez aprobado, invocar la skill `registro` para archivar la comunicación OUT. `registro` se encargará de escribir la fila OUT en el Excel y de actualizar el Estado de la comunicación IN relacionada: a **Pendiente cliente** si se espera confirmación o nueva respuesta del otro lado; a **Cerrada** si la respuesta resuelve el asunto sin acción pendiente en ningún lado.
