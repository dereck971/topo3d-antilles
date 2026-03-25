import { Resend } from 'resend';
import crypto from 'crypto';

const resend = new Resend(process.env.RESEND_API_KEY);
const ALLOWED_ORIGINS = ['https://topo3d-antilles.com', 'https://www.topo3d-antilles.com'];

export default async function handler(req, res) {
  // Add request ID to all responses
  const requestId = crypto.randomUUID();
  res.setHeader('X-Request-ID', requestId);

  // Apply secure CORS headers
  applySecureCORS(res, req);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      to,
      subject,
      htmlContent,
      textContent,
      attachments = []
    } = req.body;

    if (!to || !subject) {
      return res.status(400).json({ error: 'Missing to or subject' });
    }

    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured — email NOT sent');
      return res.status(503).json({
        ok: false,
        error: 'Email service not configured',
        message: 'RESEND_API_KEY environment variable is missing'
      });
    }

    // Send email via Resend
    const emailOptions = {
      from: 'commandes@topo3d-antilles.com',
      to,
      subject,
      html: htmlContent || textContent,
      reply_to: 'support@topo3d-antilles.com'
    };

    // Add attachments if provided
    if (attachments && attachments.length > 0) {
      emailOptions.attachments = attachments;
    }

    const emailResponse = await resend.emails.send(emailOptions);

    if (emailResponse.error) {
      throw new Error(emailResponse.error.message);
    }

    return res.status(200).json({
      ok: true,
      messageId: emailResponse.data.id
    });

  } catch (error) {
    console.error('Email error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function applySecureCORS(res, req) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (origin && origin.endsWith('.topo3d-antilles.vercel.app')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (origin === 'https://topo3d-antilles.vercel.app') {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
}
