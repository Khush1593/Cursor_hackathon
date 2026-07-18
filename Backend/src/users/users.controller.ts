import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { ResetEmergencyDto } from './dto/reset-emergency.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OwnershipGuard } from '../common/guards/ownership.guard';

/**
 * User dashboard, emergency reset, data export/delete.
 * @see project_knowledge.md §10.1
 */
@Controller('users')
@UseGuards(JwtAuthGuard, OwnershipGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':userId/dashboard')
  getDashboard(@Param('userId') userId: string) {
    return this.usersService.getDashboard(userId);
  }

  @Patch('reset-emergency')
  resetEmergency(@Body() dto: ResetEmergencyDto) {
    return this.usersService.resetEmergency(dto.userId);
  }

  @Get(':userId/export')
  exportData(@Param('userId') userId: string) {
    return this.usersService.exportData(userId);
  }

  @Delete(':userId/data')
  deleteData(@Param('userId') userId: string) {
    return this.usersService.deleteData(userId);
  }
}
