export enum AppView {
  LOGIN = "LOGIN",
  DASHBOARD = "DASHBOARD",
  VIBE_MENU = "VIBE_MENU",
  SELECTION = "SELECTION",
  RESULTS = "RESULTS",
}

export enum VibeMode {
  BEAST = "Beast Mode",
  MAIN_CHAR = "Main Character",
  VILLAIN = "Villain Arc",
  LATE_NIGHT = "Late Night Drive",
  DOOMSCROLLING = "Doomscrolling",
  TIME_TRAVELER = "Time Traveler",
}

export interface SpotifyImage {
  height: number;
  url: string;
  width: number;
}

export interface SpotifyArtist {
  external_urls: { spotify: string };
  name: string;
  id: string;
}

export interface SpotifyAlbum {
  images: SpotifyImage[];
  name: string;
  release_date: string;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
  external_urls: { spotify: string };
  popularity: number;
  uri: string;
  phase?: number; // 1 = Jan-Apr, 2 = May-Aug, 3 = Sep-Dec
}

export interface AudioFeatures {
  id: string;
  energy: number;
  valence: number;
  danceability: number;
  tempo: number;
}
