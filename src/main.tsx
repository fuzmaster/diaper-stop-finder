import { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { seedPlaces } from "./data/seedData";
import { getLocalPlaces, saveLocalPlace, saveLocalReport } from "./lib/localPlaces";
import { isValidEmail, saveEmailSignup } from "./lib/signups";
import type { ChangingTableStatus, Place, PlaceType, RestroomLocation, SeedSignal } from "./types";
import "./styles.css";

const placeTypes: PlaceType[] = ["gas station", "rest stop", "coffee shop", "fast food", "grocery", "big box", "restaurant", "other"];
const statuses: ChangingTableStatus[] = ["yes", "no", "not sure"];
const restroomLocations: RestroomLocation[] = ["men's room", "women's room", "family restroom", "all-gender restroom", "multiple", "unknown"];

const verdictLabels: Record<SeedSignal, string> = {
  good: "GOOD STOP",
  "dad-warning": "DAD WARNING",
  "family-restroom": "FAMILY RESTROOM",
  "needs-check": "NEEDS CHECK",
  skip: "SKIP",
  outdated: "OUTDATED",
  unknown: "NEEDS CHECK",
};

type Coordinates = {
  lat: number;
  lng: number;
};

type PlaceWithDistance = Place & {
  distanceMiles: number | null;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function distanceInMiles(from: Coordinates, place: Place) {
  if (place.lat === null || place.lng === null) {
    return null;
  }

  const earthRadiusMiles = 3958.8;
  const dLat = degreesToRadians(place.lat - from.lat);
  const dLng = degreesToRadians(place.lng - from.lng);
  const lat1 = degreesToRadians(from.lat);
  const lat2 = degreesToRadians(place.lat);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function degreesToRadians(degrees: number) {
  return degrees * (Math.PI / 180);
}

function formatDistance(distance: number | null) {
  return distance === null ? "Distance not available" : `${distance.toFixed(1)} mi away`;
}

function App() {
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [locationMessage, setLocationMessage] = useState("Use your location to sort nearby stops.");
  const [localPlaces, setLocalPlaces] = useState<Place[]>([]);
  const [email, setEmail] = useState("");
  const [wantsToVerify, setWantsToVerify] = useState(false);
  const [signupMessage, setSignupMessage] = useState("");
  const [signupError, setSignupError] = useState("");
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installMessage, setInstallMessage] = useState("Android users can install this as an app. iPhone users can add it from Safari.");
  const [placeForm, setPlaceForm] = useState({
    name: "",
    address: "",
    city: "",
    state: "MA",
    placeType: "gas station" as PlaceType,
    status: "not sure" as ChangingTableStatus,
    location: "unknown" as RestroomLocation,
  });

  useEffect(() => {
    setLocalPlaces(getLocalPlaces());
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator && import.meta.env.PROD) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js");
      });
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setInstallMessage("Install Diaper Stop Finder for quicker diaper stops from your home screen.");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  const places = useMemo<PlaceWithDistance[]>(() => {
    return [...localPlaces, ...seedPlaces]
      .map((place) => ({
        ...place,
        distanceMiles: userLocation ? distanceInMiles(userLocation, place) : null,
      }))
      .sort((a, b) => {
        if (a.distanceMiles === null && b.distanceMiles === null) {
          return a.name.localeCompare(b.name);
        }
        if (a.distanceMiles === null) {
          return 1;
        }
        if (b.distanceMiles === null) {
          return -1;
        }
        return a.distanceMiles - b.distanceMiles;
      });
  }, [localPlaces, userLocation]);

  function handleLocationClick() {
    if (!navigator.geolocation) {
      setLocationMessage("Location is not available in this browser.");
      return;
    }

    setLocationMessage("Checking your location...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationMessage("Nearby stops are sorted by distance.");
      },
      () => setLocationMessage("Location was not allowed. You can still browse and submit stops."),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  function handleSignupSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSignupMessage("");
    setSignupError("");

    const trimmedEmail = email.trim();
    if (!isValidEmail(trimmedEmail)) {
      setSignupError("Enter a valid email address.");
      return;
    }

    saveEmailSignup(trimmedEmail, wantsToVerify);
    setEmail("");
    setWantsToVerify(false);
    setSignupMessage("You're on the list. Thanks for helping map the North Shore.");
  }

  function handlePlaceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitMessage("");
    setSubmitError("");

    const trimmed = {
      ...placeForm,
      name: placeForm.name.trim(),
      address: placeForm.address.trim(),
      city: placeForm.city.trim(),
      state: placeForm.state.trim(),
    };

    if (!trimmed.name || !trimmed.address || !trimmed.city || !trimmed.state) {
      setSubmitError("Fill out the required fields before submitting.");
      return;
    }

    const place = saveLocalPlace(trimmed);
    setLocalPlaces(getLocalPlaces());
    setPlaceForm({
      name: "",
      address: "",
      city: "",
      state: "MA",
      placeType: "gas station",
      status: "not sure",
      location: "unknown",
    });
    setSubmitMessage(`${place.name} was added to your local list.`);
  }

  function handleConfirm(placeId: string, status: ChangingTableStatus) {
    saveLocalReport(placeId, status, "unknown");
    setConfirmMessage(status === "yes" ? "Thanks. Marked as having a changing table." : "Thanks. Marked as not having a changing table.");
  }

  async function handleInstallClick() {
    if (!installPrompt) {
      setInstallMessage("On iPhone, open in Safari, tap Share, then Add to Home Screen.");
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    setInstallMessage(choice.outcome === "accepted" ? "Installed. Diaper Stop Finder is ready from your home screen." : "No problem. You can install it later from your browser menu.");
  }

  return (
    <main>
      <section className="hero">
        <p className="eyebrow">North Shore MVP</p>
        <h1>Find a changing table before the diaper gets urgent.</h1>
        <p>Browse nearby stops, confirm what you find, and add missing places for other parents.</p>
        <button className="primary-button" type="button" onClick={handleLocationClick}>
          Sort by My Location
        </button>
        <p className="helper-text">{locationMessage}</p>
      </section>

      <section className="install-section" aria-labelledby="install-heading">
        <div>
          <p className="eyebrow">Phone ready</p>
          <h2 id="install-heading">Save it for the next emergency stop.</h2>
          <p>{installMessage}</p>
        </div>
        <button className="secondary-button" type="button" onClick={handleInstallClick}>
          Add to Phone
        </button>
      </section>

      <section className="signup-section" aria-labelledby="signup-heading">
        <div>
          <p className="eyebrow">Local mission</p>
          <h2 id="signup-heading">Help map every baby-changing table on the North Shore.</h2>
          <p>Get updates when we launch the full local map, and help verify parent-friendly stops near you.</p>
        </div>
        <form className="stacked-form" onSubmit={handleSignupSubmit}>
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} inputMode="email" autoComplete="email" placeholder="you@example.com" />
          </label>
          <label className="checkbox-row">
            <input checked={wantsToVerify} onChange={(event) => setWantsToVerify(event.target.checked)} type="checkbox" />
            <span>I want to help verify places</span>
          </label>
          <button className="primary-button" type="submit">
            Get Updates
          </button>
          {signupError ? <p className="form-error" aria-live="polite">{signupError}</p> : null}
          {signupMessage ? <p className="form-success" aria-live="polite">{signupMessage}</p> : null}
        </form>
      </section>

      <section aria-labelledby="nearby-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Nearby list</p>
            <h2 id="nearby-heading">Changing table signals</h2>
          </div>
          <span>{places.length} stops</span>
        </div>
        {confirmMessage ? <p className="form-success list-message">{confirmMessage}</p> : null}
        <div className="place-list">
          {places.map((place) => (
            <article className="place-card" key={place.id}>
              <div className="place-card-header">
                <div>
                  <h3>{place.name}</h3>
                  <p>{place.address}, {place.city}, {place.state}</p>
                </div>
                <span className={`verdict verdict-${place.seedSignal}`}>{verdictLabels[place.seedSignal]}</span>
              </div>
              <div className="place-meta">
                <span>{place.placeType}</span>
                <span>{formatDistance(place.distanceMiles)}</span>
              </div>
              <div className="confirm-row">
                <button type="button" onClick={() => handleConfirm(place.id, "yes")}>Has table</button>
                <button type="button" onClick={() => handleConfirm(place.id, "no")}>No table</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="kit-section" aria-labelledby="kit-heading">
        <p className="eyebrow">Car backup plan</p>
        <h2 id="kit-heading">Emergency Diaper Stop Kit</h2>
        <p>Even when a place has a changing table, public bathrooms are unpredictable. Keep a small diaper stop kit in the car so you're never stuck changing your baby on a dirty surface.</p>
        <ul>
          <li>Foldable changing pad</li>
          <li>Disposable changing liners</li>
          <li>Travel wipes</li>
          <li>Diaper trash bags</li>
          <li>Hand sanitizer</li>
          <li>Extra onesie</li>
        </ul>
        {/* TODO: Replace # with an Amazon Associates, Target, Walmart, or other affiliate link when ready. */}
        <a className="secondary-button" href="#">
          Build My Car Kit
        </a>
      </section>

      <section aria-labelledby="submit-heading">
        <p className="eyebrow">Add a place</p>
        <h2 id="submit-heading">Submit a stop</h2>
        <p className="section-intro">Share the basics now. Coordinates can wait until the full map is ready.</p>
        <form className="submit-form" onSubmit={handlePlaceSubmit}>
          <label>
            Place name
            <input value={placeForm.name} onChange={(event) => setPlaceForm({ ...placeForm, name: event.target.value })} autoComplete="organization" placeholder="Store or restaurant name" />
          </label>
          <label>
            Address
            <input value={placeForm.address} onChange={(event) => setPlaceForm({ ...placeForm, address: event.target.value })} autoComplete="street-address" placeholder="Street address" />
          </label>
          <label className="city-field">
            City
            <input value={placeForm.city} onChange={(event) => setPlaceForm({ ...placeForm, city: event.target.value })} autoComplete="address-level2" placeholder="City" />
          </label>
          <label className="state-field">
            State
            <input value={placeForm.state} onChange={(event) => setPlaceForm({ ...placeForm, state: event.target.value })} autoComplete="address-level1" maxLength={2} />
          </label>
          <label>
            Place type
            <select value={placeForm.placeType} onChange={(event) => setPlaceForm({ ...placeForm, placeType: event.target.value as PlaceType })}>
              {placeTypes.map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
          <label>
            Changing table status
            <select value={placeForm.status} onChange={(event) => setPlaceForm({ ...placeForm, status: event.target.value as ChangingTableStatus })}>
              {statuses.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
          <label>
            Location
            <select value={placeForm.location} onChange={(event) => setPlaceForm({ ...placeForm, location: event.target.value as RestroomLocation })}>
              {restroomLocations.map((location) => <option key={location}>{location}</option>)}
            </select>
          </label>
          <button className="primary-button" type="submit">
            Submit Stop
          </button>
          {submitError ? <p className="form-error" aria-live="polite">{submitError}</p> : null}
          {submitMessage ? <p className="form-success" aria-live="polite">{submitMessage}</p> : null}
        </form>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
