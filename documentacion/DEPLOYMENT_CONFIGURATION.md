# Deployment Configuration - Store Management System

This document describes the deployment configuration for the Store Management System feature added to the UrbanTaxi platform.

## Overview

The Store Management System extends the existing taxi platform with store registration, discovery, and management capabilities. The deployment configuration has been updated to support these new features while maintaining compatibility with existing functionality.

## Backend Deployment Configuration

### Environment Variables

The following store-related environment variables have been added to `.env.example`:

#### Store Image Upload Configuration
- `STORE_IMAGE_MAX_SIZE_MB=5` - Maximum image size in MB
- `STORE_MAX_LOGO_IMAGES=1` - Maximum number of logo images per store
- `STORE_MAX_PHOTO_IMAGES=10` - Maximum number of photo images per store

#### Store Rate Limiting
- `STORE_CREATION_RATE_LIMIT=5` - Maximum stores per owner
- `STORE_REVIEW_RATE_LIMIT=1` - Maximum reviews per user per store

#### Store Cache Configuration (Redis)
- `STORE_CACHE_TTL_SECONDS=300` - Store list cache TTL (5 minutes)
- `STORE_CATEGORY_CACHE_TTL_SECONDS=3600` - Category cache TTL (1 hour)

#### Store Search Configuration
- `STORE_DEFAULT_SEARCH_RADIUS_KM=50` - Default search radius
- `STORE_MAX_SEARCH_RADIUS_KM=100` - Maximum search radius
- `STORE_DEFAULT_PAGE_SIZE=20` - Default pagination size
- `STORE_MAX_PAGE_SIZE=50` - Maximum pagination size

#### Store Notifications
- `STORE_APPROVAL_NOTIFICATION_ENABLED=true` - Enable approval notifications
- `STORE_REJECTION_NOTIFICATION_ENABLED=true` - Enable rejection notifications
- `STORE_NEW_REVIEW_NOTIFICATION_ENABLED=true` - Enable new review notifications

### Docker Configuration

The `docker-compose.yml` has been updated to include all store-related environment variables with sensible defaults.

### Existing Infrastructure Verification

✅ **Database Connection Pooling**: Already configured via `DATABASE_POOL_MIN` and `DATABASE_POOL_MAX` environment variables. The new store tables work seamlessly with existing pooling configuration.

✅ **Redis Connection**: Already configured and working. Store caching uses the existing Redis instance for:
- Store list caching (5 minutes TTL)
- Category caching (1 hour TTL)
- Rate limiting for store operations

✅ **Cloudinary Integration**: Already configured via `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`. Store images use the existing Cloudinary service with folder structure: `urbantaxi/stores/{storeId}/`

✅ **Admin Panel EJS Views**: The Dockerfile already includes all views via `COPY . .` command. Store management views are located in:
- `backend/views/admin/stores/` - Store management pages
- `backend/views/admin/stores/approvals.ejs` - Store approval queue
- `backend/views/admin/reviews/` - Review management pages
- `backend/views/admin/categories/` - Category management pages

### Database Migrations

Store-related tables are created via Prisma migrations:
- `stores` - Main store data
- `store_categories` - Store categories
- `store_images` - Store images (logo and photos)
- `store_reviews` - Store reviews and ratings
- `store_statistics` - Store analytics (views, calls, directions)
- `store_notifications` - Store-related notifications
- `owner_profiles` - Owner profile data

Run migrations before deployment:
```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```

## Mobile App Deployment Configuration

### App Configuration

The `app.config.js` has been updated with store-related configuration in the `extra` section:

```javascript
extra: {
  router: {},
  eas: {
    projectId: '18144406-d79f-4baa-8918-1f31ecedd9a5',
  },
  // Store Management System Configuration
  storeImageMaxSizeMB: 5,
  storeMaxLogoImages: 1,
  storeMaxPhotoImages: 10,
  storeDefaultSearchRadiusKm: 50,
  storeMaxSearchRadiusKm: 100,
}
```

### Environment Variables

The following store-related environment variables have been added to `app/.env.example`:

```env
# Store Image Upload Configuration
EXPO_PUBLIC_STORE_IMAGE_MAX_SIZE_MB=5
EXPO_PUBLIC_STORE_MAX_LOGO_IMAGES=1
EXPO_PUBLIC_STORE_MAX_PHOTO_IMAGES=10

# Store Search Configuration
EXPO_PUBLIC_STORE_DEFAULT_SEARCH_RADIUS_KM=50
EXPO_PUBLIC_STORE_MAX_SEARCH_RADIUS_KM=100
EXPO_PUBLIC_STORE_DEFAULT_PAGE_SIZE=20
EXPO_PUBLIC_STORE_MAX_PAGE_SIZE=50

# Production API URL (update for production deployment)
# EXPO_PUBLIC_API_URL=https://api.urbantaxi.com
```

### EAS Build Configuration

The `eas.json` has been updated to include environment variables for different build profiles:

- **Development**: `NODE_ENV=development` - For local testing
- **Preview**: `NODE_ENV=staging` - For internal testing
- **Production**: `NODE_ENV=production` - For production releases

### Existing Infrastructure Verification

✅ **EAS Build**: Already configured with project ID `18144406-d79f-4baa-8918-1f31ecedd9a5`. Store features work with existing build configuration.

✅ **Push Notifications**: Already configured via Firebase Cloud Messaging. Store notifications (approval, rejection, new reviews) use the existing notification infrastructure.

✅ **API Endpoints**: The app uses `EXPO_PUBLIC_API_URL` environment variable for API communication. Update this to your production API URL before building for production.

## Production Deployment Checklist

### Backend

