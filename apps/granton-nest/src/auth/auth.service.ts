  import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
  import { Role } from '@prisma/client';
  import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
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

      const hashedPassword = this.hashPassword(password);
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

      const valid = this.verifyPassword(password, user.password);
      if (!valid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const payload = { sub: user.id, email: user.email, role: user.role, name: user.name };
      return { access_token: this.jwtService.sign(payload) };
    }

    async getUserSummary(userId: number) {
      return this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      });
    }
  

    private hashPassword(password: string): string {
      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync(password, salt, 64).toString('hex');
      return `scrypt$${salt}$${hash}`;
    }

    private verifyPassword(password: string, stored: string): boolean {
      const parts = stored.split('$');
      if (parts.length !== 3 || parts[0] !== 'scrypt') {
        return false;
      }

      const [_, salt, expectedHash] = parts;
      const actualHash = scryptSync(password, salt, 64).toString('hex');
      return timingSafeEqual(Buffer.from(actualHash, 'hex'), Buffer.from(expectedHash, 'hex'));
    }
}