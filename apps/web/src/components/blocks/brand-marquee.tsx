const brands = [
  "Voltz",
  "Shineray",
  "Watts",
  "Muuv",
  "Super Soco",
  "Riderr",
  "Origem",
  "Lev",
  "Niu",
  "Aima",
];

export function BrandMarquee() {
  const loop = [...brands, ...brands];

  return (
    <section
      aria-label="Marcas de motos elétricas financiadas"
      className="overflow-hidden border-y border-hairline bg-ink py-4 text-ink-foreground"
    >
      <div className="flex w-max marquee-track">
        {loop.map((brand, index) => (
          <div key={`${brand}-${index}`} className="flex items-center gap-8 px-8">
            <span className="whitespace-nowrap font-display text-lg text-ink-foreground/75">
              {brand}
            </span>
            <span aria-hidden="true" className="size-1 rounded-full bg-voltage" />
          </div>
        ))}
      </div>
    </section>
  );
}
