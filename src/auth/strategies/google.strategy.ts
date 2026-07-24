import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';

// The callback runs through the Next.js /api proxy so the cookies the backend
// sets land on the frontend origin (same reason next.config.ts proxies /api).
export function googleCallbackURL() {
  return (
    process.env.GOOGLE_CALLBACK_URL ??
    `${process.env.FRONTEND_URL}/api/auth/google/callback`
  );
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private authService: AuthService) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: googleCallbackURL(),
      scope: ['email', 'profile'],
    });
  }

  // Return the user — @nestjs/passport wraps this and calls passport's `done`
  // itself, so calling `done` here too would fire the callback twice.
  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ) {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      throw new UnauthorizedException(
        'Google account did not return an email address',
      );
    }

    return this.authService.validateGoogleUser({
      email,
      firstName: profile.name?.givenName ?? profile.displayName ?? 'Guest',
      lastName: profile.name?.familyName ?? '',
      image: profile.photos?.[0]?.value ?? null,
      emailVerified: profile.emails?.[0]?.verified !== false,
    });
  }
}
