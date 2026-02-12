import nodemailer from 'nodemailer';

type MagicLinkEmail = {
  to: string;
  link: string;
  expiresInMinutes: number;
};

function getTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure = String(process.env.SMTP_SECURE ?? '').toLowerCase() === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });
}

export async function sendMagicLinkEmail({ to, link, expiresInMinutes }: MagicLinkEmail) {
  const from = process.env.SMTP_FROM ?? 'no-reply@travel-planner.local';
  const subject = 'Twoj magic link do Travel Planner';
  const text = `Kliknij link, aby sie zalogowac: ${link}\n\nLink wygasa za ${expiresInMinutes} minut.`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5;">
      <h2>Twoj magic link do Travel Planner</h2>
      <p>Kliknij ponizej, aby sie zalogowac:</p>
      <p><a href="${link}">${link}</a></p>
      <p>Link wygasa za ${expiresInMinutes} minut.</p>
    </div>
  `;

  const transport = getTransport();
  if (!transport) {
    console.log('\n[magic-link] SMTP NIE SKONFIGUROWANY!\nUdostepnij ten link recznie testerowi:\n');
    console.log('Magic link dla:', to);
    console.log('Link:', link);
    console.log('Wazny przez:', expiresInMinutes, 'minut');
    console.log('\n');
    return;
  }

  await transport.sendMail({ from, to, subject, text, html });
}
