---
name: alertas
description: >
  Muestra el panel de alertas activas del proyecto: plazos vencidos,
  acciones inmediatas y todos los hilos pendientes agrupados por tema.
  Úsala cuando el jefe quiera ver el estado de alerta del proyecto,
  pregunte por lo que tiene pendiente, o quiera un resumen de comunicaciones.
---

# MORSE · Alertas del proyecto

Analiza las comunicaciones del proyecto y muestra el estado de alertas directamente en el chat, con formato visual claro.

---

## 1. Lectura de datos

**Lee `Documentacion/RESUMEN.txt`** para obtener contexto del proyecto (nombre, interlocutores, plazos contractuales). Si no existe, continúa solo con el Excel.

**Lee `COMUNICACIONES.xlsx`** completo. Carga todas las filas excluyendo la de ejemplo (`00_…`).

---

## 2. Detectar alertas

Revisa todas las filas con `Estado = "Pendiente respuesta"` y clasifícalas:

**Tipo `vencido`** — el plazo ha expirado:
- El campo `Plazo respuesta` contiene una fecha explícita (`antes del DD/MM`, `DD/MM/YYYY`, etc.) que ya ha pasado.
- O el campo indica un número de días hábiles desde la `Fecha` de la comunicación, y ese plazo ya ha vencido.

**Tipo `inmediata`** — requiere acción urgente sin fecha concreta:
- El campo `Plazo respuesta` dice `"Inmediato"`, `"Urgente"` o equivalente.
- O el `Resumen` describe una paralización de obra, un requerimiento de Cultura/administración, o una situación de riesgo que no admite demora.

Usa tu criterio contextual: una comunicación de enero con plazo de 5 días hábiles que sigue "Pendiente respuesta" en abril es claramente vencida aunque no tenga fecha explícita.

---

## 3. Agrupar por tema

Para cada tema que aparezca en el Excel:

1. Reúne todas sus comunicaciones.
2. **Estado del tema** = el estado más urgente entre sus filas:
   `Pendiente respuesta` > `Pendiente cliente` > `Registrada` > `Cerrada`
3. **Incluir solo** temas con estado `Pendiente respuesta` o `Pendiente cliente`.
4. **Resumen del tema** = resumen de la comunicación más reciente con estado pendiente en ese tema. Una frase concisa que describa el estado actual del hilo.
5. **last_date** = fecha de la comunicación más reciente del tema (formato `DD/MM`).
6. **last_actor** = si la última comunicación es `IN`, escribir `IN de [abreviatura]`. Si es `OUT`, escribir `OUT del JO`.
7. **urgent** = `true` si alguna comunicación del tema aparece en la lista de alertas del paso 2.

**Ordenar los temas:** primero los `urgent`, luego los de `Pendiente respuesta`, luego los de `Pendiente cliente`.

---

## 4. Responder en el chat

Escribe la respuesta en el chat con este formato:

```
## [Nombre del proyecto] · Alertas

[Si hay alertas activas — una línea por alerta:]
🔴 **Vencido · DD/MM** — Nombre del tema: descripción breve de la situación.
🟡 **Acción inmediata** — Nombre del tema: descripción breve de la situación.

[Si no hay alertas:]
✅ Sin alertas activas — todo dentro de plazo.

**Pendiente respuesta:** N · **Pendiente cliente:** M

---
**Hilos pendientes · N**

[Una entrada por tema, ordenada según paso 3:]

🔴 **Nombre del tema** `PR` · N com. · IN de DF · DD/MM
Frase resumen del estado actual del hilo.

**Nombre del tema** `PR` · N com. · OUT del JO · DD/MM
Frase resumen del estado actual del hilo.

🟡 **Nombre del tema** `PC` · N com. · OUT del JO · DD/MM
Frase resumen del estado actual del hilo.

[Si no hay hilos pendientes:]
Sin hilos pendientes.
```

**Iconos de tema:**
- `🔴` si `urgent = true` (el tema tiene alguna alerta activa)
- Sin icono si `status = "Pendiente respuesta"` y no urgente
- `🟡` si `status = "Pendiente cliente"`

**Badge de estado:** `PR` para Pendiente respuesta, `PC` para Pendiente cliente.
