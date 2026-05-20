/**
 * Password policy (enforced on both server and client):
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one digit
 * - At least one special character (!@#$%^&*...)
 * - No spaces
 */
function validatePassword(password) {
  const errors = []
  if (!password || password.length < 8)
    errors.push('At least 8 characters')
  if (!/[A-Z]/.test(password))
    errors.push('At least one uppercase letter')
  if (!/[a-z]/.test(password))
    errors.push('At least one lowercase letter')
  if (!/[0-9]/.test(password))
    errors.push('At least one number')
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password))
    errors.push('At least one special character (e.g. !@#$%)')
  if (/\s/.test(password))
    errors.push('No spaces allowed')
  return errors
}

module.exports = validatePassword
