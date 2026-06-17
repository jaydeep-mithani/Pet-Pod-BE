import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class EmailService implements OnModuleDestroy {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: ConfigService) {
    const host = config.getOrThrow<string>('SMTP_HOST');
    const port = Number(config.getOrThrow<string>('SMTP_PORT'));
    const user = config.getOrThrow<string>('SMTP_USER');
    const pass = config.getOrThrow<string>('SMTP_PASS');

    this.transporter = createTransport({
      host,
      port,
      // 465 = implicit TLS, anything else (587, 25) = STARTTLS.
      secure: port === 465,
      auth: { user, pass },
    });
    this.from = config.getOrThrow<string>('EMAIL_FROM');
  }

  async send({ to, subject, html }: SendEmailArgs): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        html,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`SMTP send failed for ${to}: ${message}`);
      throw new Error(`Failed to send email: ${message}`);
    }
  }

  onModuleDestroy() {
    this.transporter.close();
  }
}
