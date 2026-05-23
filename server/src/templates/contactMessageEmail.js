const escapeText = (value) => String(value || '').trim()

const buildContactMessageEmail = ({ name, email, phone, subject, message }) => {
  const cleanName = escapeText(name)
  const cleanEmail = escapeText(email)
  const cleanPhone = escapeText(phone)
  const cleanSubject = escapeText(subject)
  const cleanMessage = escapeText(message) || 'No message provided.'

  const emailSubject = `New contact form message — ${cleanSubject}`

  const text = `New contact form message

Name: ${cleanName}
Email: ${cleanEmail}
Phone: ${cleanPhone}
Subject: ${cleanSubject}

Message:
${cleanMessage}
`

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f6f4;color:#333;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f4;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:600px;">
        <tr><td style="background:#0d0d0d;padding:24px 32px;border-bottom:3px solid #c9a227;">
          <h1 style="margin:0;color:#fff;font-size:22px;">Contact Form Message</h1>
          <p style="margin:8px 0 0;color:#c9a227;font-size:14px;">${cleanSubject}</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px;"><strong>Name:</strong> ${cleanName}</p>
          <p style="margin:0 0 8px;"><strong>Email:</strong> <a href="mailto:${cleanEmail}" style="color:#a68520;">${cleanEmail}</a></p>
          <p style="margin:0 0 8px;"><strong>Phone:</strong> <a href="tel:${cleanPhone}" style="color:#a68520;">${cleanPhone}</a></p>
          <p style="margin:0 0 20px;"><strong>Subject:</strong> ${cleanSubject}</p>
          <div style="background:#f8f6f0;border-radius:6px;padding:16px;line-height:1.6;white-space:pre-wrap;">${cleanMessage}</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  return { subject: emailSubject, text, html }
}

module.exports = { buildContactMessageEmail }
