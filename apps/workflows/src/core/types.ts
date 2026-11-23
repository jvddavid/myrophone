export type LeadWorkflowParams = {
  tenantId: string;
  leadId: string;
  payloadJson: string;
};

export type Env = {
  LEAD_WORKFLOW: {
    create: (input: {
      id?: string;
      params: LeadWorkflowParams;
    }) => Promise<unknown>;
  };
};

export interface StartLeadWorkflowBody {
  tenantId: string;
  leadId: string;
  payload?: unknown;
}
