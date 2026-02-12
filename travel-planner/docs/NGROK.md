# Expose local dev server with ngrok

Quick steps to expose your local Next.js dev server over the internet.

1. Install ngrok (one-time)

```powershell
npm install -g ngrok
# or download from https://ngrok.com/download
```

2. (Optional) If you want a stable hostname, sign up at ngrok and set your authtoken:

```powershell
ngrok authtoken <YOUR_AUTHTOKEN>
```

3. Start your Next dev server (in one terminal):

```powershell
cd "c:\Users\Paweu\Desktop\inz.v2\travel-planner"
npm run dev
# confirm local site: http://localhost:3000
```

4. Start ngrok tunnel (in another terminal):

```powershell
cd "c:\Users\Paweu\Desktop\inz.v2\travel-planner"
npm run tunnel
# or for EU region: npm run tunnel:eu
```

5. Copy the https://*.ngrok.io URL printed by ngrok and open it in your browser.

Notes
- Ensure your `.env.local` (Database URL, etc.) is configured before starting `npm run dev` so the local server can connect to required services.
- If your app sets secure cookies only in production, the dev server may set cookies differently. Using the HTTPS ngrok URL usually works.
- Uploaded files stored on disk remain local to your machine.
- If you need persistent hostnames, configure them via your ngrok account and `ngrok authtoken`.
