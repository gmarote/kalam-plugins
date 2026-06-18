# Hopper

> Traduce el Excel de mediciones de cualquier arquitecto a una tabla
> estructurada estándar.

Plugin de Claude para la consultoría de Gerardo, pensado para el marketplace
**kalam-plugins** (junto a `morse`). Resuelve el cuello de botella de la filial
portuguesa de un cliente de construcción/rehabilitación: los arquitectos envían
las mediciones (*Mapa de Quantidades*, MQT) en Excel de formato libre — decenas
de pestañas, una por capítulo, cada una con su maquetación, códigos y parciales
— y gestionarlas a mano es inviable.

Hopper convierte cualquiera de esos Excel en **una sola tabla estructurada**:
columnas de identificación (capítulo, subcapítulo, código), una principal con el
**nombre de la unidad de obra**, y columnas de **unidad de medida**, **medición**
y **precio unitario**.

## Cómo funciona

Es un agente conversacional (no un parser rígido). Inspecciona el Excel, deduce
su **familia de formato**, propone el mapeo de columnas y la clasificación de
filas, y **lo acuerda con el usuario** antes de procesar. Luego un **script
determinista** (`assets/extraer.py`) extrae las cifras celda a celda — la IA
nunca transcribe mediciones ni precios a mano.

Lo acordado con cada estudio se guarda como **perfil reutilizable**: la
siguiente medición de ese mismo arquitecto entra casi sola.

## Estructura

```
hopper/
├── .claude-plugin/plugin.json
└── skills/
    └── normalizar/
        ├── SKILL.md                       guion conversacional del agente (7 fases)
        ├── references/
        │   ├── esquema-salida.md          esquema canónico de salida (contrato)
        │   └── familias-de-formato.md     familias de formato + recetas de clasificación
        └── assets/
            └── extraer.py                  extractor determinista (familias código/formato)
```

## La skill

- **`normalizar`** — Excel de mediciones de formato libre → tabla estructurada
  de una sola hoja.

## Validación

El diseño está validado sobre **5 ficheros reales de 4 estudios distintos**:
4 caen en la familia *código* (jerarquía por código `1.1.2.1` / `E.1`) y 1 en la
familia *formato* (una pestaña por capítulo, jerarquía por mayúsculas y
parciales sin código). Todos producen el mismo esquema de salida.

## Alta en el marketplace

Para incorporarlo a `kalam-plugins`, copiar esta carpeta `hopper/` a la raíz del
repo y añadir su entrada en `.claude-plugin/marketplace.json`:

```json
{
  "name": "hopper",
  "description": "Traduce el Excel de mediciones de cualquier arquitecto a una tabla estructurada estándar.",
  "source": "./hopper"
}
```

## Requisitos

`python3` con `pandas`, `openpyxl` (lectura/escritura `.xlsx`) y `xlrd`
(lectura `.xls`).
