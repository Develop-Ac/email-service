import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import {
  GuaranteeByCodeResponse,
  GuaranteeLinkValidationRequest,
  GuaranteeLinkValidationResponse,
  GuaranteeSummary,
} from './guarantee-client.types';

@Injectable()
export class GuaranteeClientService {
  private readonly logger = new Logger(GuaranteeClientService.name);
  private readonly httpClient: AxiosInstance | null;

  constructor(private readonly configService: ConfigService) {
    const baseURL = this.configService.get<string>('GARANTIA_SERVICE_URL');
    this.httpClient = baseURL
      ? axios.create({
          baseURL,
          timeout: Number(this.configService.get<string>('GARANTIA_SERVICE_TIMEOUT_MS') ?? 3000),
        })
      : null;
  }

  async findByCode(code: string): Promise<GuaranteeSummary[]> {
    const client = this.assertClient();
    const response = await client.get<GuaranteeByCodeResponse>(`/internal/garantias/by-codigo/${encodeURIComponent(code)}`);
    return response.data.items ?? [];
  }

  async getById(garantiaId: number): Promise<GuaranteeSummary> {
    const client = this.assertClient();
    const response = await client.get<GuaranteeSummary>(`/internal/garantias/${garantiaId}`);
    return response.data;
  }

  async validateLink(garantiaId: number, body: GuaranteeLinkValidationRequest): Promise<GuaranteeLinkValidationResponse> {
    const client = this.assertClient();
    const response = await client.post<GuaranteeLinkValidationResponse>(
      `/internal/garantias/${garantiaId}/validar-vinculo-email`,
      body,
    );

    return response.data;
  }

  private assertClient(): AxiosInstance {
    if (!this.httpClient) {
      this.logger.error('GARANTIA_SERVICE_URL nao configurado.');
      throw new ServiceUnavailableException('Integracao com garantia-service nao configurada.');
    }

    return this.httpClient;
  }
}