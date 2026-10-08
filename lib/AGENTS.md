# Lógica compartida

- Leer primero `../AGENTS.md` y consultar el mapa `../docs/arquitectura/README.md`.
- `constants/`: vocabularios y metadatos compartidos. `queries/`: lecturas, query keys y caché. `services/`: operaciones/mutaciones. `server/`: autorización y dependencias privilegiadas. `utils/`: transformaciones puras.
- Mantener una fuente canónica por vocabulario o regla visible; las etiquetas no son autorización. Los permisos efectivos siguen en guards, API y DB.
- No convertir nombres visibles en claves persistidas ni duplicar listas de IDs. Antes de cambiar claves de ruta/estado/dominio, rastrea quién produce/consume el valor y conserva los nombres históricos cuando DB/API los requieran.
- Centralizar un diccionario cuando varias capas comparten el mismo contrato; mantener separados catálogos que parecen similares pero tienen distintos alcances de autorización o negocio.
- Las query keys y opciones de caché pertenecen a `queries/`; compartirlas entre página, invalidación y precarga. Pasar solo `context.signal` al transporte.
- Los módulos `server/` deben seguir siendo server-only cuando manejan service role o secretos. Nunca importarlos desde componentes cliente.
- No convertir `store/` en caché remota ni duplicar estado de TanStack Query en Zustand.
- Comentar invariantes de seguridad, concurrencia, fechas y compatibilidad; evitar comentarios que repitan la implementación.
- Probar el contrato de la función/hook con fixtures sintéticos; no usar credenciales, datos privados ni DB real.
