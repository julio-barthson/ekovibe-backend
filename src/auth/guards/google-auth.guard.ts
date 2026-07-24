import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    // `?next=/ticketing` survives the round trip to Google via the state param,
    // so we can drop the user back where they started.
    const next = typeof req.query?.next === 'string' ? req.query.next : '';
    return {
      session: false,
      state: next ? Buffer.from(next).toString('base64url') : undefined,
    };
  }

  // Passport throws on a denied consent screen / bad code. Swallow it here so
  // the controller can redirect to the frontend with a readable error instead
  // of dumping a 500 JSON body into the browser.
  handleRequest(err: any, user: any) {
    if (err || !user) return null;
    return user;
  }
}
