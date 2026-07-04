/**
 * One-time script to obtain GOOGLE_OAUTH_REFRESH_TOKEN for headless server use.
 * Run on your PC (where you can open a browser):
 *
 *   cd server
 *   node src/scripts/googleOAuthRefreshToken.js
 *
 * Add printed refresh token to production .env, then set GOOGLE_USE_APPLICATION_DEFAULT=false.
 */
require('dotenv').config()
const readline = require('readline')
const { google } = require('googleapis')
const { SHEETS_SCOPES, getOAuthRedirectUri } = require('../utils/googleSheetsAuth')

const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET

if (!clientId || !clientSecret) {
  console.error('Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in server/.env first.')
  console.error('Use your Desktop app credentials (evolve-store-droplet).')
  process.exit(1)
}

const redirectUri = getOAuthRedirectUri()
const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri)

const authUrl = oauth2.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: SHEETS_SCOPES,
})

console.log('\n1. Open this URL in your browser:\n')
console.log(authUrl)
console.log('\n2. Sign in and approve access.')
console.log('3. After redirect, your browser may show "cannot connect" — that is OK.')
console.log('   Copy the FULL URL from the address bar (it contains code=...).')
console.log('   Or paste just the code value if Google shows it.\n')

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

rl.question('Paste the authorization code or full redirect URL: ', async (input) => {
  rl.close()
  try {
    let code = input.trim()
    if (code.includes('code=')) {
      const match = code.match(/[?&]code=([^&]+)/)
      code = match ? decodeURIComponent(match[1]) : code
    }

    const { tokens } = await oauth2.getToken(code)
    if (!tokens.refresh_token) {
      console.error('\nNo refresh_token returned. Revoke app access at https://myaccount.google.com/permissions')
      console.error('Then run this script again (prompt=consent forces a new refresh token).')
      process.exit(1)
    }

    console.log('\nAdd these to production server/.env:\n')
    console.log(`GOOGLE_OAUTH_CLIENT_ID=${clientId}`)
    console.log(`GOOGLE_OAUTH_CLIENT_SECRET=${clientSecret}`)
    console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}`)
    console.log('GOOGLE_USE_APPLICATION_DEFAULT=false')
    console.log('\nThen: pm2 restart evolve-api --update-env && npm run inventory:sync\n')
    process.exit(0)
  } catch (err) {
    console.error('\nFailed:', err.message)
    process.exit(1)
  }
})
