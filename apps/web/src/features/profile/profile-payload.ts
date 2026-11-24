export function profileUpdatePayload(input: {
  name: string;
  phone: string;
  email?: string;
}): { name: string; phone: string } {
  return {
    name: input.name.trim(),
    phone: input.phone.trim(),
  };
}
