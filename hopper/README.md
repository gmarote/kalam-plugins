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
trazabilidad (archivo, hoja, fila de origen), jerarquía con nombre (capítulo,
subcapítulo, sección y ruta completa), código, una columna principal con el
**nombre de la partida**, y columnas de **detalle**, **unidad**, **medición**,
**precio unitario** e **importe**.

## Dos líneas: la app (producto) y el plugin (laboratorio)

Hopper se desarrolla en dos piezas complementarias:

- **`app/` — el producto.** Una aplicación **HTML autónoma** (sin IA y sin
  servidor) que el cliente abre en su navegador, suelta sus Excel y obtiene la
  tabla normalizada. Es el **objetivo final**. Su motor, **`app/normalizar.core.js`,
  es la fuente de verdad** de la lógica de normalización.
- **`skills/normalizar/` — el plugin (laboratorio + especificación).** El agente
  conversacional de Claude. Aquí viven las **reglas en lenguaje neutro**
  (`references/`, el contrato) donde se razona y valida, y un extractor de
  referencia (`assets/extraer.py`). No es el entregable, pero es donde se diseñan
  las reglas y la vía de **escalado con IA** para las maquetas irregulares que la
  app marque como dudosas.

Las reglas (`references/`) son **independientes del lenguaje** y valen para ambas.
`extraer.py` (Python) queda como **oráculo de validación**; la lógica que se
publica vive en `app/normalizar.core.js` (JS).

## Cómo funciona (plugin)

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
├── app/                                  PRODUCTO — app HTML autónoma (sin IA)
│   ├── hopper_normalizador.html          la app (SheetJS + motor + UI), todo dentro
│   ├── normalizar.core.js                el motor de reglas (FUENTE DE VERDAD)
│   ├── banco-pruebas.js                  arnés headless para validar con muchos ficheros
│   └── README.md
└── skills/                               LABORATORIO — plugin de Claude (IA)
    └── normalizar/
        ├── SKILL.md                      guion conversacional del agente (7 fases)
        ├── references/                   reglas en lenguaje neutro (contrato compartido)
        │   ├── esquema-salida.md         esquema canónico de salida
        │   └── familias-de-formato.md    familias + reglas universales de clasificación
        └── assets/
            └── extraer.py                extractor de referencia (oráculo de validación)
```

## La skill

- **`normalizar`** — Excel de mediciones de formato libre → tabla estructurada
  de una sola hoja.

## Validación

El diseño está validado sobre **varios ficheros reales de estudios distintos**
(Rossio, Palácio Mendia, Ferragial ARQ/ESP, Calçada da Memória): la mayoría caen
en la familia *código* (jerarquía por código `1.1.2.1` / `E.1`) y otros en
*formato* (una pestaña por capítulo, jerarquía por mayúsculas, parciales sin
código e importe por zonas). De ahí salen las **reglas universales** de
clasificación de `references/familias-de-formato.md` (el discriminante siempre es
"¿tiene unidad y medición?"). Todos producen el mismo esquema de salida.

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
