/**
 * Shared NestJS utilities: constants, decorators, guards, filters, types.
 * Feature modules import what they need from here — no cross-feature imports.
 *
 * Guards that need Passport (JwtAuthGuard) are not registered here — use
 * @UseGuards(JwtAuthGuard) in modules that import AuthModule.
 */
import { Global, Module } from '@nestjs/common';
import { OwnershipGuard } from './guards/ownership.guard';

@Global()
@Module({
  providers: [OwnershipGuard],
  exports: [OwnershipGuard],
})
export class CommonModule {}
