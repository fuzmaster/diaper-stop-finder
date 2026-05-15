import type { ChangingTableStatus, LocalReport, Place, PlaceType, RestroomLocation } from "../types";
import { readStorage, writeStorage } from "./storage";

const LOCAL_PLACES_KEY = "diaper-stop-finder:local-places";
const LOCAL_REPORTS_KEY = "diaper-stop-finder:local-reports";

export type LocalPlaceInput = {
  name: string;
  address: string;
  city: string;
  state: string;
  placeType: PlaceType;
  status: ChangingTableStatus;
  location: RestroomLocation;
};

export function getLocalPlaces() {
  return readStorage<Place[]>(LOCAL_PLACES_KEY, []);
}

export function getLocalReports() {
  return readStorage<LocalReport[]>(LOCAL_REPORTS_KEY, []);
}

export function saveLocalReport(placeId: string, status: ChangingTableStatus, location: RestroomLocation) {
  const report: LocalReport = {
    id: `local-report-${crypto.randomUUID()}`,
    placeId,
    status,
    location,
    createdAt: new Date().toISOString(),
  };

  writeStorage(LOCAL_REPORTS_KEY, [report, ...getLocalReports()]);
  return report;
}

export function saveLocalPlace(input: LocalPlaceInput) {
  const place: Place = {
    id: `local-place-${crypto.randomUUID()}`,
    name: input.name,
    address: input.address,
    city: input.city,
    state: input.state.toUpperCase(),
    lat: null,
    lng: null,
    placeType: input.placeType,
    seedSignal: "unknown",
  };

  writeStorage(LOCAL_PLACES_KEY, [place, ...getLocalPlaces()]);

  if (input.status === "yes" || input.status === "no") {
    saveLocalReport(place.id, input.status, input.location);
  }

  return place;
}
