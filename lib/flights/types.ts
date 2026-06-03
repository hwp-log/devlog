export type TripType = 'ONE_WAY' | 'ROUND_TRIP'

export type FlightSegment = {
  origin: string
  destination: string
  departsAt: string    // ISO 8601
  arrivesAt: string
  airline: string
  flightNo: string
}

export type FlightOffer = {
  tripType: TripType
  totalAmount: number  // 원(KRW) 정수
  outbound: FlightSegment
  return?: FlightSegment
}

export type SearchFlightsParams = {
  tripType: TripType
  originIata: string
  destinationIata: string
  departDate: string   // YYYY-MM-DD
  returnDate?: string
}

export type AirportIds = {
  skyId: string
  entityId: string
}
