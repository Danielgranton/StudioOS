  import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
  import { Role } from '@prisma/client';
  import * as bcrypt from 'bcrypt';
  import { JwtService } from '@nestjs/jwt';
  import { PrismaService } from '../../prisma/prisma.service';

  @Injectable()
  export class AuthService {
    constructor(
      private readonly prisma: PrismaService,
      private readonly jwtService: JwtService,
    ) {}

    async register(email: string, password: string, role?: Role) {
      const existing = await this.prisma.user.findUnique({ where: { email } });
      if (existing) {
        throw new ConflictException('Email already in use');
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await this.prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          role: role ?? Role.USER,
          name: 'Default User',
        },
      });

      return { id: user.id, email: user.email, role: user.role, name: user.name };
    }

    async login(email: string, password: string) {
      const user = await this.prisma.user.findUnique({ where: { email } });
      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const payload = { sub: user.id, email: user.email, role: user.role, name: user.name };
      return { access_token: this.jwtService.sign(payload) };
    }
  }
