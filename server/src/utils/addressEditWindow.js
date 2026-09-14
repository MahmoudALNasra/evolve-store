const ADDRESS_SUPPORT_EMAIL = process.env.ADDRESS_SUPPORT_EMAIL
  || process.env.NEW_ORDER_NOTIFY_EMAIL
  || 'info@evolvepharmacy.com'

const CHICAGO_TZ = 'America/Chicago'
const EDIT_AFTER_5PM_HOURS = 6

function getChicagoParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: CHICAGO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]))
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  }
}

/** Approximate instant for a Chicago local wall time (handles CST/CDT via offset probe). */
function chicagoLocalToDate({ year, month, day, hour = 0, minute = 0 }) {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0))
  const asChicago = getChicagoParts(utcGuess)
  const desiredAsMinutes = hour * 60 + minute
  const actualAsMinutes = asChicago.hour * 60 + asChicago.minute
  const deltaMinutes = desiredAsMinutes - actualAsMinutes
  return new Date(utcGuess.getTime() + deltaMinutes * 60 * 1000)
}

/**
 * Address edit window (America/Chicago):
 * - Placed at/after 5:00 PM → editable for 6 hours
 * - Placed before 5:00 PM → editable until 5:00 PM the same day
 */
function getAddressEditableUntil(placedAt) {
  const placed = new Date(placedAt)
  if (Number.isNaN(placed.getTime())) return null

  const parts = getChicagoParts(placed)
  if (parts.hour >= 17) {
    return new Date(placed.getTime() + EDIT_AFTER_5PM_HOURS * 60 * 60 * 1000)
  }

  return chicagoLocalToDate({
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: 17,
    minute: 0,
  })
}

function getAddressEditState(order) {
  const supportEmail = ADDRESS_SUPPORT_EMAIL

  if (!order || order.fulfillmentMethod === 'pickup') {
    return {
      canEdit: false,
      reason: 'pickup',
      editableUntil: null,
      supportEmail,
      message: 'Pickup orders use the pharmacy address and cannot be changed here.',
    }
  }

  if (['shipped', 'delivered', 'cancelled'].includes(order.status)) {
    return {
      canEdit: false,
      reason: 'status',
      editableUntil: null,
      supportEmail,
      message: `This order can no longer be changed. Email ${supportEmail} for help.`,
    }
  }

  const placedAt = order.paidAt || order.createdAt
  const editableUntil = getAddressEditableUntil(placedAt)
  if (!editableUntil) {
    return {
      canEdit: false,
      reason: 'unknown',
      editableUntil: null,
      supportEmail,
      message: `Email ${supportEmail} to update your shipping address.`,
    }
  }

  const canEdit = Date.now() < editableUntil.getTime()
  if (canEdit) {
    const parts = getChicagoParts(new Date(placedAt))
    const afterFive = parts.hour >= 17
    return {
      canEdit: true,
      reason: afterFive ? 'after_5pm_window' : 'before_5pm_window',
      editableUntil,
      supportEmail,
      message: afterFive
        ? `Orders placed after 5:00 PM CT can update the shipping address for ${EDIT_AFTER_5PM_HOURS} hours.`
        : 'You can update the shipping address until 5:00 PM CT today (before same-day processing).',
    }
  }

  return {
    canEdit: false,
    reason: 'window_closed',
    editableUntil,
    supportEmail,
    message: `The address change window has closed. Email ${supportEmail} for help.`,
  }
}

module.exports = {
  ADDRESS_SUPPORT_EMAIL,
  getAddressEditableUntil,
  getAddressEditState,
  getChicagoParts,
}
