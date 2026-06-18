# TourFinder

Find upcoming concerts from your most-liked Spotify artists, sorted by date or distance, with direct ticket links.

---

## Deploy in 5 steps

### 1. Push to GitHub
Create a new repo on GitHub, then:
```bash
cd tourfinderapp
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_USERNAME/tourfinderapp.git
git push -u origin main
```

### 2. Connect to Vercel
- Go to vercel.com → Add New Project
- Import your GitHub repo
- Click Deploy (let it build once — it will fail on OAuth until step 3)

### 3. Add environment variables in Vercel
Go to: Project → Settings → Environment Variables

Add these three:
```
SPOTIFY_CLIENT_ID      = 5b6cf33c5e0c46838ca0a2a75c25103a
SPOTIFY_CLIENT_SECRET  = 5966e398777845b68fc3a0747820d053
SPOTIFY_REDIRECT_URI   = https://YOUR-APP-NAME.vercel.app/api/callback
```

Then go to: Deployments → click the three dots on latest → Redeploy

### 4. Add your Vercel URL to Spotify
- Go to developer.spotify.com → Your App → Edit Settings
- Under Redirect URIs, add: `https://YOUR-APP-NAME.vercel.app/api/callback`
- Click Save

### 5. Add beta users
- Go to developer.spotify.com → Your App → User Management
- Add each friend's Spotify email (up to 25 in dev mode)

---

## Local development

```bash
npm install
```

Create `.env.local`:
```
SPOTIFY_CLIENT_ID=5b6cf33c5e0c46838ca0a2a75c25103a
SPOTIFY_CLIENT_SECRET=5966e398777845b68fc3a0747820d053
SPOTIFY_REDIRECT_URI=http://localhost:3000/api/callback
```

Also add `http://localhost:3000/api/callback` to your Spotify app's Redirect URIs.

Then run:
```bash
npx vercel dev
```
(Use `vercel dev` not `npm run dev` — it runs the serverless API functions locally)

---

## Stack
- React + Vite (frontend)
- Vercel Serverless Functions (OAuth backend)
- Spotify Web API (liked songs library)
- Bandsintown API (concert data)
- Zippopotam.us (ZIP → coordinates)
