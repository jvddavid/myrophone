const questions = [
  {
    question: "O cliente precisa de cartão de crédito?",
    answer:
      "Não. O crédito é concedido pela PayMotors e as parcelas são cobradas em débito programado. O limite do cartão do cliente fica livre.",
  },
  {
    question: "Quem assume a inadimplência?",
    answer:
      "A PayMotors. O lojista recebe o valor integral do veículo em dois dias úteis e não responde pelo pagamento das parcelas.",
  },
  {
    question: "Quais veículos entram na política?",
    answer:
      "Somente motos e ciclomotores elétricos novos, vendidos por lojas credenciadas na rede. Baterias avulsas e acessórios podem ser incluídos no mesmo contrato.",
  },
  {
    question: "Preciso instalar algum equipamento na loja?",
    answer:
      "Não. A proposta é montada em qualquer navegador ou celular, e a assinatura acontece no aparelho do próprio comprador.",
  },
];

export function OperationalFaq() {
  return (
    <section className="border-t border-hairline">
      <div className="mx-auto max-w-6xl px-5 py-16 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-12">
          <h2 className="font-display text-3xl text-foreground lg:col-span-4">
            Dúvidas da operação
          </h2>
          <div className="lg:col-span-8">
            {questions.map((item) => (
              <details key={item.question} className="group border-t border-hairline last:border-b">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 font-display text-lg text-foreground">
                  {item.question}
                  <span className="text-xl leading-none text-voltage transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="max-w-[62ch] pb-5 text-pretty text-sm leading-relaxed text-muted-foreground">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
