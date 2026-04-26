# MORSE · Plugin de Gestión de Comunicaciones de Obra

MORSE centraliza el registro, archivo y seguimiento de todas las comunicaciones de un proyecto de construcción.

## Skills disponibles

- **nueva-obra** — inicializa un proyecto desde cero: crea las carpetas, genera el `RESUMEN.txt` mediante una conversación guiada y monta el `COMUNICACIONES.xlsx` a partir de la plantilla canónica
- **registro** — archiva comunicaciones entrantes y salientes, redacta respuestas y actualiza el Excel
- **consulta** — consulta el estado del proyecto, busca comunicaciones y resume hilos sin modificar nada
- **alertas** — genera el panel de alertas del proyecto en el sidebar de Cowork: plazos vencidos, acciones urgentes y todos los hilos pendientes agrupados por tema

## Estructura de proyecto

Cada obra vive en su propia carpeta con esta estructura, que `nueva-obra` crea automáticamente:

```
Mi Obra/
├── COMUNICACIONES.xlsx    ← base de datos de comunicaciones
├── Comunicaciones/        ← archivos de todas las comunicaciones
└── Documentacion/
    └── RESUMEN.txt        ← contexto del proyecto
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
3. Cuando quieras ver el panel de alertas, lanza `alertas` — el panel queda en el sidebar y puedes recargarlo cuando quieras
