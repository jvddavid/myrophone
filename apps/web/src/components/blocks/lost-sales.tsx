const costs = [
  {
    title: "Venda perdida",
    detail: "O cliente escolheu a moto, o limite do cartão não cobriu e ele saiu sem comprar.",
  },
  {
    title: "Tempo do vendedor",
    detail: "Horas de atendimento gastas em uma negociação que trava na forma de pagamento.",
  },
  {
    title: "Ticket menor",
    detail: "Sem crédito, o comprador desce de modelo e a loja fatura menos no mesmo esforço.",
  },
  {
    title: "Cliente do concorrente",
    detail: "A loja da esquina que oferece financiamento fecha a venda que era sua.",
  },
];

export function LostSales() {
  return (
    <section className="border-t border-hairline bg-concrete">
      <div className="mx-auto max-w-6xl px-5 py-16 lg:px-8">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-voltage">O problema</p>
        <h2 className="mt-4 max-w-[22ch] text-balance font-display text-3xl leading-tight text-foreground sm:text-4xl">
          Quantas motos deixaram a sua loja sem sair da loja?
        </h2>
        <p className="mt-4 max-w-[64ch] text-pretty text-base leading-relaxed text-muted-foreground">
          A moto elétrica tem ticket de R$ 8 mil a R$ 30 mil. Quase nenhum comprador tem esse limite
          disponível no cartão, e o banco tradicional não financia esse tipo de veículo. O crédito
          da PayMotors existe exatamente para esse momento do atendimento.
        </p>

        <ul className="mt-10 grid gap-px overflow-hidden rounded-lg border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-4">
          {costs.map((cost) => (
            <li key={cost.title} className="bg-background p-6">
              <p className="font-display text-lg text-foreground">{cost.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{cost.detail}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
