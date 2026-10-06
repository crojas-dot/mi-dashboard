'use client'

import { useState, type ReactNode } from 'react'

/**
 * Aplaza SOLO el montaje, no la descarga. Importar el modal/panel estáticamente
 * desde su página: el código estará listo cuando aparezca el botón de apertura.
 * Después mantiene el componente montado: el hijo sigue recibiendo open=false
 * (o queja=null) y conserva sus borradores, pestañas y animación de cierre.
 * No envolver con `{active && ...}`: eso desmontaría el formulario al cerrarlo.
 */
export default function DeferredMount({ active, children }: { active: boolean; children: ReactNode }) {
  const [activated, setActivated] = useState(active)

  // Ajuste del estado propio, condicionado y de una sola vez. Hacerlo durante
  // este render evita añadir un frame vacío al primer clic mediante un efecto.
  if (active && !activated) setActivated(true)

  // No usar next/dynamic aquí: volvería a introducir una espera en el clic.
  // Las librerías opcionales pesadas deben tener su propia frontera de carga.
  return active || activated ? children : null
}
