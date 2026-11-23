import {
  type HierarchyExportProgress,
  type HierarchyExportStep,
  hierarchyExportStepCatalog,
  type TenantHierarchyExportJobData,
  type TenantHierarchyExportResult,
} from '@myrophone/shared';

interface HierarchyExportProcessingOptions {
  timeoutMs: number;
  onProgress?: (progress: HierarchyExportProgress) => Promise<void>;
  artificialDelayMs?: number;
}

function escapePdfText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function buildGraphLines(payload: TenantHierarchyExportJobData): string[] {
  const lines: string[] = [];

  lines.push(
    `Tenant: ${payload.snapshot.tenantName} (${payload.snapshot.tenantSlug})`,
  );
  lines.push(`Generated at: ${payload.snapshot.generatedAt}`);
  lines.push('');
  lines.push('Teams:');

  for (const team of payload.snapshot.teams) {
    lines.push(`- ${team.name} [${team.slug}] members=${team.memberCount}`);
  }

  lines.push('');
  lines.push('Users:');

  for (const user of payload.snapshot.users) {
    const teams = user.teamRoles
      .map((teamRole) => `${teamRole.teamId}:${teamRole.role}`)
      .join(', ');

    lines.push(
      `- ${user.name ?? '(no-name)'} <${user.email}> role=${user.tenantRole} avatar=${user.avatarUrl}`,
    );
    lines.push(`  teams: ${teams || '(none)'}`);
  }

  lines.push('');
  lines.push('Edges (graph):');

  for (const edge of payload.snapshot.edges) {
    lines.push(`- ${edge.from} -> ${edge.to} (${edge.relation}:${edge.label})`);
  }

  return lines;
}

function renderSimplePdf(lines: string[]): Uint8Array {
  const maxLines = 45;
  const contentLines = lines
    .slice(0, maxLines)
    .map((line) => `(${escapePdfText(line)}) Tj`);

  const content = `BT\n/F1 10 Tf\n50 800 Td\n12 TL\n${contentLines.join(
    '\nT*\n',
  )}\nET`;

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];

  for (const object of objects) {
    offsets.push(pdf.length);
    pdf += object;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';

  for (const offset of offsets) {
    pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new TextEncoder().encode(pdf);
}

async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> {
  if (timeoutMs <= 0) {
    return operation;
  }

  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<T>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function nextProgress(
  startedAt: string,
  step: HierarchyExportStep,
  completedSteps: HierarchyExportStep[],
  percent: number,
  message: string,
  status: HierarchyExportProgress['status'],
): HierarchyExportProgress {
  return {
    status,
    step,
    completedSteps,
    percent,
    message,
    startedAt,
    updatedAt: new Date().toISOString(),
  };
}

async function delay(ms: number): Promise<void> {
  if (ms <= 0) {
    return;
  }

  await new Promise<void>((resolve) => {
    setTimeout(() => resolve(), ms);
  });
}

export async function processTenantHierarchyExportJob(
  payload: TenantHierarchyExportJobData,
  options: HierarchyExportProcessingOptions,
): Promise<TenantHierarchyExportResult> {
  const startedAt = new Date().toISOString();
  const completedSteps: HierarchyExportStep[] = [];
  let activeStep: HierarchyExportStep = hierarchyExportStepCatalog[0];

  const report = async (
    step: HierarchyExportStep,
    percent: number,
    message: string,
    status: HierarchyExportProgress['status'],
  ): Promise<void> => {
    activeStep = step;
    if (!options.onProgress) {
      return;
    }

    await options.onProgress(
      nextProgress(
        startedAt,
        step,
        [...completedSteps],
        percent,
        message,
        status,
      ),
    );
  };

  try {
    return await withTimeout(
      (async () => {
        await report(
          'validating_input',
          5,
          'Validando dados do tenant',
          'running',
        );
        await delay(options.artificialDelayMs ?? 0);

        if (payload.snapshot.tenantId !== payload.tenantId) {
          throw new Error('Snapshot tenantId mismatch.');
        }

        completedSteps.push('validating_input');
        await report(
          'building_graph',
          30,
          'Montando grafo de hierarquia',
          'running',
        );
        await delay(options.artificialDelayMs ?? 0);

        const graphLines = buildGraphLines(payload);

        completedSteps.push('building_graph');
        await report(
          'rendering_pdf',
          70,
          'Renderizando PDF da hierarquia',
          'running',
        );
        await delay(options.artificialDelayMs ?? 0);

        const pdfBytes = renderSimplePdf(graphLines);

        completedSteps.push('rendering_pdf');
        await report('finalizing', 95, 'Finalizando exportação', 'running');

        const generatedAt = new Date().toISOString();
        const result: TenantHierarchyExportResult = {
          format: 'pdf',
          fileName: `tenant-hierarchy-${payload.tenantSlug}-${Date.now()}.pdf`,
          mimeType: 'application/pdf',
          contentBase64: Buffer.from(pdfBytes).toString('base64'),
          sizeBytes: pdfBytes.byteLength,
          generatedAt,
          tenantId: payload.tenantId,
          steps: [...completedSteps, 'finalizing'],
        };

        completedSteps.push('finalizing');
        await report('finalizing', 100, 'Exportação concluída', 'completed');

        return result;
      })(),
      options.timeoutMs,
      `Hierarchy export timed out after ${options.timeoutMs}ms`,
    );
  } catch (error) {
    await report(
      activeStep,
      100,
      error instanceof Error ? error.message : 'Unknown export failure',
      'failed',
    );

    throw error;
  }
}
