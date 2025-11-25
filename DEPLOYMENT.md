# Casino App Deployment Guide

## Production Deployment with Apache Reverse Proxy

### Overview

The recommended production setup:
- **Frontend**: Built static files served by Apache
- **Backend**: Node.js server running on port 3000
- **Apache**: Reverse proxy for `/api` and `/socket.io` to backend

### What You DON'T Need to Change

- ✅ `vite.config.js` - Only used in development
- ✅ `src/services/api.js` - Already uses relative `/api` paths
- ✅ `.env.production` - Already configured for same-origin deployment

### Deployment Steps

#### 1. Backend Setup

```bash
# On your production server
cd /var/www/casino/backend

# Install dependencies
npm install --production

# Configure environment
cp .env.example .env
nano .env  # Edit with production values:
# - Set JWT_SECRET to a secure random string
# - Configure PostgreSQL connection
# - Set FRONTEND_URL to your domain (for CORS)

# Initialize database
npm run init-db

# Start backend (use PM2 or systemd for process management)
npm install -g pm2
pm2 start src/server.js --name casino-backend
pm2 save
pm2 startup
```

#### 2. Frontend Build

```bash
# On your local machine or CI/CD
cd frontend
npm install
npm run build

# This creates frontend/dist/ with static files
# Upload dist/ contents to /var/www/casino/frontend/dist
```

#### 3. Apache Configuration

```bash
# Enable required Apache modules
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2enmod proxy_wstunnel
sudo a2enmod rewrite

# Copy the example config
sudo cp apache.conf.example /etc/apache2/sites-available/casino.conf

# Edit to match your domain/paths
sudo nano /etc/apache2/sites-available/casino.conf

# Enable site
sudo a2ensite casino.conf

# Test config
sudo apache2ctl configtest

# Restart Apache
sudo systemctl restart apache2
```

#### 4. Backend Environment Variables

Edit `/var/www/casino/backend/.env`:

```env
PORT=3000
JWT_SECRET=your-very-secure-random-secret-key-here
NODE_ENV=production
FRONTEND_URL=https://casino.yourdomain.com

# PostgreSQL Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=casino
POSTGRES_USER=casino_user
POSTGRES_PASSWORD=secure-password-here
```

### How It Works

1. **User visits** `https://casino.yourdomain.com`
   - Apache serves static files from `frontend/dist/`

2. **Frontend makes API call** to `/api/auth/login`
   - Apache proxies to `http://localhost:3000/api/auth/login`
   - Backend processes and responds

3. **Frontend connects WebSocket** to same origin
   - Socket.io connects to `https://casino.yourdomain.com/socket.io`
   - Apache proxies WebSocket to `http://localhost:3000/socket.io`
   - Real-time game updates work seamlessly

### Alternative: Separate Backend Domain

If you want backend on a different domain (e.g., `api.casino.com`):

1. **Update frontend/.env.production**:
```env
VITE_API_BASE_URL=https://api.casino.com
```

2. **Rebuild frontend**:
```bash
npm run build
```

3. **Configure CORS** on backend properly

4. **No Apache proxy needed** for API (but you'll still need it for serving frontend)

### Process Management (PM2)

```bash
# Start backend
pm2 start src/server.js --name casino-backend

# View logs
pm2 logs casino-backend

# Restart after code changes
pm2 restart casino-backend

# Monitor
pm2 monit
```

### SSL/HTTPS (Recommended)

Use Let's Encrypt for free SSL certificates:

```bash
sudo apt install certbot python3-certbot-apache
sudo certbot --apache -d casino.yourdomain.com
```

This automatically configures HTTPS in Apache.

### Troubleshooting

**Socket.io not connecting:**
- Check that `proxy_wstunnel` module is enabled
- Verify WebSocket proxy rules in Apache config
- Check browser console for connection errors

**API calls failing:**
- Check backend is running: `pm2 status`
- Check Apache proxy config: `sudo apache2ctl configtest`
- Check backend logs: `pm2 logs casino-backend`

**CORS errors:**
- Verify `FRONTEND_URL` in backend `.env` matches your domain
- Check that Apache `ProxyPreserveHost On` is set
