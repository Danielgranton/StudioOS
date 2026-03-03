import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Role } from '@prisma/client';


@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) {}

    @Post('register')
    register(
        @Body('email')email: string,
        @Body('password')password: string,
        @Body('role')role: Role,
        
    ) {
        return this.authService.register(email, password, role);
    }

    @Post('login')
    login(@Body('email') email: string, @Body('password') password: string) {
        return this.authService.login(email, password);
    }

    @Get('users/:id')
    async getUserById(
      @Param('id') id: string,
      @Query('role') requiredRole?: Role,
      @Headers('x-service-secret') serviceSecret?: string,
    ) {
      const expectedSecret = process.env.INTERNAL_SERVICE_SECRET;
      if (expectedSecret && serviceSecret !== expectedSecret) {
        throw new UnauthorizedException('Invalid service secret');
      }

      const user = await this.authService.getUserSummary(Number(id));
      if (!user) {
        return { exists: false };
      }

      if (requiredRole && user.role !== requiredRole) {
        return { exists: false };
      }

      return { exists: true, user };
    }
}
