import { useMemo, useState } from "react";

const MONTHLY_RATE = 0.0189;

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const currencyCents = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const terms = [18, 24, 36, 48];

export function CreditSimulator() {
  const [price, setPrice] = useState(24000);
  const [downPaymentPercent, setDownPaymentPercent] = useState(20);
  const [term, setTerm] = useState(36);

  const { downPayment, financed, installment, total } = useMemo(() => {
    const down = Math.round((price * downPaymentPercent) / 100);
    const principal = price - down;
    const factor = Math.pow(1 + MONTHLY_RATE, term);
    const monthly = (principal * MONTHLY_RATE * factor) / (factor - 1);
    return {
      downPayment: down,
      financed: principal,
      installment: monthly,
      total: monthly * term + down,
    };
  }, [price, downPaymentPercent, term]);

  return (
    <section id="simulador" className="border-t border-hairline">
      <div className="mx-auto max-w-6xl px-5 py-16 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <h2 className="max-w-[20ch] text-balance font-display text-3xl text-foreground">
              A mesma calculadora que o vendedor abre no balcão
            </h2>
            <p className="mt-4 max-w-[46ch] text-pretty text-sm leading-relaxed text-muted-foreground">
              Ajuste o valor da moto, a entrada e o prazo. A parcela é a estimativa exibida ao
              cliente antes da análise; a condição final sai na aprovação.
            </p>

            <div className="mt-8 space-y-7">
              <label className="block">
                <span className="flex items-baseline justify-between text-sm">
                  <span className="text-muted-foreground">Valor da moto elétrica</span>
                  <span className="font-display text-lg text-foreground">
                    {currency.format(price)}
                  </span>
                </span>
                <input
                  type="range"
                  min={8000}
                  max={60000}
                  step={500}
                  value={price}
                  onChange={(event) => setPrice(Number(event.target.value))}
                  className="mt-3 w-full accent-voltage"
                />
              </label>

              <label className="block">
                <span className="flex items-baseline justify-between text-sm">
                  <span className="text-muted-foreground">Entrada</span>
                  <span className="font-display text-lg text-foreground">
                    {downPaymentPercent}% · {currency.format(downPayment)}
                  </span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={60}
                  step={5}
                  value={downPaymentPercent}
                  onChange={(event) => setDownPaymentPercent(Number(event.target.value))}
                  className="mt-3 w-full accent-voltage"
                />
              </label>

              <fieldset>
                <legend className="text-sm text-muted-foreground">Prazo</legend>
                <div className="mt-3 flex flex-wrap gap-2">
                  {terms.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setTerm(option)}
                      aria-pressed={term === option}
                      className={
                        term === option
                          ? "rounded-md bg-ink px-4 py-2 text-sm font-semibold text-ink-foreground"
                          : "rounded-md border border-hairline px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-voltage hover:bg-accent hover:text-foreground"
                      }
                    >
                      {option}x
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="rounded-lg border border-hairline bg-card">
              <div className="flex items-center justify-between border-b border-hairline px-6 py-3 text-sm">
                <span className="text-muted-foreground">Parcela estimada</span>
                <span className="text-muted-foreground">{term} parcelas fixas</span>
              </div>
              <div className="px-6 py-9">
                <p className="font-display text-5xl leading-none text-foreground tabular-nums sm:text-6xl">
                  {currencyCents.format(installment)}
                </p>
                <p className="mt-3 text-sm text-muted-foreground">
                  Primeira parcela 30 dias após a retirada da moto, em débito programado.
                </p>

                <dl className="mt-8 grid grid-cols-1 divide-y divide-hairline border-t border-hairline sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                  <div className="py-4 sm:pr-5">
                    <dt className="text-xs text-muted-foreground">Entrada na loja</dt>
                    <dd className="mt-1 font-display text-lg text-foreground">
                      {currency.format(downPayment)}
                    </dd>
                  </div>
                  <div className="py-4 sm:px-5">
                    <dt className="text-xs text-muted-foreground">Valor financiado</dt>
                    <dd className="mt-1 font-display text-lg text-foreground">
                      {currency.format(financed)}
                    </dd>
                  </div>
                  <div className="py-4 sm:pl-5">
                    <dt className="text-xs text-muted-foreground">Total pago</dt>
                    <dd className="mt-1 font-display text-lg text-foreground">
                      {currency.format(total)}
                    </dd>
                  </div>
                </dl>

                <p className="mt-6 max-w-[64ch] text-xs leading-relaxed text-muted-foreground">
                  Cálculo ilustrativo com taxa de referência de 1,89% ao mês. Taxa, CET e prazo
                  finais dependem da análise de crédito e da política contratada pela rede.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
