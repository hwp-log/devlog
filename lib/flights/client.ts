import 'server-only'
import type { AirportIds } from './types'

const BASE = 'https://sky-scrapper.p.rapidapi.com'
const TIMEOUT_MS = 15_000

function rapidHeaders() {
  const key = process.env.RAPID_API_KEY
  if (!key) throw new Error('RAPID_API_KEY missing')
  return {
    'x-rapidapi-host': 'sky-scrapper.p.rapidapi.com',
    'x-rapidapi-key': key,
  }
}

async function get(url: string, revalidate: number): Promise<unknown> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      headers: rapidHeaders(),
      signal: ctrl.signal,
      next: { revalidate },
    })
    if (res.status === 429) {
      const wait = Number(res.headers.get('Retry-After') ?? 5) * 1000
      await new Promise(r => setTimeout(r, wait))
      return get(url, revalidate)
    }
    if (!res.ok) throw new Error(`Sky Scrapper ${res.status}`)
    return res.json()
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchAirportIds(iata: string): Promise<AirportIds | null> {
  const url = `${BASE}/api/v1/flights/searchAirport?query=${iata}&locale=ko-KR`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await get(url, 86_400) as any
  const match = (data?.data ?? []).find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (item: any) => item.navigation?.relevantFlightParams?.skyId === iata.toUpperCase()
  )
  if (!match) return null
  const p = match.navigation.relevantFlightParams
  return { skyId: p.skyId, entityId: p.entityId }
}

export async function fetchFlights(
  origin: AirportIds,
  dest: AirportIds,
  departDate: string,
  returnDate?: string,
): Promise<unknown> {
  const params = new URLSearchParams({
    originSkyId: origin.skyId,
    destinationSkyId: dest.skyId,
    originEntityId: origin.entityId,
    destinationEntityId: dest.entityId,
    date: departDate,
    currency: 'KRW',
    countryCode: 'KR',
    market: 'ko-KR',
    sortBy: 'best',
    adults: '1',
    cabinClass: 'economy',
  })
  if (returnDate) params.set('returnDate', returnDate)
  return get(`${BASE}/api/v2/flights/searchFlights?${params}`, 300)
}
