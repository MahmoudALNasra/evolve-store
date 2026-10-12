const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const escapeText = (value) => String(value ?? '').trim()

const formatDob = (value) => {
  const raw = escapeText(value)
  if (!raw) return '—'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

const buildPrescriptionNotificationEmail = (prescription) => {
  const type = prescription.type === 'transfer' ? 'transfer' : 'refill'
  const typeLabel = type === 'refill' ? 'Refill' : 'Transfer'
  const patientName = escapeText(prescription.patientName)
  const email = escapeText(prescription.email)
  const phone = escapeText(prescription.phone)
  const preferred = escapeText(prescription.preferredContactMethod) || 'phone'
  const notes = escapeText(prescription.notes)
  const id = escapeText(prescription._id)

  const emailSubject = `New ${typeLabel.toLowerCase()} prescription request — ${patientName || 'patient'}`

  let detailsText = ''
  let detailsHtml = ''

  if (type === 'refill') {
    const rx = escapeText(prescription.prescriptionNumber) || '—'
    const med = escapeText(prescription.medicationName) || '—'
    detailsText = `Prescription #: ${rx}
Medication: ${med}`
    detailsHtml = `
          <p style="margin:0 0 8px;"><strong>Prescription #:</strong> ${escapeHtml(rx)}</p>
          <p style="margin:0 0 8px;"><strong>Medication:</strong> ${escapeHtml(med)}</p>`
  } else {
    const pharmacy = escapeText(prescription.currentPharmacyName) || '—'
    const pharmacyPhone = escapeText(prescription.currentPharmacyPhone) || '—'
    const pharmacyAddress = escapeText(prescription.currentPharmacyAddress) || '—'
    const meds = Array.isArray(prescription.medications) ? prescription.medications : []
    const medLines = meds.length
      ? meds
          .map((m, i) => {
            const name = escapeText(m.name) || '—'
            const dosage = escapeText(m.dosage)
            const rx = escapeText(m.prescriptionNumber)
            return `${i + 1}. ${name}${dosage ? ` (${dosage})` : ''}${rx ? ` — Rx # ${rx}` : ''}`
          })
          .join('\n')
      : '—'
    const medHtml = meds.length
      ? `<ul style="margin:0;padding-left:18px;">${meds
          .map((m) => {
            const name = escapeHtml(escapeText(m.name) || '—')
            const dosage = escapeHtml(escapeText(m.dosage))
            const rx = escapeHtml(escapeText(m.prescriptionNumber))
            return `<li style="margin:0 0 6px;">${name}${dosage ? ` <span style="color:#6b7280;">(${dosage})</span>` : ''}${rx ? ` — Rx # ${rx}` : ''}</li>`
          })
          .join('')}</ul>`
      : '<p style="margin:0;">—</p>'

    detailsText = `Current pharmacy: ${pharmacy}
Pharmacy phone: ${pharmacyPhone}
Pharmacy address: ${pharmacyAddress}

Medications:
${medLines}`
    detailsHtml = `
          <p style="margin:0 0 8px;"><strong>Current pharmacy:</strong> ${escapeHtml(pharmacy)}</p>
          <p style="margin:0 0 8px;"><strong>Pharmacy phone:</strong> ${escapeHtml(pharmacyPhone)}</p>
          <p style="margin:0 0 16px;"><strong>Pharmacy address:</strong> ${escapeHtml(pharmacyAddress)}</p>
          <p style="margin:0 0 8px;"><strong>Medications:</strong></p>
          ${medHtml}`
  }

  const text = `New ${typeLabel.toLowerCase()} prescription request

Request ID: ${id}
Type: ${typeLabel}

Patient: ${patientName}
Date of birth: ${formatDob(prescription.dateOfBirth)}
Phone: ${phone}
Email: ${email}
Preferred contact: ${preferred}

${detailsText}

Notes:
${notes || 'None'}

View in admin: /admin/prescriptions
`

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f6f4;color:#333;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f4;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:600px;">
        <tr><td style="background:#0d0d0d;padding:24px 32px;border-bottom:3px solid #c9a227;">
          <h1 style="margin:0;color:#fff;font-size:22px;">${escapeHtml(typeLabel)} Prescription Request</h1>
          <p style="margin:8px 0 0;color:#c9a227;font-size:14px;">${escapeHtml(patientName)}</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px;"><strong>Request ID:</strong> ${escapeHtml(id)}</p>
          <p style="margin:0 0 20px;"><strong>Type:</strong> ${escapeHtml(typeLabel)}</p>
          <p style="margin:0 0 8px;"><strong>Patient:</strong> ${escapeHtml(patientName)}</p>
          <p style="margin:0 0 8px;"><strong>Date of birth:</strong> ${escapeHtml(formatDob(prescription.dateOfBirth))}</p>
          <p style="margin:0 0 8px;"><strong>Phone:</strong> <a href="tel:${escapeHtml(phone)}" style="color:#a68520;">${escapeHtml(phone)}</a></p>
          <p style="margin:0 0 8px;"><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}" style="color:#a68520;">${escapeHtml(email)}</a></p>
          <p style="margin:0 0 20px;"><strong>Preferred contact:</strong> ${escapeHtml(preferred)}</p>
          ${detailsHtml}
          <p style="margin:20px 0 8px;"><strong>Notes:</strong></p>
          <div style="background:#f8f6f0;border-radius:6px;padding:16px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(notes || 'None')}</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  return { subject: emailSubject, text, html }
}

module.exports = { buildPrescriptionNotificationEmail }
