# Spotify Insights App

## Overview
A React-based web application that provides personalized insights into your Spotify listening habits. The app analyzes your top tracks to reveal:
- **Heavy Rotation**: Your most played tracks recently
- **The Underground**: Your niche favorites with the lowest popularity scores
- **Vibe Check**: High-energy bangers or moody tracks based on audio features

This is a client-side only application that uses Spotify's OAuth for authentication and Web API for data retrieval. No backend server is required.

## Technology Stack
- **Frontend Framework**: React 19.2.1 with TypeScript 5.8.2
- **Build Tool**: Vite 6.2.0
- **Styling**: Tailwind CSS (via CDN)
- **Icons**: Lucide React
- **Authentication**: Spotify OAuth 2.0 (Implicit Grant Flow)
- **API**: Spotify Web API

## Project Structure
```
/
├── services/
│   └── spotifyService.ts    # Spotify API integration and OAuth logic
├── App.tsx                   # Main application component with all views
├── index.tsx                 # React entry point
├── index.html                # HTML template with Tailwind CDN
├── types.ts                  # TypeScript type definitions
├── vite.config.ts            # Vite configuration
├── tsconfig.json             # TypeScript configuration
└── package.json              # Dependencies and scripts
```

## Key Features
1. **Spotify OAuth Authentication**: Secure login via Spotify
2. **Heavy Rotation**: Displays your top 10 most played tracks
3. **The Underground**: Shows your 10 least popular favorite tracks
4. **Vibe Check**: Filters tracks by energy (hype) or valence (moody)
5. **Responsive Design**: Works on desktop and mobile devices

## Development Setup
The app runs on port 5000 and is configured for the Replit environment.

### Scripts
- `npm run dev` - Start development server on port 5000
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Configuration Notes
- **Port**: Configured to run on port 5000 for Replit compatibility
- **HMR**: Client port set to 443 for Replit proxy
- **Spotify Client ID**: Embedded in `services/spotifyService.ts`
- **Redirect URI**: Must match the configured Spotify app redirect URI

## Recent Changes
- December 8, 2024: Initial project import to Replit
- Configured Vite for port 5000 and Replit proxy compatibility
- Set up development workflow

## User Preferences
None documented yet.

## How It Works
1. User logs in with Spotify OAuth
2. Access token is stored in localStorage
3. App fetches user's top tracks using Spotify API
4. Different views apply filters and sorting:
   - Heavy Rotation: Standard top tracks
   - Underground: Sorts by popularity (ascending)
   - Vibe Check: Uses Audio Features API to filter by energy or valence
5. Results display as a grid with album art and metadata
