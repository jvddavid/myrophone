export const departmentIconCatalog = [
  { key: 'folder', label: 'Pasta' },
  { key: 'folder-open', label: 'Pasta aberta' },
  { key: 'folders', label: 'Pastas' },
  { key: 'file', label: 'Arquivo' },
  { key: 'file-text', label: 'Documento' },
  { key: 'files', label: 'Documentos' },
  { key: 'clipboard', label: 'Prancheta' },
  { key: 'clipboard-list', label: 'Lista' },
  { key: 'notebook', label: 'Caderno' },
  { key: 'notebook-pen', label: 'Anotações' },
  { key: 'sticky-note', label: 'Nota' },
  { key: 'scroll-text', label: 'Texto' },
  { key: 'book-open', label: 'Livro' },
  { key: 'library', label: 'Biblioteca' },
  { key: 'archive', label: 'Arquivo morto' },
  { key: 'inbox', label: 'Caixa de entrada' },
  { key: 'users', label: 'Pessoas' },
  { key: 'user', label: 'Pessoa' },
  { key: 'user-round', label: 'Perfil' },
  { key: 'contact', label: 'Contato' },
  { key: 'users-round', label: 'Equipe' },
  { key: 'handshake', label: 'Parceria' },
  { key: 'badge', label: 'Crachá' },
  { key: 'id-card', label: 'Identificação' },
  { key: 'building', label: 'Prédio' },
  { key: 'building-2', label: 'Edifício' },
  { key: 'landmark', label: 'Instituição' },
  { key: 'warehouse', label: 'Galpão' },
  { key: 'store', label: 'Loja' },
  { key: 'factory', label: 'Fábrica' },
  { key: 'house', label: 'Sede' },
  { key: 'map-pin', label: 'Local' },
  { key: 'wallet', label: 'Carteira' },
  { key: 'banknote', label: 'Dinheiro' },
  { key: 'coins', label: 'Moedas' },
  { key: 'circle-dollar-sign', label: 'Valores' },
  { key: 'receipt', label: 'Recibo' },
  { key: 'calculator', label: 'Calculadora' },
  { key: 'piggy-bank', label: 'Reserva' },
  { key: 'credit-card', label: 'Cartão' },
  { key: 'scale', label: 'Balança' },
  { key: 'gavel', label: 'Jurídico' },
  { key: 'shield', label: 'Proteção' },
  { key: 'shield-check', label: 'Conformidade' },
  { key: 'calendar', label: 'Calendário' },
  { key: 'calendar-days', label: 'Agenda' },
  { key: 'clock', label: 'Horário' },
  { key: 'timer', label: 'Prazo' },
  { key: 'phone', label: 'Telefone' },
  { key: 'headset', label: 'Atendimento' },
  { key: 'mail', label: 'Correio' },
  { key: 'message-square', label: 'Mensagem' },
  { key: 'messages-square', label: 'Conversas' },
  { key: 'megaphone', label: 'Aviso' },
  { key: 'truck', label: 'Transporte' },
  { key: 'package', label: 'Pacote' },
  { key: 'boxes', label: 'Volumes' },
  { key: 'shopping-cart', label: 'Compras' },
  { key: 'shopping-bag', label: 'Vendas' },
  { key: 'barcode', label: 'Código' },
  { key: 'tag', label: 'Etiqueta' },
  { key: 'wrench', label: 'Manutenção' },
  { key: 'hammer', label: 'Obra' },
  { key: 'settings', label: 'Ajustes' },
  { key: 'cog', label: 'Engrenagem' },
  { key: 'briefcase', label: 'Trabalho' },
  { key: 'presentation', label: 'Apresentação' },
  { key: 'chart-column', label: 'Gráfico' },
  { key: 'chart-pie', label: 'Participação' },
  { key: 'chart-line', label: 'Tendência' },
  { key: 'target', label: 'Meta' },
  { key: 'flag', label: 'Marco' },
  { key: 'key', label: 'Chave' },
  { key: 'lock', label: 'Sigilo' },
  { key: 'search', label: 'Busca' },
  { key: 'globe', label: 'Exterior' },
  { key: 'leaf', label: 'Sustentabilidade' },
  { key: 'heart-pulse', label: 'Saúde' },
  { key: 'graduation-cap', label: 'Formação' },
  { key: 'lightbulb', label: 'Ideia' },
] as const;

export type DepartmentIconKey = (typeof departmentIconCatalog)[number]['key'];

export const defaultDepartmentIconKey: DepartmentIconKey = 'folder';

const departmentIconKeys = new Set<string>();

for (const item of departmentIconCatalog) {
  if (departmentIconKeys.has(item.key)) {
    throw new Error(`Duplicate department icon key: ${item.key}`);
  }

  departmentIconKeys.add(item.key);
}

export function isDepartmentIconKey(
  value: string,
): value is DepartmentIconKey {
  return departmentIconKeys.has(value);
}
