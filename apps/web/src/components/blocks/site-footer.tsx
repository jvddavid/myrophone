export function SiteFooter() {
  return (
    <footer className="bg-ink text-ink-foreground">
      <div className="mx-auto max-w-6xl px-5 py-14 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-12">
          <div className="sm:col-span-5">
            <p className="font-display text-2xl">PayMotors</p>
            <p className="mt-3 max-w-[38ch] text-sm text-ink-foreground/70">
              Sociedade de Crédito Direto especializada em financiamento de motos elétricas no ponto
              de venda.
            </p>
          </div>
          <div className="text-sm text-ink-foreground/70 sm:col-span-3">
            <p className="text-ink-foreground">Comercial</p>
            <p className="mt-2">parcerias@paymotors.com.br</p>
            <p>0800 000 0000</p>
          </div>
          <div className="text-sm text-ink-foreground/70 sm:col-span-4">
            <p className="text-ink-foreground">Registro</p>
            <p className="mt-2">PayMotors Crédito S.A.</p>
            <p>CNPJ 00.000.000/0001-00</p>
            <p>Autorizada a funcionar pelo Banco Central do Brasil</p>
          </div>
        </div>
        <p className="mt-10 border-t border-white/10 pt-6 text-xs leading-relaxed text-ink-foreground/55">
          Os valores exibidos nesta página são estimativas e não constituem oferta de crédito.
          Condições sujeitas a análise. Dados tratados conforme a Lei 13.709 (LGPD).
        </p>
      </div>
    </footer>
  );
}
