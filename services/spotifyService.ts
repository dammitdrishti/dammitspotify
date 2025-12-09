import { SpotifyTrack, AudioFeatures } from "../types";

// 1. YOUR CLIENT ID
export const CLIENT_ID = "1dbe1040e81d4ca8b1f2e4646d16e9e1"; 

// 2. YOUR EXACT NETLIFY URL (Must match Spotify Dashboard exactly)
const REDIRECT_URI = "https://dammitspotifywrapped.netlify.app/";

const SCOPES = ["user-top-read", "user-read-private", "user-read-email"];

// 🔒 THE REAL, OFFICIAL SPOTIFY ENDPOINTS (Fixed)
const AUTH_ENDPOINT = "https://accounts.spotify.com/authorize";
const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
const API_BASE = "https://api.spotify.com/v1";

// --- Crypto Helpers (PKCE) ---
const generateRandomString = (length: number) => {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values).reduce((acc, x) => acc + possible[x % possible.length], "");
};

const sha256 = async (plain: string) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest("SHA-256", data);
};

const base64encode = (input: ArrayBuffer) => {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
};

// --- Auth Step 1: Redirect to Spotify Login ---
export const redirectToAuthCodeFlow = async () => {
  const verifier = generateRandomString(128);
  const challenge = base64encode(await sha256(verifier));
  localStorage.setItem("verifier", verifier);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: SCOPES.join(" "),
    code_challenge_method: "S256",
    code_challenge: challenge,
  });

  window.location.href = `${AUTH_ENDPOINT}?${params.toString()}`;
};

// --- Auth Step 2: Exchange Code for Token ---
export const getAccessToken = async (code: string): Promise<string> => {
  const verifier = localStorage.getItem("verifier");
  
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier!,
  });

  const result = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  if (!result.ok) {
      const errorText = await result.text();
      console.error("Token Exchange Failed:", errorText);
      throw new Error("Login failed.");
  }

  const { access_token } = await result.json();
  return access_token;
};

// --- API Calls ---

export const fetchTopTracks = async (
  token: string,
  limit: number = 50,
  timeRange: string = "medium_term",
): Promise<SpotifyTrack[]> => {
  const response = await fetch(
    `${API_BASE}/me/top/tracks?limit=${limit}&time_range=${timeRange}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  if (!response.ok) throw new Error("Failed to fetch top tracks");
  const data = await response.json();
  return data.items;
};

export const fetchAudioFeatures = async (
  token: string,
  trackIds: string[],
): Promise<AudioFeatures[]> => {
  if (trackIds.length === 0) return [];

  const chunks = [];
  for (let i = 0; i < trackIds.length; i += 50)
    chunks.push(trackIds.slice(i, i + 50));

  let allFeatures: AudioFeatures[] = [];
  for (const chunk of chunks) {
    const idsParam = chunk.join(",");
    const response = await fetch(`${API_BASE}/audio-features?ids=${idsParam}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.audio_features)
        allFeatures = [...allFeatures, ...data.audio_features];
    }
  }
  return allFeatures.filter((f) => f !== null);
};
