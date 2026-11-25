import { useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  groupCatalog,
  type PermissionCatalogEntry,
} from './permission-groups';

function PermissionSwitch({
  id,
  description,
  checked,
  disabled,
  permissionKey,
  onToggle,
}: {
  id: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  permissionKey: string;
  onToggle: (key: string, enabled: boolean) => void;
}) {
  const onCheckedChange = useCallback(
    (next: boolean) => {
      onToggle(permissionKey, next);
    },
    [onToggle, permissionKey],
  );

  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <Label className="text-sm font-normal leading-snug" htmlFor={id}>
        {description}
      </Label>
      <Switch
        checked={checked}
        disabled={disabled}
        id={id}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

export function PermissionGroups({
  catalog,
  selected,
  disabled,
  idPrefix,
  onToggle,
}: {
  catalog: readonly PermissionCatalogEntry[];
  selected: ReadonlySet<string>;
  disabled: boolean;
  idPrefix: string;
  onToggle: (key: string, enabled: boolean) => void;
}) {
  const sections = groupCatalog(catalog);

  return (
    <div className="flex flex-col gap-4">
      {sections.map((section) => (
        <fieldset className="min-w-0 space-y-1" key={section.group}>
          <legend className="text-sm font-medium">{section.group}</legend>
          {section.entries.map((entry) => (
            <PermissionSwitch
              checked={selected.has(entry.key)}
              description={entry.description}
              disabled={disabled}
              id={`${idPrefix}-${entry.key}`}
              key={entry.key}
              onToggle={onToggle}
              permissionKey={entry.key}
            />
          ))}
        </fieldset>
      ))}
    </div>
  );
}
