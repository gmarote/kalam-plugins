# MORSE · Plugin de Gestión de Comunicaciones de Obra

MORSE centraliza el registro, archivo y seguimiento de todas las comunicaciones de un proyecto de construcción.

## Skills disponibles

- **nueva-obra** — inicializa un proyecto desde cero: crea las carpetas, genera el `RESUMEN.txt` mediante una conversación guiada, monta el `COMUNICACIONES.xlsx` a partir de la plantilla canónica y crea el `TEMAS.txt` vacío
- **registro** — archiva comunicaciones entrantes y salientes; lee `TEMAS.txt` para asignar el tema (o **General** si la comunicación afecta a varios hilos), actualiza `TEMAS.txt` si abre un tema nuevo o aporta un matiz relevante, y al terminar llama automáticamente a `resumen`
- **resumen** — análisis en profundidad de un tema: cronología narrativa, detección de riesgos contractuales e inactividad y propuesta de acción; si la acción es redactar una respuesta, la valida con el jefe y llama a `registro` para archivarla como comunicación OUT
- **consulta** — búsquedas transversales sobre el registro: estado general del proyecto, comunicaciones por remitente, estado, fecha o palabras clave; carga solo las columnas necesarias según el tipo de búsqueda
- **alertas** — muestra todos los hilos pendientes agrupados por tema: pendientes de responder, pendientes por parte del cliente, pendientes transversales (comunicaciones de General que afectan a varios hilos) y temas críticos (marcados `CRÍTICO` en TEMAS.txt aunque no tengan comunicaciones pendientes)

## Estructura de proyecto

Cada obra vive en su propia carpeta con esta estructura, que `nueva-obra` crea automáticamente:

```
Mi Obra/
├── COMUNICACIONES.xlsx    ← base de datos de comunicaciones
├── Comunicaciones/        ← archivos de todas las comunicaciones
└── Documentacion/
    ├── RESUMEN.txt        ← contexto del proyecto
    └── TEMAS.txt          ← catálogo de temas, gestionado por registro
```

## RESUMEN.txt — qué contiene

`nueva-obra` lo construye conversando con el jefe de obra. Cubre:

- Datos de la obra (nombre, dirección, referencia, fechas, importe)
- Interlocutores (jefe de obra, cliente, dirección facultativa, etc.)
- Cláusulas clave del contrato (penalizaciones, plazos, condiciones)
- Hitos del proyecto
- Instrucciones específicas para Claude (tono por interlocutor, alertas, etc.)

## Cómo usar

1. Instala el plugin en Cowork
2. Apunta Cowork a la carpeta de tu obra
   - **Obra nueva** (carpeta vacía): lanza `nueva-obra` para montar la estructura
   - **Obra ya inicializada**: comparte una comunicación para archivarla, o pregunta por el estado del proyecto
3. Cuando quieras ver qué tienes pendiente, lanza `alertas`
