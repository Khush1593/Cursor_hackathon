import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';
import { buildPasswordResetEmail } from './templates/password-reset.template';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter!: Transporter;
  private usingJsonTransport = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const host = this.config.get<string>('mail.host');
    const user = this.config.get<string>('mail.user');
    const pass = this.config.get<string>('mail.pass');

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: this.config.get<number>('mail.port') ?? 587,
        secure: this.config.get<boolean>('mail.secure') ?? false,
        auth: { user, pass },
      });
      this.usingJsonTransport = false;
      this.logger.log(`SMTP mail transport ready (${host})`);
      return;
    }

    // Local/dev fallback: nodemailer JSON transport (no real SMTP).
    this.transporter = nodemailer.createTransport({ jsonTransport: true });
    this.usingJsonTransport = true;
    this.logger.warn(
      'MAIL_HOST/USER/PASS not set — using JSON transport (emails logged, not delivered)',
    );
  }

  async sendPasswordResetEmail(params: {
    to: string;
    resetToken: string;
    expiresInMinutes: number;
  }): Promise<void> {
    const frontendOrigin =
      this.config.get<string>('frontendOrigin') ?? 'http://localhost:3001';
    const resetPath =
      this.config.get<string>('mail.resetPasswordPath') ?? '/reset-password';
    const resetUrl = `${frontendOrigin.replace(/\/$/, '')}${resetPath}?token=${encodeURIComponent(params.resetToken)}`;

    const { subject, html, text } = buildPasswordResetEmail({
      recipientEmail: params.to,
      resetUrl,
      expiresInMinutes: params.expiresInMinutes,
      appName: 'Aura',
    });

    const from =
      this.config.get<string>('mail.from') ?? 'Aura <noreply@aura.health>';

    await this.transporter.sendMail({
      from,
      to: params.to,
      subject,
      text,
      html,
    });

    if (this.usingJsonTransport) {
      this.logger.log(
        `Password-reset email (dev/json): to=${params.to} resetUrl=${resetUrl}`,
      );
    } else {
      this.logger.log(`Password-reset email sent: to=${params.to}`);
    }
  }
}
