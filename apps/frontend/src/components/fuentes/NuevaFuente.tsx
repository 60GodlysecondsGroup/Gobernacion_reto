'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EncabezadoPagina } from '@/components/layout/EncabezadoPagina';
import { Aviso, Tarjeta } from '@/components/ui';
import { crearFuente } from '@/lib/api/fuentes';
import comun from '../comun.module.css';
import { FormularioFuente } from './FormularioFuente';

export function NuevaFuente() {
  const router = useRouter();

  return (
    <div className={comun.pagina}>
      <nav aria-label="Ruta" className={comun.suave}>
        <Link href="/gestion/fuentes">← Fuentes institucionales</Link>
      </nav>
      <EncabezadoPagina antetitulo="Gestión de fuentes" titulo="Nueva fuente" />
      <Aviso tono="advertencia" titulo="Solo información verificable">
        Registra únicamente canales que comprobaste en una fuente oficial. En el prototipo, marca
        los registros ficticios como dato de demostración.
      </Aviso>
      <Tarjeta>
        <FormularioFuente
          modo="crear"
          alGuardar={async (datos) => {
            const { fuente } = await crearFuente(datos);
            router.push(`/gestion/fuentes/${fuente.id}`);
          }}
        />
      </Tarjeta>
    </div>
  );
}
