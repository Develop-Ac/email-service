export interface GuaranteeSummary {
  garantiaId: number;
  codigoGarantia: string;
  notaInterna: string;
  status: number;
  statusLabel?: string;
  nomeFornecedor?: string;
  emailFornecedor?: string;
  permiteVinculoEmail: boolean;
}

export interface GuaranteeByCodeResponse {
  items: GuaranteeSummary[];
}

export interface GuaranteeLinkValidationRequest {
  source: 'EMAIL_SERVICE';
  messageId: string | null;
  threadId: number | null;
  linkMode: 'AUTO' | 'MANUAL' | 'INHERITED';
  reasonCode: string;
  confidenceScore: number;
  matchedValue: string | null;
}

export interface GuaranteeLinkValidationResponse {
  allowed: boolean;
  garantiaId?: number;
  reason: string | null;
}