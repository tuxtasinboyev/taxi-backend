import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User, UserRole } from '@prisma/client';

export type JwtPayload = {
    id: string;
    phone: string;
    email?: string | null;
    role: UserRole
};

@Injectable()
export class JwtServices {
    constructor(
        private readonly jwt: JwtService,
        private readonly config: ConfigService,
    ) { }

    private async signToken(
        payload: JwtPayload,
        secretKey: string,
        expiresIn: string,
    ): Promise<string> {
        return this.jwt.signAsync(payload, {
            secret: secretKey,
            expiresIn,
        });
    }

    async generateAccessToken(user: Omit<User, 'password_hash'>): Promise<string> {
        const secret = this.config.get<string>('JWT_ACCESS_TOKEN_SECRET', 'access_default_secret');
        const expiresIn = this.config.get<string>('JWT_ACCESS_TOKEN_EXPIRES_IN', '15m');

        return this.signToken(
            {
                id: user.id,
                phone: user.phone,
                email: user.email,
                role: user.role
            },
            secret,
            expiresIn,
        );
    }

    async generateRefreshToken(user: Omit<User, 'password_hash'>): Promise<string> {
        const secret = this.config.get<string>('JWT_REFRESH_TOKEN_SECRET', 'refresh_default_secret');
        const expiresIn = this.config.get<string>('JWT_REFRESH_TOKEN_EXPIRES_IN', '7d');

        return this.signToken(
            {
                id: user.id,
                phone: user.phone,
                email: user.email,
                role: user.role
            },
            secret,
            expiresIn,
        );
    }
}
