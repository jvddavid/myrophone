export function handleWorkflowHealth(): Response {
  return Response.json({
    service: 'workflows',
    status: 'ok',
  });
}
