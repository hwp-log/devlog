export type LocalSpot = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  order: number;
  photoUrl?: string | null;
  review?: string | null;
  address?: string | null;
  description?: string | null;
};
