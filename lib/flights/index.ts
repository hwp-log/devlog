import { fetchAirportIds, fetchFlights } from './client'
import { parseFlightOffers, pickCheapest } from './parser'
import type { SearchFlightsParams, FlightOffer } from './types'

export type { FlightOffer, FlightSegment, SearchFlightsParams, TripType } from './types'

export async function searchFlights(
  params: SearchFlightsParams,
): Promise<FlightOffer[]> {
  const [origin, dest] = await Promise.all([
    fetchAirportIds(params.originIata),
    fetchAirportIds(params.destinationIata),
  ])
  if (!origin || !dest) return []

  const raw = await fetchFlights(origin, dest, params.departDate, params.returnDate)
  return parseFlightOffers(raw, params.tripType)
}

export { pickCheapest }
