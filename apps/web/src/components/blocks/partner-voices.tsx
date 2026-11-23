const voices = [
  {
    quote:
      "Antes eu perdia venda toda semana por falta de limite no cartão. Hoje o crédito sai no balcão e o cliente leva a moto no mesmo dia.",
    name: "Juliana Prado",
    role: "Eletro Motos, São Paulo/SP",
    figure: "+38% em vendas",
  },
  {
    quote:
      "O que mais pesa é o repasse. Recebo o valor cheio em dois dias úteis e não fico com risco de parcela na minha mão.",
    name: "Anderson Lima",
    role: "Rota Verde, Belo Horizonte/MG",
    figure: "Repasse D+2",
  },
  {
    quote:
      "Meu time de vendas aprendeu a montar proposta em uma tarde. A análise volta enquanto o cliente ainda está na loja.",
    name: "Rafaela Souza",
    role: "Voltar Mobilidade, Recife/PE",
    figure: "6 min por proposta",
  },
];

export function PartnerVoices() {
  return (
    <section className="border-t border-hairline">
      <div className="mx-auto max-w-6xl px-5 py-16 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="max-w-[20ch] text-balance font-display text-3xl leading-tight text-foreground">
            Quem já opera com a gente
          </h2>
          <p className="text-sm text-muted-foreground">
            Depoimentos de lojistas credenciados na rede PayMotors.
          </p>
        </div>

        <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-hairline bg-hairline lg:grid-cols-3">
          {voices.map((voice) => (
            <figure key={voice.name} className="flex flex-col bg-background p-6">
              <span className="font-mono text-xs uppercase tracking-[0.18em] text-voltage">
                {voice.figure}
              </span>
              <blockquote className="mt-4 flex-1 text-pretty text-base leading-relaxed text-foreground">
                “{voice.quote}”
              </blockquote>
              <figcaption className="mt-6 border-t border-hairline pt-4 text-sm">
                <span className="font-semibold text-foreground">{voice.name}</span>
                <span className="mt-1 block text-muted-foreground">{voice.role}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
