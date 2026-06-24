# Reglas del motor (scraping), en orden de aplicación

Las reglas que aplica `normalizar.core.js`, de lo primero a lo último.
Resumen esquemático; el detalle de las capas está en `capas-y-correccion.md`.

## Capa 0 · ¿Es un MQT?
1. Si no hay suficientes filas con número + unidad → **no es un MQT**: aviso y no doy fiabilidad.

## Capa 1 · Leer y volcar
2. Localizo la **fila de cabecera** (la que más suena a código/desc/unidad/cantidad).
3. **Descripción** = la columna con el texto más largo.
4. **Unidad** = la columna con más `m, m2, vg, un…`.
5. **Código** = está a la **izquierda** de la descripción.
6. **Cantidad** = está a la **derecha** de la descripción.
7. **Precio/importe**: lo detecto pero **no lo guardo** (un MQT mide, no presupuesta).
8. Códigos con puntos (`1.1.1`) → familia *código*; códigos cortos (`A`, `A1`, `B2`) → familia *formato*.
9. Si el código viene **partido en dos columnas** → los junto. Vale tanto con
   prefijo de **letra** (Bloco `A.` + `1.1`) como con una **columna-sección
   numérica** (`SECÇÃO` `1.`, `2.`… + artículo), donde el nombre del capítulo está
   en la fila con el artículo vacío.
10. **¿Es partida?** → la fila tiene **unidad y cantidad**.
11. Fila con código pero **sin cantidad** = **título** (capítulo/subcapítulo).
12. Partida **sin unidad propia** → **hereda** la unidad del título de arriba.
13. Números en **formato portugués** (coma decimal, punto de millares) los leo bien.
14. En familia *formato*, el **capítulo es el nombre de la pestaña**.
15. **Un rótulo de documento** en la columna de código (`MAPA DE QUANTIDADES`,
    `MQT`, `Resumo`…) **no es capítulo**: lo ignoro (no meto un nivel falso).
16. **Capítulos por LETRA** (`A`, `B`, `C`…, ≥3 distintas) con números que
    reinician debajo (`1`, `2`…) → los números **cuelgan bajo la letra** (la letra
    es el capítulo; el número, subcapítulo). Una letra suelta no es esquema.
17. **Nombre de hoja = disciplina** (`ARQUITECTURA`, `AVAC`, `ÁGUAS`…) en familia
    *código* → esa disciplina es el **capítulo**; los títulos internos bajan un
    nivel (lo profundo se conserva en la `ruta`). No actúa si ya es el capítulo.

## Capa 2 · Revisar y poner nota de confianza
18. **Capítulo vacío con subcapítulo lleno** = jerarquía rota → baja la confianza.
19. Misma descripción repetida en muchas filas = **título colado** → sospecha.
20. Cuento aparte cuántas filas "parecen" medición; si saqué **muchas menos** → posible pérdida.
21. **Unidades raras** o **cantidades a 0** → aviso proporcional.

## Capa 3 · Corregir, solo si mejora
22. **Cabecera escondida** por formato (`ARQ 1.`, `1.`, espacios) → la normalizo.
23. **Nivel constante** inútil (todo cuelga de `A.`) → lo quito.
24. **Cero final** de cabecera (`1.0`, `1.1.0`) → lo quito.
25. Me quedo con la receta **solo si sube la confianza** (nunca empeora).
26. **Regla universal**: el capítulo nunca queda vacío → lo relleno desde la ruta.

## Jerarquía (revisión humana, sobre la tabla ya montada)
27. Al reasignar niveles, la **`ruta` conserva TODOS los niveles**, incluidos los
    que quedan **por debajo de sección** (no tienen columna propia pero no se
    pierden: van al migajero).

## Limpieza final
28. **Hoja duplicada** de otra mayor (≥80% igual) → la descarto.
29. **Hoja sin mediciones** reales (índice, portada) → la descarto.
30. **Hoja-resumen** (importes sin unidades) → la descarto.
31. **Archivo duplicado** de otro (≥80% igual) → lo descarto.

## Validación (test de regresión)
32. **Oráculo de capítulo**: `ARQUITECTURA`/`ARQUITETURA` es casi siempre un
    capítulo. El test comprueba que, donde aparece como título, cae en la columna
    `capitulo`; si no, avisa (red de seguridad contra regresiones de jerarquía).
