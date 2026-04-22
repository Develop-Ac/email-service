import { Global, Module } from '@nestjs/common';
import { GuaranteeClientService } from './guarantee-client.service';

@Global()
@Module({
  providers: [GuaranteeClientService],
  exports: [GuaranteeClientService],
})
export class GuaranteeClientModule {}