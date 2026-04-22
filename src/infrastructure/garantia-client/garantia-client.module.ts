import { Global, Module } from '@nestjs/common';
import { GarantiaClientService } from './garantia-client.service';

@Global()
@Module({
  providers: [GarantiaClientService],
  exports: [GarantiaClientService],
})
export class GarantiaClientModule {}