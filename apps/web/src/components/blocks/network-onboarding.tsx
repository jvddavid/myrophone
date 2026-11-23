import lojaParceira from "@/assets/loja-parceira.jpg";

const steps = [
  { title: "Diagnóstico da loja", detail: "Volume, ticket médio e mix de modelos elétricos." },
  { title: "Credenciamento", detail: "Documentação do CNPJ e política de crédito definida." },
  { title: "Time treinado", detail: "Vendedores operando propostas no mesmo dia." },
];

export function NetworkOnboarding() {
  return (
    <section id="rede" className="border-t border-hairline bg-card">
      <div className="mx-auto max-w-6xl px-5 py-16 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <h2 className="max-w-[20ch] text-balance font-display text-3xl text-foreground">
              Sua loja vende a moto. Nós assumimos o crédito e o risco.
            </h2>
            <p className="mt-4 max-w-[48ch] text-pretty text-sm leading-relaxed text-muted-foreground">
              Hoje o cliente entra, gosta da moto e trava na forma de pagamento. Na rede PayMotors o
              vendedor resolve isso no atendimento, sem depender do limite do cartão nem de
              aprovação bancária em outro dia.
            </p>

            <ol className="mt-8">
              {steps.map((step, index) => (
                <li
                  key={step.title}
                  className="grid grid-cols-[auto_1fr] gap-4 border-t border-hairline py-4 last:border-b"
                >
                  <span className="font-display text-sm text-voltage">{index + 1}º</span>
                  <span>
                    <span className="block font-display text-base text-foreground">
                      {step.title}
                    </span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                      {step.detail}
                    </span>
                  </span>
                </li>
              ))}
            </ol>

            <a
              href="/credenciamento"
              className="mt-8 inline-block rounded-md bg-voltage px-5 py-3 text-sm font-semibold text-voltage-foreground transition-colors hover:bg-primary-hover"
            >
              Solicitar credenciamento
            </a>
          </div>

          <div className="lg:col-span-6">
            <img
              src={lojaParceira}
              alt="Vendedor e cliente montando uma proposta de financiamento em um tablet no balcão de uma loja de motos elétricas"
              width={1408}
              height={1008}
              loading="lazy"
              className="w-full rounded-lg border border-hairline object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
