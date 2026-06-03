import type { FlightOffer, FlightSegment, TripType } from './types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseSegment(leg: any): FlightSegment {
  const seg = leg.segments?.[0]
  return {
    origin: leg.origin.displayCode,
    destination: leg.destination.displayCode,
    departsAt: leg.departure,
    arrivesAt: leg.arrival,
    airline: leg.carriers?.marketing?.[0]?.name ?? '',
    flightNo: `${seg?.marketingCarrier?.alternateId ?? ''}${seg?.flightNumber ?? ''}`,
  }
}

export function parseFlightOffers(raw: unknown, tripType: TripType): FlightOffer[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const itineraries: any[] = (raw as any)?.data?.itineraries ?? []

  return itineraries
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter(it => it.legs?.every((l: any) => l.stopCount === 0))
    .map(it => {
      const [outLeg, retLeg] = it.legs
      const offer: FlightOffer = {
        tripType,
        totalAmount: Math.round(it.price.raw),
        outbound: parseSegment(outLeg),
      }
      if (retLeg) offer.return = parseSegment(retLeg)
      return offer
    })
    .sort((a, b) => a.totalAmount - b.totalAmount)
    .slice(0, 5)
}

export function pickCheapest(raw: unknown, tripType: TripType): FlightOffer | null {
  return parseFlightOffers(raw, tripType)[0] ?? null
}
