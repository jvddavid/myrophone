type Service = {
  code: string;
  name: string;
  description: string;
  audience: "Lojista" | "Consumidor";
};

const services: Service[] = [
  {
    code: "SV-01",
    name: "Originação no balcão",
    description:
      "Proposta montada pelo vendedor em qualquer navegador, com o cliente ao lado e a moto escolhida.",
    audience: "Lojista",
  },
  {
    code: "SV-02",
    name: "Análise e decisão de crédito",
    description:
      "Motor próprio de risco para moto elétrica, com política ajustada por ticket, modelo e região.",
    audience: "Lojista",
  },
  {
    code: "SV-03",
    name: "Formalização e assinatura",
    description: "Contrato e alienação fiduciária gerados e assinados digitalmente no atendimento.",
    audience: "Consumidor",
  },
  {
    code: "SV-04",
    name: "Repasse ao lojista",
    description:
      "Valor integral do veículo liquidado em dois dias úteis, sem retenção de garantia.",
    audience: "Lojista",
  },
  {
    code: "SV-05",
    name: "Cobrança e relacionamento",
    description:
      "Parcelas, renegociação e atendimento ao comprador ficam com a gente. O risco também.",
    audience: "Consumidor",
  },
  {
    code: "SV-06",
    name: "Painel da rede",
    description:
      "Propostas, aprovações, repasses e comissão por vendedor em um painel único da rede.",
    audience: "Lojista",
  },
];

export function ServiceIndex() {
  return (
    <section id="servicos" className="border-t border-hairline bg-card">
      <div className="mx-auto max-w-6xl px-5 py-16 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <h2 className="max-w-[18ch] text-balance font-display text-3xl text-foreground">
              O que a PayMotors opera para a sua rede
            </h2>
            <p className="mt-4 max-w-[38ch] text-pretty text-sm leading-relaxed text-muted-foreground">
              Seis serviços contratados em bloco ou separadamente. A loja continua vendendo moto; o
              crédito é nosso.
            </p>
          </div>

          <ul className="lg:col-span-8">
            {services.map((service) => (
              <li
                key={service.code}
                className="grid gap-2 border-t border-hairline py-5 last:border-b sm:grid-cols-12 sm:gap-6"
              >
                <span className="text-xs font-semibold tracking-wide text-voltage sm:col-span-2">
                  {service.code}
                </span>
                <div className="sm:col-span-7">
                  <h3 className="font-display text-lg text-foreground">{service.name}</h3>
                  <p className="mt-1 max-w-[56ch] text-pretty text-sm leading-relaxed text-muted-foreground">
                    {service.description}
                  </p>
                </div>
                <span className="self-start text-xs text-muted-foreground sm:col-span-3 sm:text-right">
                  atende: {service.audience}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
