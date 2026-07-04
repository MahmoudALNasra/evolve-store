const { google } = require('googleapis')

const SHEETS_SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

function hasOAuthRefreshToken() {
  return Boolean(
    process.env.GOOGLE_OAUTH_REFRESH_TOKEN
    && process.env.GOOGLE_OAUTH_CLIENT_ID
    && process.env.GOOGLE_OAUTH_CLIENT_SECRET
  )
}

function getOAuthRedirectUri() {
  return process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost'
}

function createOAuth2Client(scopes = SHEETS_SCOPES) {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    getOAuthRedirectUri()
  )
  oauth2.setCredentials({ refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN })
  return oauth2
}

function getGoogleAuth(scopes = SHEETS_SCOPES) {
  if (hasOAuthRefreshToken()) {
    return createOAuth2Client(scopes)
  }

  if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
    return new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes,
    })
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_USE_APPLICATION_DEFAULT === 'true') {
    return new google.auth.GoogleAuth({ scopes })
  }

  throw new Error(
    'Google Sheets auth is not configured. Set GOOGLE_OAUTH_REFRESH_TOKEN + client id/secret, '
    + 'service account credentials, or GOOGLE_USE_APPLICATION_DEFAULT=true with gcloud ADC.'
  )
}

async function getGoogleAuthClient(scopes = SHEETS_SCOPES) {
  const auth = getGoogleAuth(scopes)
  if (hasOAuthRefreshToken()) return auth
  return auth.getClient()
}

module.exports = {
  SHEETS_SCOPES,
  hasOAuthRefreshToken,
  getGoogleAuth,
  getGoogleAuthClient,
  createOAuth2Client,
  getOAuthRedirectUri,
}
