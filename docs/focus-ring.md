# Focus ring del panel

Implementado en `app/globals.css` con Tailwind v4, mediante una única utilidad
`@utility focus-ring`. Se aplica automáticamente a inputs, textareas, selects,
botones, enlaces con destino, summaries, elementos editables, elementos con
`tabIndex` y elementos con `role="button"`, incluidos los controles de modales.

- Borde: mezcla del azul principal `#024796` al 50% con blanco (`#81a3cb`).
- Anillo: `0 0 0 0.25rem rgba(2, 71, 150, 0.25)`.
- Transición: `border-color .15s ease-in-out, box-shadow .15s ease-in-out`.
- Activación: `:focus-visible`; outline eliminado, radio del elemento conservado.
- Los anillos Tailwind anteriores se neutralizan de forma centralizada para que
  no añadan otro anillo al hacer clic; las sombras normales se conservan.

Se conserva la heurística nativa de `:focus-visible`: el navegador también puede
mostrar el foco en campos de escritura al hacer clic, porque requieren teclado.

## Ejemplos de uso explícito

La clase es opcional en estos controles, porque la aplicación global ya los cubre.

```tsx
<input
  type="text"
  aria-label="Buscar"
  className="focus-ring rounded-button border border-qms-border px-3 py-2"
/>

<button
  type="button"
  className="focus-ring rounded-button border border-qms-border px-4 py-2"
>
  Buscar
</button>
```

## Fragmento equivalente para tailwind.config.js

Este fragmento es para proyectos con configuración de plugins de Tailwind v3.
El panel utiliza la implementación CSS de Tailwind v4 en `app/globals.css`.

```js
module.exports = {
  theme: {
    extend: {
      colors: {
        'qms-focus-border': '#81a3cb',
        'qms-focus-ring': 'rgba(2, 71, 150, 0.25)',
      },
    },
  },
  plugins: [
    function ({ addUtilities }) {
      addUtilities({
        '.focus-ring': {
          transition: 'border-color .15s ease-in-out, box-shadow .15s ease-in-out',
        },
        '.focus-ring:focus-visible': {
          outline: '0',
          borderColor: '#81a3cb',
          boxShadow: '0 0 0 0.25rem rgba(2, 71, 150, 0.25)',
        },
      })
    },
  ],
}
```
