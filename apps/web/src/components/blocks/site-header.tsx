import logo from "@/assets/paymotors-logo.png";

const links = [
  { href: "#servicos", label: "Serviços" },
  { href: "#operacao", label: "Operação" },
  { href: "#simulador", label: "Simulador" },
  { href: "#rede", label: "Rede parceira" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-3 lg:px-8">
        <a href="#topo" className="flex items-center gap-2">
          <img
            src={logo}
            alt="PayMotors"
            width={1024}
            height={1024}
            className="h-8 w-8 object-contain"
          />
          <span className="font-display text-lg font-bold tracking-tight text-foreground">
            PayMotors
          </span>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            crédito no ponto de venda
          </span>
        </a>

        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="transition-colors hover:text-foreground">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <a
            href="/auth"
            className="hidden rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-voltage hover:bg-accent hover:text-accent-foreground sm:inline-flex"
          >
            Área do parceiro
          </a>
          <a
            href="/credenciamento"
            className="rounded-md bg-voltage px-4 py-2 text-sm font-semibold text-voltage-foreground transition-colors hover:bg-primary-hover"
          >
            Credenciar minha loja
          </a>
        </div>
      </div>
    </header>
  );
}
