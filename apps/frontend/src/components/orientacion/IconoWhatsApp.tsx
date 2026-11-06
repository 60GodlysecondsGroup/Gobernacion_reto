/**
 * Icono de WhatsApp (burbuja de conversación con un auricular), dibujado en SVG con el mismo
 * trazo que los iconos de lucide: lucide no incluye logotipos de marcas y no hace falta otra
 * dependencia. Siempre va junto al texto «WhatsApp», así que es decorativo (`aria-hidden`).
 */
export function IconoWhatsApp({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* Burbuja con la cola abajo a la izquierda. */}
      <path d="M3.6 20.4 4.9 16.6A9 9 0 1 1 7.6 19.2Z" />
      {/* Auricular. */}
      <path d="M9 8.6c0-.5.4-.9.9-.9h.6l.8 1.9-.7.7a5.2 5.2 0 0 0 2.6 2.6l.7-.7 1.9.8v.6c0 .5-.4.9-.9.9A5.9 5.9 0 0 1 9 8.6Z" />
    </svg>
  );
}
