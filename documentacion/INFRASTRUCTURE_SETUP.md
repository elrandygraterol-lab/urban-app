# Infrastructure Setup: Mapbox + OSRM Migration

## Overview

This document describes the infrastructure setup for the Mapbox + OSRM migration.

## Phase 3.1: Deploy OSRM Server (Self-Hosted)

### Requirements

- Docker and Docker Compose installed
- 2GB RAM minimum, 2 CPU cores
- 5-10GB disk space (depends on region)
- Internet connection for initial setup

### Quick Start (Local Development)

**Step 1: Download and prepare OSM data**

For Windows (PowerShell):
```powershell
cd backend
.\scripts\setup-osrm.ps1 -Region argentina
```

For Linux/Mac (Bash):
```bash
cd backend
chmod +x scripts/setup-osrm.sh
./scripts/setup-osrm.sh argentina
```

**Step 2: Start OSRM server**

```bash
docker-compose -f docker-compose.osrm.yml up -d
```

**Step 3: Verify OSRM is running**

```bash
curl http://localhost:5000/status
```

Expected response:
```json
{
  "status": 0,
  "message": "Ok"
}
```

### Production Deployment

For production, deploy on a VPS:

**1. Provision VPS**
- Provider: AWS, DigitalOcean, Linode, etc.
- Instance: 2GB RAM, 2 CPU minimum
- OS: Ubuntu 20.04 LTS or later
- Storage: 20GB SSD

**2. Install Docker**

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

**3. Download OSM data and setup OSRM**

```bash
# SSH into VPS
ssh user@your-vps-ip

# Clone repository or copy setup script
git clone <your-repo>
cd backend

# Run setup script
./scripts/setup-osrm.sh argentina
```

**4. Start OSRM**

```bash
docker-compose -f docker-compose.osrm.yml up -d
```

**5. Configure firewall**

```bash
# Allow port 5000 (OSRM)
sudo ufw allow 5000/tcp

# Restrict to backend server only (recommended)
sudo ufw allow from <backend-server-ip> to any port 5000
```

**6. Update backend .env**

```
OSRM_URL=http://your-vps-ip:5000
```

### Supported Regions

Download OSM data from Geofabrik:
- Argentina: `argentina-latest.osm.pbf`
- Brazil: `brazil-latest.osm.pbf`
- Mexico: `mexico-latest.osm.pbf`
- Colombia: `colombia-latest.osm.pbf`
- Peru: `peru-latest.osm.pbf`
- Chile: `chile-latest.osm.pbf`

Full list: https://download.geofabrik.de/

### OSRM Services

Once running, OSRM provides these endpoints:

- **Routing**: `/route/v1/driving/{lon1},{lat1};{lon2},{lat2}`
- **Distance Matrix**: `/table/v1/driving/{coordinates}`
- **Nearest**: `/nearest/v1/driving/{lon},{lat}`
- **Matching**: `/match/v1/driving/{coordinates}`
- **Trip**: `/trip/v1/driving/{coordinates}`

Example:
```bash
curl 'http://localhost:5000/route/v1/driving/-74.0060,40.7128;-73.9855,40.7580?overview=full'
```

### Monitoring OSRM

Check logs:
```bash
docker-compose -f docker-compose.osrm.yml logs -f osrm
```

Check resource usage:
```bash
docker stats osrm
```

Restart OSRM:
```bash
docker-compose -f docker-compose.osrm.yml restart osrm
```

Stop OSRM:
```bash
docker-compose -f docker-compose.osrm.yml down
```

## Phase 3.2: Configure Mapbox API

### Create Mapbox Account

1. Go to https://www.mapbox.com
2. Sign up for a free account
3. Create a new project
4. Generate API token with scopes:
   - `geocoding:read`
   - `search:read`
   - `tiles:read`

### Update .env

```
MAPBOX_API_KEY=your_mapbox_api_key_here
```

### Verify Configuration

```bash
curl "https://api.mapbox.com/geocoding/v5/mapbox.places/times%20square.json?access_token=YOUR_API_KEY"
```

## Phase 3.3: Set Up Monitoring and Alerting

### Monitoring Service

The `mapsMonitoringService` automatically monitors:
- OSRM availability and response times
- Mapbox API quota usage
- Service health and uptime

### Start Monitoring

```typescript
import { mapsMonitoringService } from './services/mapsMonitoringService';

// Start monitoring (checks every 60 seconds)
mapsMonitoringService.startMonitoring(60000);
```

### API Endpoints

- `GET /api/infrastructure/health` - Service health status
- `GET /api/infrastructure/metrics` - Performance metrics
- `GET /api/infrastructure/alerts` - Recent alerts
- `POST /api/infrastructure/alerts/clear` - Clear alerts

## Phase 3.4: Create Database Backups

### Backup Service

The `backupService` handles database backups:
- Automatic daily backups
- Keeps last 7 backups
- Supports restore operations

### Start Auto Backups

```typescript
import { backupService } from './services/backupService';

// Start daily backups
backupService.startAutoBackup(86400000); // 24 hours
```

### Manual Backup

```bash
# Create backup
curl -X POST http://localhost:3000/api/infrastructure/backups/create

# List backups
curl http://localhost:3000/api/infrastructure/backups

# Restore backup
curl -X POST http://localhost:3000/api/infrastructure/backups/restore \
  -H "Content-Type: application/json" \
  -d '{"filename":"backup-1234567890.sql"}'
```

## Configuration Files

- `backend/config/osrm-config.ts` - OSRM configuration
- `backend/config/mapbox-config.ts` - Mapbox configuration
- `backend/src/services/mapsMonitoringService.ts` - Monitoring service
- `backend/src/services/backupService.ts` - Backup service
- `backend/src/routes/infrastructureRoutes.ts` - Infrastructure API endpoints
- `backend/docker-compose.osrm.yml` - Docker Compose for OSRM
- `backend/scripts/setup-osrm.sh` - Setup script (Linux/Mac)
- `backend/scripts/setup-osrm.ps1` - Setup script (Windows)

## Cost Tracking

### Expected Costs

- **OSRM**: $10-30/month (self-hosted VPS)
- **Mapbox**: $0-50/month (free tier: 50,000 requests/month)
- **Total**: $10-30/month (fixed)

### Cost Reduction vs Google Maps

- **Google Maps**: $100-200+/month (variable, scales with usage)
- **Mapbox + OSRM**: $10-30/month (fixed)
- **Savings**: 75-90% reduction

## Troubleshooting

### OSRM not responding

```bash
# Check if container is running
docker ps | grep osrm

# Check logs
docker-compose -f docker-compose.osrm.yml logs osrm

# Restart container
docker-compose -f docker-compose.osrm.yml restart osrm
```

### High memory usage

OSRM uses significant memory for large regions. If experiencing issues:
- Use a smaller region
- Increase VPS RAM
- Use a different profile (e.g., foot instead of car)

### Slow response times

- Check network latency to OSRM server
- Verify OSRM has sufficient resources
- Consider using a CDN or caching layer

## Next Steps

1. Set up OSRM self-hosted instance
2. Configure Mapbox API key
3. Start monitoring service
4. Configure automatic backups
5. Proceed with Phase 4: Backend Implementation (already complete)
6. Proceed with Phase 5: Frontend Implementation
