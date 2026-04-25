---
name: morse
description: >
  Sistema MORSE de gestión de comunicaciones de obra. Activar cuando el usuario
  quiera registrar, archivar o gestionar comunicaciones de un proyecto de
  construcción. Triggers: el usuario comparte un email, documento o imagen de
  obra para archivar; menciona COMUNICACIONES_REGISTRO.xlsx; dice "registra
  esta comunicación", "archiva este email", "nueva comunicación de obra", o
  cualquier variante de archivar o registrar una comunicación de proyecto.
---

# MORSE · Sistema de Gestión de Comunicaciones de Obra

MORSE centraliza el registro, archivo y seguimiento de todas las comunicaciones de un proyecto de construcción en una estructura de carpetas estándar, con un archivo excel de seguimiento.

**Estructura de carpetas del proyecto:**
- `COMUNICACIONES_REGISTRO.xlsx` — base de datos de todas las comunicaciones
- `Comunicaciones/` — archivos de todas las comunicaciones, entrantes y salientes
- `Documentacion/` — documentos de referencia (contratos, planning, etc.)

Todo el contexto específico del proyecto está en `Documentacion/RESUMEN.txt`. Léelo al arrancar y úsalo como referencia para cualquier decisión de fondo. No inventes datos que no estén ahí.

---

## 1. Comprobaciones de inicio

**Paso 1 — Lee `Documentacion/RESUMEN.txt`**
Contiene el contexto de la obra e instrucciones específicas del jefe. Sin ese archivo, avisa de que falta y no proceses nada.

**Paso 2 — Verifica el lock file del Excel**
Comprueba programáticamente si existe `~$COMUNICACIONES_REGISTRO.xlsx` en la carpeta. Si existe, intenta abrir el archivo como verificación secundaria (puede ser caché residual):
- Si el archivo **no se puede abrir** → Excel está abierto. Avisa al jefe y no continúes hasta que el lock desaparezca.
- Si el archivo **sí se puede abrir** → lock residual, puedes continuar.

**Paso 3 — Lee el Excel**
Abre `COMUNICACIONES_REGISTRO.xlsx` y revisa la hoja **Comunicaciones** para:
- Saber cuál es el último ID registrado.
- Extraer los temas existentes (columna Tema) y repasar los resúmenes (columna Resumen) para construir una imagen del estado actual de la obra: qué hilos están abiertos, qué está pendiente, si hay exposición económica o contractual activa. Este contexto es imprescindible para asignar correctamente el tema de cualquier comunicación nueva.

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
- Hilo nuevo: indicar que se ha abierto un tema nuevo y cuál es el primer registro.

**Proponer siguiente paso** y esperar confirmación antes de ejecutar:
- **Redactar respuesta** — sugerir estilo (Formal / Técnico / Cordial) y esperar aprobación. Una vez aprobado, guardar como `.txt` en `Comunicaciones/` con su ID OUT y actualizar el Estado de la comunicación IN relacionada a **Cerrada**.
- **Revisar documentación** — contrastar con contrato, planning u otros documentos en `Documentacion/`.
- **Analizar opciones** — si hay implicación económica o contractual.
- **Solo registrar** — si el jefe no necesita acción inmediata.

Iterar con el jefe hasta cerrar la acción o dejarla aparcada conscientemente.

**Comunicaciones salientes iniciadas por la empresa**
Cuando el jefe necesite escribir sin comunicación previa:
- Asignar ID con dirección OUT y número correlativo
- Registrar en el Excel con Estado **Pendiente cliente**
- Guardar el `.txt` en `Comunicaciones/`
