export type PlaceType =
  | "gas station"
  | "rest stop"
  | "coffee shop"
  | "fast food"
  | "grocery"
  | "big box"
  | "restaurant"
  | "other";

export type ChangingTableStatus = "yes" | "no" | "not sure";

export type RestroomLocation =
  | "men's room"
  | "women's room"
  | "family restroom"
  | "all-gender restroom"
  | "multiple"
  | "unknown";

export type SeedSignal = "good" | "dad-warning" | "family-restroom" | "needs-check" | "skip" | "outdated" | "unknown";

export type Place = {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  lat: number | null;
  lng: number | null;
  placeType: PlaceType;
  seedSignal: SeedSignal;
};

export type LocalReport = {
  id: string;
  placeId: string;
  status: ChangingTableStatus;
  location: RestroomLocation;
  createdAt: string;
};

export type EmailSignup = {
  id: string;
  email: string;
  wantsToVerify: boolean;
  createdAt: string;
};
