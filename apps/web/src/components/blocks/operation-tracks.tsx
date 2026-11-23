const tracks = [
  {
    id: "b2b",
    tag: "B2B",
    title: "Contrato com a rede",
    lead: "Quem assina conosco é a loja ou o grupo de lojas.",
    items: [
      "Credenciamento da rede e de cada filial em até 5 dias úteis",
      "Política de crédito e taxa negociadas por volume mensal",
      "Treinamento do time de vendas e material de balcão",
      "Conciliação de repasses e relatório fiscal por CNPJ",
    ],
  },
  {
    id: "b2b2c",
    tag: "B2B2C",
    title: "Entrega ao consumidor",
    lead: "Quem usa o crédito é o cliente que entrou na loja.",
    items: [
      "Análise com CPF, renda e dados abertos, sem cartão de crédito",
      "Parcela fixa de 18 a 48 meses em débito programado",
      "Contrato assinado no celular do próprio comprador",
      "Atendimento pós-venda feito pela PayMotors, em nome da parceria",
    ],
  },
];

export function OperationTracks() {
  return (
    <section id="operacao" className="bg-ink text-ink-foreground">
      <div className="mx-auto max-w-6xl px-5 py-16 lg:px-8">
        <h2 className="max-w-[24ch] text-balance font-display text-3xl text-ink-foreground">
          Uma operação, dois contratos que andam juntos
        </h2>

        <div className="mt-10 grid gap-px overflow-hidden rounded-lg bg-white/10 sm:grid-cols-2">
          {tracks.map((track) => (
            <div key={track.id} className="bg-ink p-6 sm:p-8">
              <div className="flex items-baseline gap-3">
                <span className="rounded-md bg-voltage px-2 py-0.5 text-xs font-bold text-voltage-foreground">
                  {track.tag}
                </span>
                <h3 className="font-display text-xl text-ink-foreground">{track.title}</h3>
              </div>
              <p className="mt-3 max-w-[42ch] text-pretty text-sm text-ink-foreground/70">
                {track.lead}
              </p>
              <ul className="mt-6 space-y-3">
                {track.items.map((item) => (
                  <li
                    key={item}
                    className="flex gap-3 border-t border-white/10 pt-3 text-sm leading-relaxed text-ink-foreground/85"
                  >
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-secondary" />
                    <span className="max-w-[46ch]">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
