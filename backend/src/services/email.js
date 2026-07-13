const nodemailer = require('nodemailer');
const config = require('../config');

let transporter = null;
function getTransporter() {
  if (!config.smtp.host) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    });
  }
  return transporter;
}

async function sendMail({ to, cc, subject, html, attachments }) {
  const t = getTransporter();
  if (!t) {
    console.warn(`[email skipped - SMTP not configured] ${subject} -> ${to}`);
    return;
  }
  try {
    await t.sendMail({ from: config.smtp.from, to, cc, subject, html, attachments });
  } catch (err) {
    console.error('Email send failed:', err.message);
  }
}

const layout = (title, body) => `
  <div style="font-family:Segoe UI,Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
    <div style="background:#1e3a5f;color:#fff;padding:16px 24px"><h2 style="margin:0">Nationwide Paper Ltd — IT Inventory</h2></div>
    <div style="padding:24px"><h3>${title}</h3>${body}</div>
    <div style="background:#f9fafb;padding:12px 24px;color:#6b7280;font-size:12px">Automated message from the IT Inventory Portal.</div>
  </div>`;

module.exports = { sendMail, layout };
