/**
 * email.js — Send transactional emails via Resend
 */

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send delivery email with download links
 * @param {Object} params
 * @param {string} params.to - Client email
 * @param {string} params.section - Cadastral section
 * @param {string} params.numero - Parcel number
 * @param {string} params.commune - Commune name
 * @param {string} params.offer - Offer name
 * @param {Object} params.files - {format: downloadUrl, ...}
 * @returns {Object} Resend response
 */
export async function sendDeliveryEmail({ to, section, numero, commune, offer, files }) {
  const parcelRef = `${section} ${numero}`;
  const fileList = Object.entries(files)
    .map(([format, url]) => {
      const labels = {
        obj: 'Mesh 3D (.OBJ) — SketchUp, Blender, Rhino',
        mtl: 'Material (.MTL) — Accompagne le fichier OBJ',
        dxf: 'Courbes de niveau (.DXF) — AutoCAD, BricsCAD',
        geojson: 'Contour parcelle (.GeoJSON) — QGIS, SIG',
        png: 'Plan topographique (.PNG) — Image haute qualite',
        pdf: 'Plan topographique (.PDF) — Document A4'
      };
      const label = labels[format] || `.${format.toUpperCase()}`;
      return `<tr>
        <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">
          <strong style="color:#1e293b;">${label}</strong>
        </td>
        <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:right;">
          <a href="${url}" style="display:inline-block;padding:8px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">
            Telecharger
          </a>
        </td>
      </tr>`;
    })
    .join('\n');

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1e3a5f,#2563eb);border-radius:12px 12px 0 0;padding:32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:24px;">Topo3D Antilles</h1>
      <p style="color:#93c5fd;margin:8px 0 0;font-size:14px;">Vos fichiers topographiques sont prets</p>
    </div>

    <!-- Body -->
    <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

      <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 8px;">
        Bonjour,
      </p>
      <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 24px;">
        Merci pour votre commande ! Vos fichiers pour la <strong>parcelle ${parcelRef}</strong>
        a <strong>${commune}</strong> (offre ${offer}) sont disponibles au telechargement ci-dessous.
      </p>

      <!-- File list -->
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:12px 16px;text-align:left;color:#64748b;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Format</th>
            <th style="padding:12px 16px;text-align:right;color:#64748b;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Action</th>
          </tr>
        </thead>
        <tbody>
          ${fileList}
        </tbody>
      </table>

      <!-- Expiration notice -->
      <div style="margin:24px 0;padding:16px;background:#fef3c7;border-radius:8px;border-left:4px solid #f59e0b;">
        <p style="color:#92400e;margin:0;font-size:14px;">
          <strong>Important :</strong> Ces liens sont valides pendant <strong>7 jours</strong>.
          Pensez a telecharger vos fichiers rapidement.
        </p>
      </div>

      <!-- Info parcelle -->
      <div style="padding:16px;background:#f0f9ff;border-radius:8px;">
        <h3 style="color:#1e3a5f;margin:0 0 8px;font-size:15px;">Details de la commande</h3>
        <table style="font-size:14px;color:#475569;">
          <tr><td style="padding:2px 12px 2px 0;font-weight:600;">Parcelle :</td><td>${parcelRef}</td></tr>
          <tr><td style="padding:2px 12px 2px 0;font-weight:600;">Commune :</td><td>${commune}</td></tr>
          <tr><td style="padding:2px 12px 2px 0;font-weight:600;">Offre :</td><td>${offer}</td></tr>
        </table>
      </div>

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">

      <p style="color:#9ca3af;font-size:13px;text-align:center;margin:0;">
        Des questions ? Repondez directement a cet email.<br>
        <a href="https://topo3d-antilles.com" style="color:#2563eb;">topo3d-antilles.com</a>
      </p>
    </div>
  </div>
</body>
</html>`;

  const result = await resend.emails.send({
    from: 'Topo3D Antilles <commandes@topo3d-antilles.com>',
    to: [to],
    bcc: [process.env.ADMIN_EMAIL || 'dereck.rauzduel@gmail.com'],
    subject: `Vos fichiers Topo3D — Parcelle ${parcelRef} (${commune})`,
    html
  });

  console.log(`[email] Sent to ${to}, id: ${result.data?.id}`);
  return result;
}

/**
 * Send error notification to admin
 */
export async function sendErrorNotification(error, orderMeta) {
  await resend.emails.send({
    from: 'Topo3D Antilles <system@topo3d-antilles.com>',
    to: [process.env.ADMIN_EMAIL || 'dereck.rauzduel@gmail.com'],
    subject: `[ERREUR] Generation echouee — ${orderMeta?.section || '?'} ${orderMeta?.numero || '?'}`,
    html: `<pre>${JSON.stringify({ error: error.message, stack: error.stack, meta: orderMeta }, null, 2)}</pre>`
  });
}
