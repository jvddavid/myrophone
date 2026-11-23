import heroBackground from "@/assets/hero-showroom.jpg";

import { OperationFlow } from "./operation-flow";

const figures = [
  { value: "R$ 214 mi", label: "originados na rede em 2025" },
  { value: "6 min", label: "mediana da decisão de crédito" },
  { value: "D+2", label: "repasse do valor ao lojista" },
];

export function HeroOperation() {
  return (
    <section id="topo" className="relative isolate overflow-hidden">
      <img
        src={heroBackground}
        alt=""
        aria-hidden="true"
        width={1920}
        height={1280}
        fetchPriority="high"
        className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-r from-background via-background/95 to-background/70"
      />
      <div className="mx-auto grid max-w-6xl gap-12 px-5 pt-14 pb-16 lg:grid-cols-12 lg:px-8">
        <div className="lg:col-span-5">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-voltage">
            Crédito no ponto de venda · rede credenciada em 14 estados
          </p>
          <h1 className="mt-5 max-w-[16ch] text-balance font-display text-4xl leading-[0.98] text-foreground sm:text-5xl">
            Somos a financeira que trabalha dentro da sua loja de motos elétricas.
          </h1>

          <p className="mt-6 max-w-[52ch] text-pretty text-base leading-relaxed text-muted-foreground">
            A PayMotors presta o serviço de crédito no ponto de venda: seu vendedor monta a
            proposta, a gente analisa e financia, o cliente leva a moto sem usar cartão de crédito e
            você recebe o valor cheio em dois dias úteis.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#rede"
              className="rounded-md bg-voltage px-5 py-3 text-sm font-semibold text-voltage-foreground transition-colors hover:bg-primary-hover"
            >
              Colocar minha loja na rede
            </a>
            <a
              href="#servicos"
              className="rounded-md border border-foreground px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-foreground hover:text-background"
            >
              Ver os serviços prestados
            </a>
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="rounded-lg border border-hairline bg-card p-5 sm:p-7">
            <OperationFlow />
          </div>
          <dl className="mt-5 grid grid-cols-1 divide-y divide-hairline border-t border-hairline sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {figures.map((figure) => (
              <div key={figure.label} className="py-4 sm:px-5 sm:first:pl-0">
                <dt className="font-display text-2xl text-foreground">{figure.value}</dt>
                <dd className="mt-1 max-w-[24ch] text-sm text-muted-foreground">{figure.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
