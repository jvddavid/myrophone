import { Settings, UserPlus } from 'lucide-react';
import type { AccordionAction } from '@/components/ui/accordion-item-with-actions';

export const addDepartmentPersonAction: AccordionAction = {
  type: 'add',
  icon: UserPlus,
  description: 'Adicionar',
};

export const configureDepartmentAction: AccordionAction = {
  type: 'configure',
  icon: Settings,
  description: 'Configurar departamento',
};

export function departmentHeaderActions(input: {
  canAddPeople: boolean;
  canConfigure: boolean;
}): AccordionAction[] {
  const actions: AccordionAction[] = [];

  if (input.canAddPeople) {
    actions.push(addDepartmentPersonAction);
  }

  if (input.canConfigure) {
    actions.push(configureDepartmentAction);
  }

  return actions;
}
