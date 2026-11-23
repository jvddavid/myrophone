import { IconBrandWhatsapp } from "@tabler/icons-react";

export function WhatsappFloat() {
  return (
    <a
      href="https://wa.me/5521969215232?text=Quero%20credenciar%20minha%20loja%20na%20PayMotors"
      target="_blank"
      rel="noreferrer"
      aria-label="Falar com o comercial da PayMotors no WhatsApp"
      className="fixed right-5 bottom-5 z-50 flex items-center gap-2 rounded-full bg-ink px-4 py-3 text-sm font-semibold text-ink-foreground shadow-lg transition-colors hover:bg-secondary hover:text-secondary-foreground"
    >
      <IconBrandWhatsapp size={20} stroke={1.8} aria-hidden="true" />
      Falar com o comercial
    </a>
  );
}
