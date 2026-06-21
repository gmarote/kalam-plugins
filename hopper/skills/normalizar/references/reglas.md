# Reglas del motor (scraping), en orden de aplicación

Las 27 reglas que aplica `normalizar.core.js`, de lo primero a lo último.
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
9. Si el código viene **partido en dos columnas** (`A.` + `1.1`, tipo Bloco) → los junto.
10. **¿Es partida?** → la fila tiene **unidad y cantidad**.
11. Fila con código pero **sin cantidad** = **título** (capítulo/subcapítulo).
12. Partida **sin unidad propia** → **hereda** la unidad del título de arriba.
13. Números en **formato portugués** (coma decimal, punto de millares) los leo bien.
14. En familia *formato*, el **capítulo es el nombre de la pestaña**.

## Capa 2 · Revisar y poner nota de confianza
15. **Capítulo vacío con subcapítulo lleno** = jerarquía rota → baja la confianza.
16. Misma descripción repetida en muchas filas = **título colado** → sospecha.
17. Cuento aparte cuántas filas "parecen" medición; si saqué **muchas menos** → posible pérdida.
18. **Unidades raras** o **cantidades a 0** → aviso proporcional.

## Capa 3 · Corregir, solo si mejora
19. **Cabecera escondida** por formato (`ARQ 1.`, `1.`, espacios) → la normalizo.
20. **Nivel constante** inútil (todo cuelga de `A.`) → lo quito.
21. **Cero final** de cabecera (`1.0`, `1.1.0`) → lo quito.
22. Me quedo con la receta **solo si sube la confianza** (nunca empeora).
23. **Regla universal**: el capítulo nunca queda vacío → lo relleno desde la ruta.

## Limpieza final
24. **Hoja duplicada** de otra mayor (≥80% igual) → la descarto.
25. **Hoja sin mediciones** reales (índice, portada) → la descarto.
26. **Hoja-resumen** (importes sin unidades) → la descarto.
27. **Archivo duplicado** de otro (≥80% igual) → lo descarto.
