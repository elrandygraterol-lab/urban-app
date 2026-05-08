# OSRM Self-Hosted Setup Guide

## Quick Start (5 minutes)

### Prerequisites
- Docker installed
- Docker Compose installed
- 5-10GB free disk space
- Internet connection

### Step 1: Prepare OSM Data

**Windows (PowerShell):**
```powershell
cd backend
.\scripts\setup-osrm.ps1 -Region argentina
```

**Linux/Mac (Bash):**
```bash
cd backend
chmod +x scripts/setup-osrm.sh
./scripts/setup-osrm.sh argentina
```

This script will:
1. Download OpenStreetMap data for Argentina (~500MB)
2. Extract OSRM data (osrm-extract)
3. Partition data (osrm-partition)
4. Customize data (osrm-customize)

**Time**: 10-30 minutes depending on region size and internet speed

### Step 2: Start OSRM Server

```bash
docker-compose -f docker-compose.osrm.yml up -d
```

### Step 3: Verify OSRM is Running

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

### Step 4: Test a Route

```bash
curl 'http://localhost:5000/route/v1/driving/-74.0060,40.7128;-73.9855,40.7580?overview=full'
```

## Configuration

### Environment Variables

Update `backend/.env`:
```
OSRM_URL=http://localhost:5000
```

For production:
```
OSRM_URL=http://your-vps-ip:5000
```

### Docker Compose

File: `backend/docker-compose.osrm.yml`

Key settings:
- **Port**: 5000 (default)
- **Algorithm**: MLD (Multi-Level Dijkstra) - fastest
- **Health Check**: Every 30 seconds
- **Restart Policy**: Unless stopped

## Supported Regions

Download from Geofabrik: https://download.geofabrik.de/

### South America
- Argentina: `argentina-latest.osm.pbf`
- Brazil: `brazil-latest.osm.pbf`
- Colombia: `colombia-latest.osm.pbf`
- Peru: `peru-latest.osm.pbf`
- Chile: `chile-latest.osm.pbf`
- Venezuela: `venezuela-latest.osm.pbf`

### Central America
- Mexico: `mexico-latest.osm.pbf`
- Guatemala: `guatemala-latest.osm.pbf`
- Costa Rica: `costa-rica-latest.osm.pbf`

### Other Regions
- Europe: `europe-latest.osm.pbf`
- Asia: `asia-latest.osm.pbf`
- Africa: `africa-latest.osm.pbf`
- North America: `north-america-latest.osm.pbf`

## Production Deployment

### VPS Setup (AWS, DigitalOcean, Linode, etc.)

**1. Provision Instance**
- OS: Ubuntu 20.04 LTS
- RAM: 2GB minimum (4GB recommended)
- CPU: 2 cores minimum
- Storage: 20GB SSD
- Network: Allow inbound on port 5000

**2. Install Docker**

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker
```

**3. Clone Repository**

```bash
git clone <your-repo>
cd backend
```

**4. Setup OSRM**

```bash
./scripts/setup-osrm.sh argentina
```

**5. Start OSRM**

```bash
docker-compose -f docker-compose.osrm.yml up -d
```

**6. Configure Firewall**

```bash
# Allow port 5000
sudo ufw allow 5000/tcp

# Or restrict to backend server only
sudo ufw allow from <backend-server-ip> to any port 5000
```

**7. Update Backend Configuration**

```bash
# Update .env
OSRM_URL=http://your-vps-ip:5000
```

**8. Verify**

```bash
curl http://your-vps-ip:5000/status
```

## Monitoring

### Check Status

```bash
# Container status
docker ps | grep osrm

# Service health
curl http://localhost:5000/status

# Logs
docker-compose -f docker-compose.osrm.yml logs -f osrm
```

### Resource Usage

```bash
docker stats osrm
```

### Performance Metrics

Via backend API:
```bash
curl http://localhost:3000/api/infrastructure/metrics
```

## Troubleshooting

### OSRM Container Won't Start

```bash
# Check logs
docker-compose -f docker-compose.osrm.yml logs osrm

# Verify data files exist
ls -la osrm-data/

# Restart container
docker-compose -f docker-compose.osrm.yml restart osrm
```

### High Memory Usage

OSRM loads entire region into memory. If experiencing issues:

**Option 1: Use smaller region**
```bash
./scripts/setup-osrm.sh costa-rica
```

**Option 2: Increase VPS RAM**
- Upgrade to 4GB or 8GB instance

**Option 3: Use different profile**
```bash
# Edit docker-compose.osrm.yml
# Change: /data/argentina-latest.osrm
# To: /data/argentina-latest.osrm.foot
```

### Slow Response Times

Check:
1. Network latency to OSRM server
2. OSRM resource usage (`docker stats osrm`)
3. Backend logs for errors
4. Database query performance

### Port Already in Use

```bash
# Find process using port 5000
lsof -i :5000

# Kill process
kill -9 <PID>

# Or use different port in docker-compose.osrm.yml
# Change: "5000:5000"
# To: "5001:5000"
```

## Maintenance

### Update OSRM Image

```bash
# Pull latest version
docker pull osrm/osrm-backend:v5.27.1

# Restart container
docker-compose -f docker-compose.osrm.yml restart osrm
```

### Update OSM Data

```bash
# Backup current data
cp -r osrm-data osrm-data.backup

# Download new data
./scripts/setup-osrm.sh argentina

# Restart OSRM
docker-compose -f docker-compose.osrm.yml restart osrm
```

### Backup Configuration

```bash
# Backup docker-compose file
cp docker-compose.osrm.yml docker-compose.osrm.yml.backup

# Backup OSM data
tar -czf osrm-data-backup.tar.gz osrm-data/
```

## Performance Optimization

### Caching

Enable caching in backend:
```typescript
import { osrmService } from './services/osrmService';

// Caching is enabled by default
// Cache TTL: 1 hour
// Max cached routes: 1000
```

### Load Balancing

For high traffic, run multiple OSRM instances:

```yaml
# docker-compose.osrm.yml
services:
  osrm-1:
    image: osrm/osrm-backend:v5.27.1
    ports:
      - "5000:5000"
    
  osrm-2:
    image: osrm/osrm-backend:v5.27.1
    ports:
      - "5001:5000"
    
  osrm-3:
    image: osrm/osrm-backend:v5.27.1
    ports:
      - "5002:5000"
```

Then configure load balancer (nginx, HAProxy, etc.)

### CDN/Caching Layer

Consider adding:
- Nginx reverse proxy with caching
- Redis for route caching
- CloudFlare for geographic distribution

## Cost Analysis

### Self-Hosted OSRM

**Monthly Cost:**
- VPS (2GB RAM, 2 CPU): $5-15
- Storage (20GB SSD): $0-5
- Bandwidth: $0-10
- **Total**: $5-30/month

**vs Google Maps:**
- Google Maps: $100-200+/month (variable)
- **Savings**: 75-90%

## Support & Resources

- OSRM Documentation: https://project-osrm.org/docs/v5.27.1/api/
- Geofabrik Downloads: https://download.geofabrik.de/
- Docker Documentation: https://docs.docker.com/
- OpenStreetMap: https://www.openstreetmap.org/

## Next Steps

1. ✅ Setup OSRM self-hosted
2. Configure Mapbox API key
3. Start monitoring service
4. Configure automatic backups
5. Proceed with Phase 5: Frontend Implementation
