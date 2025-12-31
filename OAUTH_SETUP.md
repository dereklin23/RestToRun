# OAuth Setup Guide for RestToRun

This guide will help you set up OAuth authentication for Strava and Oura Ring.

## 🔐 Why OAuth?

OAuth allows users to securely connect their Strava and Oura accounts without sharing passwords. Each user's data is accessed using their own credentials.

## 📋 Prerequisites

- Node.js v18 or higher
- A Strava account
- An Oura Ring account

## 🚀 Setup Steps

### 1. Install Dependencies

```bash
npm install
```

The OAuth packages (`express-session`, `cookie-parser`) are already installed.

### 2. Set Up Strava OAuth App

1. Go to [Strava API Settings](https://www.strava.com/settings/api)
2. Create an application if you haven't already
3. Set the **Authorization Callback Domain** to: `localhost` (for local development)
   - For production, use your actual domain (e.g., `yourdomain.com`)
4. Note down your:
   - **Client ID**
   - **Client Secret**

### 3. Set Up Oura OAuth App

1. Go to [Oura Cloud OAuth Applications](https://cloud.ouraring.com/oauth/applications)
2. Click "Create New Application"
3. Fill in the application details:
   - **Name**: RestToRun (or your preferred name)
   - **Redirect URI**: `http://localhost:3000/auth/oura/callback`
     - For production: `https://yourdomain.com/auth/oura/callback`
4. Note down your:
   - **Client ID**
   - **Client Secret**

### 4. Configure Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your credentials:
   ```env
   # Generate a random secret for sessions
   SESSION_SECRET=your-random-secret-key-here
   
   # Server configuration
   NODE_ENV=development
   CALLBACK_URL=http://localhost:3000
   
   # Strava OAuth credentials
   STRAVA_CLIENT_ID=your_actual_strava_client_id
   STRAVA_CLIENT_SECRET=your_actual_strava_client_secret
   
   # Oura OAuth credentials
   OURA_CLIENT_ID=your_actual_oura_client_id
   OURA_CLIENT_SECRET=your_actual_oura_client_secret
   ```

3. **Generate a secure SESSION_SECRET**:
   ```bash
   # On Mac/Linux:
   openssl rand -base64 32
   
   # Or use Node.js:
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

### 5. Start the Server

```bash
npm start
```

The server will start at `http://localhost:3000`

### 6. Test the OAuth Flow

1. Open your browser and go to `http://localhost:3000`
2. You'll be redirected to the login page
3. Click "Connect Strava" and authorize the app
4. Click "Connect Oura" and authorize the app
5. Once both are connected, you'll be able to access your dashboard!

## 🔄 OAuth Flow

Here's how the authentication works:

1. **User clicks "Connect Strava"**
   - Redirects to Strava's authorization page
   - User approves access
   - Strava redirects back with a code
   - Server exchanges code for access token
   - Token is stored in user's session

2. **User clicks "Connect Oura"**
   - Similar flow for Oura Ring
   - Token stored in session

3. **Access Dashboard**
   - Both tokens must be present
   - Tokens are used to fetch data from APIs
   - Sessions last for 30 days

## 🔒 Security Notes

- **Never commit `.env` to git** - it's already in `.gitignore`
- **Use HTTPS in production** - set `NODE_ENV=production` and `secure: true` for cookies
- **Generate a strong SESSION_SECRET** - use the commands above
- **Update CALLBACK_URL** - must match your actual domain in production

## 🎯 Production Deployment

When deploying to production:

1. Update `.env`:
   ```env
   NODE_ENV=production
   CALLBACK_URL=https://yourdomain.com
   ```

2. Update OAuth app settings:
   - **Strava**: Add `yourdomain.com` to Authorization Callback Domain
   - **Oura**: Update Redirect URI to `https://yourdomain.com/auth/oura/callback`

3. Ensure HTTPS is enabled (required for OAuth)

4. Set secure session cookies (automatically done when `NODE_ENV=production`)

## 🐛 Troubleshooting

### "Strava auth failed" error
- Check that `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET` are correct
- Verify Authorization Callback Domain in Strava API settings
- Check browser console for errors

### "Oura auth failed" error
- Check that `OURA_CLIENT_ID` and `OURA_CLIENT_SECRET` are correct
- Verify Redirect URI matches exactly in Oura OAuth settings
- Make sure redirect URI includes `/auth/oura/callback`

### Session not persisting
- Check that `SESSION_SECRET` is set
- Verify cookies are enabled in your browser
- For production, ensure HTTPS is working

### "Both accounts must be connected" message
- You need to authorize both Strava AND Oura
- Click each "Connect" button and complete authorization
- Check `/auth/status` endpoint to see which are connected

## 📚 API Reference

### Auth Endpoints

- `GET /auth/strava` - Start Strava OAuth flow
- `GET /auth/strava/callback` - Strava OAuth callback
- `GET /auth/oura` - Start Oura OAuth flow
- `GET /auth/oura/callback` - Oura OAuth callback
- `GET /auth/status` - Check connection status (JSON)
- `GET /auth/logout` - Log out and clear session

### App Routes

- `GET /` - Redirect to login or dashboard based on auth status
- `GET /login.html` - Login page
- `GET /dashboard` - Main dashboard (requires auth)
- `GET /data` - API endpoint for fitness data (requires auth)

## 🎉 Success!

Once both services are connected, you can:
- View your running data from Strava
- See your sleep and readiness data from Oura
- Track correlations between training and recovery
- Access historical data with date range filters

Enjoy using RestToRun! 🏃‍♂️💤