1. **Environment Variables**
   - [ ] Copy `.env.example` to `.env`
   - [ ] Configure Cloudinary credentials (already required for existing features)
   - [ ] Configure Firebase credentials (already required for push notifications)
   - [ ] Configure SMTP settings (already required for email notifications)
   - [ ] Review and adjust store-specific settings if needed

2. **Database**
   - [ ] Run Prisma migrations: `npx prisma migrate deploy`
   - [ ] Generate Prisma client: `npx prisma generate`
   - [ ] Seed store categories: `npm run seed:categories`

3. **Redis**
   - [ ] Verify Redis connection (already required for existing features)
   - [ ] No additional Redis configuration needed

4. **Docker Deployment**
   - [ ] Build Docker image: `docker build -t urbantaxi-backend .`
   - [ ] Run with docker-compose: `docker-compose up -d`
   - [ ] Verify admin panel is accessible
   - [ ] Verify store API endpoints are working

### Mobile App

1. **Environment Variables**
   - [ ] Copy `app/.env.example` to `app/.env`
   - [ ] Set `EXPO_PUBLIC_API_URL` to production API URL
   - [ ] Configure Google Maps API key (already required)
   - [ ] Review and adjust store-specific settings if needed

2. **EAS Build**
   - [ ] Verify EAS CLI is installed: `npm install -g eas-cli`
   - [ ] Login to EAS: `eas login`
   - [ ] Configure credentials: `eas credentials`
   - [ ] Build for preview: `eas build --profile preview --platform all`
   - [ ] Build for production: `eas build --profile production --platform all`

3. **Push Notifications**
   - [ ] Verify Firebase credentials are configured (already required)
   - [ ] Test store approval notifications
   - [ ] Test store rejection notifications
   - [ ] Test new review notifications

## API Endpoints for Store Management

The following API endpoints are available for store management:

### Store Endpoints
- `POST /api/stores` - Create store (owner role required)
- `GET /api/stores` - List stores with filters
- `GET /api/stores/:id` - Get store details
- `PUT /api/stores/:id` - Update store (owner role required)
- `DELETE /api/stores/:id` - Delete store (owner role required)
- `GET /api/stores/my-stores` - Get owner's stores (owner role required)
- `PUT /api/stores/:id/status` - Update store status (admin only)
- `POST /api/stores/:id/images` - Upload store image (owner role required)
- `DELETE /api/stores/:id/images/:imageId` - Delete store image (owner role required)

### Review Endpoints
- `POST /api/stores/:id/reviews` - Create review
- `GET /api/stores/:id/reviews` - Get store reviews
- `PUT /api/reviews/:id` - Update review
- `DELETE /api/reviews/:id` - Delete review

### Category Endpoints
- `GET /api/categories` - Get all categories
- `POST /api/categories` - Create category (admin only)

### Statistics Endpoints
- `GET /api/stores/:id/stats` - Get store statistics (owner role required)
- `POST /api/stores/:id/track` - Track store event (view, call, directions)

### Admin Panel Routes
- `/admin/stores` - Store management
- `/admin/stores/approvals` - Store approval queue
- `/admin/reviews` - Review management
- `/admin/categories` - Category management

## Monitoring and Maintenance

### Metrics to Monitor

1. **Store Operations**
   - Store creation rate
   - Store approval/rejection rate
   - Average approval time
   - Active stores count

2. **Performance**
   - Store search response time
   - Image upload success rate
   - Cache hit rate for store lists
   - Database query performance

3. **User Engagement**
   - Store views per day
   - Store calls per day
   - Direction requests per day
   - Review submission rate

### Maintenance Tasks

1. **Regular Tasks**
   - Monitor Cloudinary storage usage
   - Review and moderate store content
   - Clean up rejected/inactive stores
   - Monitor Redis cache performance

2. **Database Maintenance**
   - Monitor store table sizes
   - Optimize indexes if needed
   - Archive old statistics data
   - Backup store images

## Troubleshooting

### Common Issues

1. **Store images not uploading**
   - Verify Cloudinary credentials are configured
   - Check image size limits (5MB default)
   - Verify network connectivity to Cloudinary

2. **Store search not working**
   - Verify Redis is running
   - Check database indexes on stores table
   - Verify latitude/longitude data is present

3. **Push notifications not sending**
   - Verify Firebase credentials are configured
   - Check notification token registration
   - Verify notification settings in environment variables

4. **Admin panel not accessible**
   - Verify views directory is included in Docker image
   - Check admin authentication
   - Verify EJS templates are properly compiled

## Security Considerations

1. **Authentication & Authorization**
   - Store creation requires "owner" role
   - Store updates require ownership verification
   - Admin operations require "admin" role
   - JWT tokens are used for authentication

2. **Rate Limiting**
   - Store creation limited to 5 stores per owner
   - Review creation limited to 1 per user per store
   - Image uploads are rate-limited

3. **Data Validation**
   - All inputs are validated using Zod schemas
   - Image uploads are validated for type and size
   - SQL injection prevention via Prisma ORM
   - XSS prevention via input sanitization

4. **File Upload Security**
   - Images are uploaded to Cloudinary (not local storage)
   - File type validation (JPEG, PNG, WebP only)
   - File size validation (5MB max)
   - Malicious file detection

## Support

For deployment issues or questions, refer to:
- Backend README: `backend/README.md`
- Store Integration Guide: `backend/STORE_INTEGRATION_TEST_GUIDE.md`
- Seed Data Guide: `backend/SEED_DATA_QUICK_START.md`
- Task Implementation Summaries in backend directory

## Version Information

- Node.js: 20.18.1 (LTS)
- Expo SDK: 50+
- PostgreSQL: 15+ with PostGIS
- Redis: 7+
- Prisma: Latest
- React Native: Latest (via Expo)
