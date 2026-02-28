import { Controller, Post, Body } from '@nestjs/common';
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
}
