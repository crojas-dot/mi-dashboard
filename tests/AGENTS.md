# Pruebas

- Leer primero `../AGENTS.md` y el mapa `../docs/arquitectura/verificacion-y-pendientes.md`.
- Suites Node usan `node:test`; `load-module.mjs` permite probar módulos reales con dobles locales. Preferir fixtures sintéticos deterministas.
- Probar comportamiento observable y límites importantes; no afirmar que un archivo funciona solo por buscar texto o imports.
- Auth/API: probar identidad/token/permisos inválidos y que el rechazo ocurra antes de efectos privilegiados. Nunca llamar producción ni usar secretos reales.
- Elegir la suite más pequeña que cubra el cambio; ampliar a TypeScript, lint, build o suite global según riesgo.
- No borrar, saltar o debilitar una prueba para ocultar regresiones; comparar fallos globales con su baseline documentado.
