import { Injectable, NotImplementedException } from '@nestjs/common';

@Injectable()
export class UsersService {
  getDashboard(_userId: string): Promise<unknown> {
    throw new NotImplementedException(
      'UsersService.getDashboard not implemented yet',
    );
  }

  resetEmergency(
    _userId: string,
  ): Promise<{ is_emergency_state: boolean; active_mode: string }> {
    throw new NotImplementedException(
      'UsersService.resetEmergency not implemented yet',
    );
  }

  exportData(_userId: string): Promise<unknown> {
    throw new NotImplementedException(
      'UsersService.exportData not implemented yet',
    );
  }

  deleteData(
    _userId: string,
  ): Promise<{ deleted: boolean; deletedAt: string }> {
    throw new NotImplementedException(
      'UsersService.deleteData not implemented yet',
    );
  }
}
