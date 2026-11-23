export interface RequestMeta {
  ipAddress: string | null;
  userAgent: string | null;
}

export function getRequestMeta(request: Request): RequestMeta {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const ipAddress = forwardedFor?.split(',').at(0)?.trim() ?? null;
  const userAgent = request.headers.get('user-agent');

  return {
    ipAddress,
    userAgent,
  };
}
