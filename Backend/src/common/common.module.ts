/**
 * Shared NestJS utilities: constants, decorators, guards, filters, types.
 * Feature modules import what they need from here — no cross-feature imports.
 */
import { Global, Module } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OwnershipGuard } from './guards/ownership.guard';

@Global()
@Module({
  providers: [JwtAuthGuard, OwnershipGuard],
  exports: [JwtAuthGuard, OwnershipGuard],
})
export class CommonModule {}
