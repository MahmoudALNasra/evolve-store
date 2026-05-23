import axios from 'axios'

const analyticsApi = axios.create({
  baseURL: '/api/analytics',
  withCredentials: true,
})

/**
 * POST first-party analytics event; HttpOnly cookies are managed by the server.
 * @param {{ event_name: string, event_data?: object, page_url?: string, utm_source?: string, utm_medium?: string, utm_campaign?: string, utm_term?: string, utm_content?: string }} payload
 */
export async function trackAnalyticsEvent(payload) {
  try {
    await analyticsApi.post('/track', {
      ...payload,
      page_url: payload.page_url ?? window.location.href,
    })
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[analytics]', err.response?.data?.message || err.message)
    }
  }
}

export default analyticsApi
