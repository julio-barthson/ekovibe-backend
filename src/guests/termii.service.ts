import { Injectable, Logger } from '@nestjs/common';

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('234')) return digits;
  if (digits.startsWith('0')) return '234' + digits.slice(1);
  return '234' + digits;
}

@Injectable()
export class TermiiService {
  private readonly logger = new Logger(TermiiService.name);
  private readonly baseUrl = 'https://api.ng.termii.com/api/sms/send';

  private get apiKey() {
    return process.env.TERMII_API_KEY;
  }
  private get senderId() {
    return process.env.TERMII_SENDER_ID;
  }

  private async send(to: string, sms: string, mediaUrl?: string): Promise<void> {
    if (!this.apiKey || !this.senderId) {
      this.logger.warn('Termii credentials not set — skipping WhatsApp message');
      return;
    }

    const body: Record<string, any> = {
      api_key: this.apiKey,
      to: normalizePhone(to),
      from: this.senderId,
      sms,
      type: 'plain',
      channel: 'whatsapp',
    };

    if (mediaUrl) {
      body.media = { url: mediaUrl, caption: sms };
      body.sms = ' ';
    }

    try {
      const res = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        this.logger.error(`Termii error ${res.status}: ${text}`);
      }
    } catch (err) {
      this.logger.error('Termii request failed', err);
    }
  }

  async sendInvitation(
    phone: string,
    guestName: string,
    eventTitle: string,
    eventDate: string,
    venue: string,
    rsvpLink: string,
    rsvpDeadline?: string,
  ): Promise<void> {
    const deadline = rsvpDeadline ? `\n⏰ RSVP by: ${rsvpDeadline}` : '';
    const msg =
      `Hi ${guestName}!\n\n` +
      `You're invited to *${eventTitle}*.\n` +
      `📅 ${eventDate}\n` +
      `📍 ${venue}${deadline}\n\n` +
      `Please confirm your attendance here:\n${rsvpLink}\n\n` +
      `This link is personal and can only be used once.\n\n— Ekovibe`;
    await this.send(phone, msg);
  }

  async sendPostEventFollowUp(
    phone: string,
    guestName: string,
    eventTitle: string,
    photoGalleryUrl?: string,
  ): Promise<void> {
    const gallery = photoGalleryUrl ? `\n\n📸 View photos: ${photoGalleryUrl}` : '';
    const msg =
      `Hi ${guestName}! 🎉\n\n` +
      `Thank you for attending *${eventTitle}*. That was a vibe!${gallery}\n\n` +
      `Stay connected for upcoming events — Ekovibe`;
    await this.send(phone, msg);
  }

  async sendRsvpConfirmation(
    phone: string,
    guestName: string,
    eventTitle: string,
    eventDate: string,
    venue: string,
    qrCode: string,
  ): Promise<void> {
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrCode)}&bgcolor=F5F0E8&color=1C1A14&margin=10`;
    const caption =
      `Hi ${guestName}, your RSVP for *${eventTitle}* is confirmed! ✅\n\n` +
      `📅 ${eventDate}\n` +
      `📍 ${venue}\n\n` +
      `Your QR code (${qrCode}) is attached. Show it at the entrance.\n\n— Ekovibe`;
    await this.send(phone, caption, qrImageUrl);
  }
}
