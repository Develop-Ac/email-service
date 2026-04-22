import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class GarantiaClientService {
  private readonly client: AxiosInstance;

  constructor(configService: ConfigService) {
    this.client = axios.create({
      baseURL: configService.get<string>('GARANTIA_SERVICE_URL', 'http://localhost:3000/api'),
      timeout: 3000,
    });
  }

  async findByCode(code: string) {
    const response = await this.client.get(`/internal/garantias/by-codigo/${encodeURIComponent(code)}`);
    return response.data;
  }

  async getById(garantiaId: string | number) {
    const response = await this.client.get(`/internal/garantias/${garantiaId}`);
    return response.data;
  }

  async validateLink(garantiaId: string | number, payload: Record<string, unknown>) {
    const response = await this.client.post(`/internal/garantias/${garantiaId}/validar-vinculo-email`, payload);
    return response.data;
  }
}