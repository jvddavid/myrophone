import { normalizeTenantId } from '@myrophone/shared';
import { type ChangeEvent, useCallback, useMemo, useState } from 'react';

export default function App() {
  const [tenantInput, setTenantInput] = useState('Loja-Exemplo');

  const tenantId = useMemo(
    () => normalizeTenantId(tenantInput || 'tenant-demo'),
    [tenantInput],
  );

  const handleTenantInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setTenantInput(event.target.value);
    },
    [],
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">
          MyroPhone
        </p>
        <h1 className="text-4xl font-bold">
          SaaS Multi-tenant para WhatsApp Web
        </h1>
        <p className="text-slate-300">
          Base inicial do painel web para gestão de empresas assinantes e
          conexões.
        </p>
      </header>

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <label className="mb-2 block text-sm text-slate-300" htmlFor="tenantId">
          Tenant / empresa
        </label>
        <input
          id="tenantId"
          value={tenantInput}
          onChange={handleTenantInputChange}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-cyan-400/70 transition focus:ring"
        />

        <div className="mt-4 rounded-lg bg-slate-950 p-4 text-sm text-slate-300">
          tenant normalizado:{' '}
          <span className="font-semibold text-cyan-300">{tenantId}</span>
        </div>
      </section>
    </main>
  );
}
