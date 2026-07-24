import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TokenService } from './token.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PrismaService } from 'src/prisma/prisma.service';
import { LocalStrategy } from './strategies/local.strategies';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AdminGuard } from 'src/guards/admin.guard';
import { ModuleGuard } from 'src/guards/module.guard';
import { SuperAdminGuard } from 'src/guards/super-admin.guard';
import { GoogleStrategy } from './strategies/google.strategy';

// passport-google-oauth20 throws on construction when clientID is missing, so
// only instantiate it once the credentials are actually configured — otherwise
// a missing env var takes the whole app down at boot. The check lives in a
// factory (not at module scope) because ConfigModule loads .env after this
// file is imported.
const googleStrategyProvider = {
  provide: GoogleStrategy,
  useFactory: (authService: AuthService) =>
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? new GoogleStrategy(authService)
      : null,
  inject: [AuthService],
};

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    JwtAuthGuard,
    AdminGuard,
    ModuleGuard,
    SuperAdminGuard,
    PrismaService,
    LocalStrategy,
    JwtStrategy,
    googleStrategyProvider,
  ],
  exports: [TokenService, JwtAuthGuard],
})
export class AuthModule {}
