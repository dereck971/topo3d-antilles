import crypto from 'crypto';

const ALLOWED_ORIGINS = ['https://topo3d-antilles.com', 'https://www.topo3d-antilles.com'];

export default async function handler(req, res) {
  // Add request ID to all responses
  const requestId = crypto.randomUUID();
  res.setHeader('X-Request-ID', requestId);

  // Apply secure CORS headers
  applySecureCORS(res, req);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const signature = req.headers['stripe-signature'];
    const body = req.rawBody || JSON.stringify(req.body);
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!secret) {
      console.error('STRIPE_WEBHOOK_SECRET is required — rejecting unverified webhook');
      return res.status(500).json({ error: 'Webhook not configured' });
    }

    // Verify webhook signature
    if (!verifyWebhookSignature(body, signature, secret)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = JSON.parse(body);

    // Handle checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      // Send confirmation email
      await sendConfirmationEmail(session);

      return res.status(200).json({ received: true });
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function applySecureCORS(res, req) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (origin && origin.endsWith('.topo3d-antilles.com')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (origin === 'https://www.topo3d-antilles.com') {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
}

function verifyWebhookSignature(body, signature, secret) {
  try {
    if (!signature) return false;

    // Parse Stripe signature format: t=TIMESTAMP,v1=HASH
    const parts = {};
    signature.split(',').forEach(item => {
      const [key, value] = item.split('=');
      if (key && value) {
        parts[key] = value;
      }
    });

    if (!parts.t || !parts.v1) return false;

    const signedContent = `${parts.t}.${body}`;
    const expectedHash = crypto
      .createHmac('sha256', secret)
      .update(signedContent)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(parts.v1),
      Buffer.from(expectedHash)
    );
  } catch {
    return false;
  }
}

async function sendConfirmationEmail(session) {
  try {
    const customerEmail = session.customer_email || session.customer_details?.email;

    if (!customerEmail) {
      console.warn('No customer email in webhook event');
      return;
    }

    // Build email content
    const htmlContent = `
      <html>
        <body style="font-family: 'DM Sans', Arial; background: #fafafa; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: #fff; padding: 40px; border-radius: 12px;">
            <h1 style="color: #00c896; margin-bottom: 20px;">Commande reçue! 🎉</h1>

            <p>Votre commande a été reçue avec succès!</p>

            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 30px 0;">
              <h2 style="margin-top: 0; color: #0a0a14;">Détails de la commande</h2>
              <p><strong>Montant:</strong> ${(session.amount_total / 100).toFixed(2)}€</p>
              <p><strong>Session ID:</strong> ${session.id}</p>
              <p><strong>Date:</strong> ${new Date(session.created * 1000).toLocaleDateString('fr-FR')}</p>
            </div>

            <p style="color: #666;">
              Vos données seront traitées et téléchargables dans moins de 24h.
              Consultez votre compte Topo3D-Antilles pour suivre l'état de votre commande.
            </p>

            <p style="color: #666;">
              Questions? Contactez <a href="mailto:support@topo3d-antilles.com" style="color: #00c896;">support@topo3d-antilles.com</a>
            </p>

            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

            <p style="text-align: center; font-size: 12px; color: #888;">
              Topo3D-Antilles 🏔️ | Topographie 3D LiDAR HD pour les Antilles<br>
              <a href="https://topo3d-antilles.com" style="color: #00c896; text-decoration: none;">topo3d-antilles.com</a>
            </p>
          </div>
        </body>
      </html>
    `;

    // Send confirmation email via Resend
    if (process.env.RESEND_API_KEY) {
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'support@topo3d-antilles.com',
          to: customerEmail,
          subject: `Confirmation de commande — Topo3D Antilles`,
          html: htmlContent
        })
      });
      if (!resendResponse.ok) {
        console.error('Resend API error:', await resendResponse.text());
      }
    }

  } catch (error) {
    console.error('Error sending confirmation email:', error);
  }
}
