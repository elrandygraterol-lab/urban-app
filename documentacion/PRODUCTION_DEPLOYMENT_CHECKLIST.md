# Production Deployment Checklist - Store Management System

Use this checklist to ensure all components are properly configured before deploying to production.

## Pre-Deployment Verification

### Backend Infrastructure

- [ ] **Database Connection**
  - [ ] PostgreSQL 15+ with PostGIS extension installed
  - [ ] Database connection string configured in `DATABASE_URL`
  - [ ] Connection pooling configured (`DATABASE_POOL_MIN=2`, `DATABASE_POOL_MAX=10`)
  - [ ] Database accessible from backend server

- [ ] **Redis Cache**
  - [ ] Redis 7+ instance running
  - [ ] Redis connection string configured in `REDIS_URL`
  - [ ] Redis password configured if required
  - [ ] Redis accessible from backend server

- [ ] **Cloudinary Storage**
  - [ ] Cloudinary account created
  - [ ] `CLOUDINARY_CLOUD_NAME` configured
  - [ ] `CLOUDINARY_API_KEY` configured
  - [ ] `CLOUDINARY_API_SECRET` configured
  - [ ] Storage quota sufficient for store images

- [ ] **Firebase Cloud Messaging**
  - [ ] Firebase project created
  - [ ] Service account JSON file placed in `backend/config/firebase-service-account.json`
  - [ ] `FIREBASE_DATABASE_URL` configured
  - [ ] `FIREBASE_PROJECT_ID` configured
  - [ ] Push notification credentials configured

- [ ] **Email Service (SMTP)**
  - [ ] SMTP server configured (`SMTP_HOST`, `SMTP_PORT`)
  - [ ] SMTP credentials configured (`SMTP_USER`, `SMTP_PASSWORD`)
  - [ ] Email sender address configured (`EMAIL_FROM`)
  - [ ] Test email sent successfully

### Backend Configuration

- [ ] **Environment Variables**
  - [ ] All required variables from `.env.example` configured in `.env`
  - [ ] `JWT_SECRET` set to strong random value (production)
  - [ ] `JWT_REFRESH_SECRET` set to strong random value (production)
  - [ ] `NODE_ENV=production` for production deployment
  - [ ] `CORS_ORIGIN` configured with production frontend URLs
  - [ ] Store-specific variables reviewed and adjusted if needed

- [ ] **Database Migrations**
  - [ ] Backup existing database
  - [ ] Run migrations: `npx prisma migrate deploy`
  - [ ] Generate Prisma client: `npx prisma generate`
  - [ ] Verify all store tables created successfully
  - [ ] Seed store categories: `npm run seed:categories`

- [ ] **Admin Panel**
  - [ ] Admin user account created
  - [ ] Admin panel accessible at `/admin/dashboard`
  - [ ] Store management pages working
  - [ ] Store approval queue accessible
  - [ ] Review management working
  - [ ] Category management working

### Mobile App Configuration

- [ ] **Environment Variables**
  - [ ] `EXPO_PUBLIC_API_URL` set to production backend URL
  - [ ] `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` configured
  - [ ] Store-specific variables reviewed and adjusted if needed

- [ ] **EAS Build Configuration**
  - [ ] EAS CLI installed: `npm install -g eas-cli`
  - [ ] Logged in to EAS: `eas login`
  - [ ] Project ID verified in `app.config.js`
  - [ ] Build profiles configured in `eas.json`

- [ ] **Push Notifications**
  - [ ] Firebase credentials configured in app
  - [ ] Google Services files present:
    - [ ] `app/google-services.json` (Android)
    - [ ] `app/GoogleService-Info.plist` (iOS)
  - [ ] Push notification permissions requested in app
  - [ ] Test notification received successfully

## Deployment Steps

### Backend Deployment

#### Option 1: Docker Deployment (Recommended)

1. **Build Docker Image**
   ```bash
   cd backend
   docker build -t urbantaxi-backend:latest .
   ```
   - [ ] Build completed successfully
   - [ ] No build errors

2. **Start Services with Docker Compose**
   ```bash
   docker-compose up -d
   ```
   - [ ] PostgreSQL container running
   - [ ] Redis container running
   - [ ] Backend container running
   - [ ] All health checks passing

3. **Verify Deployment**
   ```bash
   curl http://localhost:3000/api/health
   ```
   - [ ] Health check returns 200 OK
   - [ ] Database connection healthy
   - [ ] Redis connection healthy

#### Option 2: Manual Deployment

1. **Install Dependencies**
   ```bash
   cd backend
   npm ci --production
   ```
   - [ ] Dependencies installed successfully

2. **Build TypeScript**
   ```bash
   npm run build
   ```
   - [ ] Build completed successfully
   - [ ] `dist/` directory created

3. **Start Server**
   ```bash
   npm start
   ```
   - [ ] Server started successfully
   - [ ] Listening on configured port

### Mobile App Deployment

#### Build for Preview (Internal Testing)

1. **Build Preview APK/IPA**
   ```bash
   cd app
   eas build --profile preview --platform all
   ```
   - [ ] Android APK built successfully
   - [ ] iOS IPA built successfully (if applicable)

2. **Test Preview Build**
   - [ ] Install preview build on test device
   - [ ] Test store discovery features
   - [ ] Test store registration (owner role)
   - [ ] Test store management (owner role)
   - [ ] Test store approval (admin panel)
   - [ ] Test push notifications

#### Build for Production

1. **Build Production App Bundle**
   ```bash
   cd app
   eas build --profile production --platform all
   ```
   - [ ] Android App Bundle (.aab) built successfully
   - [ ] iOS IPA built successfully (if applicable)

2. **Submit to App Stores**
   ```bash
   eas submit --platform android
   eas submit --platform ios
   ```
   - [ ] Android submission to Google Play Store
   - [ ] iOS submission to Apple App Store (if applicable)

## Post-Deployment Verification

### Backend API Testing

- [ ] **Store Endpoints**
  - [ ] `GET /api/stores` - List stores working
  - [ ] `GET /api/stores/:id` - Get store details working
  - [ ] `POST /api/stores` - Create store working (owner role)
  - [ ] `PUT /api/stores/:id` - Update store working (owner role)
  - [ ] `DELETE /api/stores/:id` - Delete store working (owner role)
  - [ ] `GET /api/stores/my-stores` - Get owner stores working

- [ ] **Image Upload**
  - [ ] `POST /api/stores/:id/images` - Upload logo working
  - [ ] `POST /api/stores/:id/images` - Upload photos working
  - [ ] `DELETE /api/stores/:id/images/:imageId` - Delete image working
  - [ ] Images accessible via Cloudinary URLs

- [ ] **Review Endpoints**
  - [ ] `POST /api/stores/:id/reviews` - Create review working
  - [ ] `GET /api/stores/:id/reviews` - Get reviews working
  - [ ] `PUT /api/reviews/:id` - Update review working
  - [ ] `DELETE /api/reviews/:id` - Delete review working

- [ ] **Category Endpoints**
  - [ ] `GET /api/categories` - Get categories working
  - [ ] Categories seeded correctly

- [ ] **Statistics Endpoints**
  - [ ] `GET /api/stores/:id/stats` - Get statistics working
  - [ ] `POST /api/stores/:id/track` - Track events working

- [ ] **Admin Endpoints**
  - [ ] `PUT /api/stores/:id/status` - Approve store working
  - [ ] `PUT /api/stores/:id/status` - Reject store working
  - [ ] Admin authentication working

### Admin Panel Testing

- [ ] **Dashboard**
  - [ ] Dashboard loads successfully
  - [ ] Store metrics displayed correctly
  - [ ] Pending approvals badge showing correct count

- [ ] **Store Management**
  - [ ] Store list displays correctly
  - [ ] Store filters working
  - [ ] Store search working
  - [ ] Store details modal working
  - [ ] Store edit working
  - [ ] Store delete working

- [ ] **Store Approval Queue**
  - [ ] Pending stores displayed
  - [ ] Approve button working
  - [ ] Reject button working
  - [ ] Rejection reason required
  - [ ] Notifications sent on approval/rejection

- [ ] **Review Management**
  - [ ] Review list displays correctly
  - [ ] Review filters working
  - [ ] Delete inappropriate reviews working

- [ ] **Category Management**
  - [ ] Category list displays correctly
  - [ ] Add category working
  - [ ] Edit category working
  - [ ] Deactivate category working

### Mobile App Testing

- [ ] **Store Discovery (All Roles)**
  - [ ] Store list displays correctly
  - [ ] Store search working
  - [ ] Store filters working
  - [ ] Store sorting working
  - [ ] Store map view working
  - [ ] Store details view working
  - [ ] Call button working
  - [ ] Directions button working

- [ ] **Store Management (Owner Role)**
  - [ ] "Mis Tiendas" tab visible for owners
  - [ ] "+" button to add store visible
  - [ ] Store registration form working
  - [ ] Image upload working (logo and photos)
  - [ ] Store edit working
  - [ ] Store activation toggle working
  - [ ] Store statistics visible
  - [ ] Store deletion working

- [ ] **Store Reviews (All Roles)**
  - [ ] Rate store button working
  - [ ] Submit review working
  - [ ] View reviews working
  - [ ] Edit own review working
  - [ ] Delete own review working

- [ ] **Push Notifications**
  - [ ] Store approval notification received
  - [ ] Store rejection notification received
  - [ ] New review notification received
  - [ ] Notification tap navigation working

### Performance Testing

- [ ] **Backend Performance**
  - [ ] Store list query < 500ms (95th percentile)
  - [ ] Store details query < 200ms (95th percentile)
  - [ ] Image upload < 5 seconds
  - [ ] Search with filters < 1 second

- [ ] **Mobile App Performance**
  - [ ] Store list loads quickly
  - [ ] Images load with lazy loading
  - [ ] Map markers render smoothly
  - [ ] No memory leaks during navigation

- [ ] **Cache Performance**
  - [ ] Store list cached for 5 minutes
  - [ ] Categories cached for 1 hour
  - [ ] Cache invalidation working on updates

### Security Testing

- [ ] **Authentication & Authorization**
  - [ ] Store creation requires "owner" role
  - [ ] Store updates require ownership
  - [ ] Admin operations require "admin" role
  - [ ] Unauthorized access returns 403

- [ ] **Rate Limiting**
  - [ ] Store creation limited to 5 per owner
  - [ ] Review creation limited to 1 per user per store
  - [ ] Rate limit errors handled gracefully

- [ ] **Input Validation**
  - [ ] Invalid inputs rejected with clear errors
  - [ ] SQL injection attempts blocked
  - [ ] XSS attempts sanitized
  - [ ] File upload validation working

## Monitoring Setup

- [ ] **Application Monitoring**
  - [ ] Error tracking configured (Sentry)
  - [ ] Log aggregation configured
  - [ ] Performance monitoring enabled
  - [ ] Uptime monitoring configured

- [ ] **Infrastructure Monitoring**
  - [ ] Database monitoring enabled
  - [ ] Redis monitoring enabled
  - [ ] Server resource monitoring enabled
  - [ ] Cloudinary usage monitoring enabled

- [ ] **Alerts Configuration**
  - [ ] High error rate alerts
  - [ ] Database connection alerts
  - [ ] Redis connection alerts
  - [ ] Storage quota alerts
  - [ ] Performance degradation alerts

## Rollback Plan

- [ ] **Database Rollback**
  - [ ] Database backup created before deployment
  - [ ] Rollback migration script prepared
  - [ ] Rollback procedure documented

- [ ] **Application Rollback**
  - [ ] Previous Docker image tagged and saved
  - [ ] Previous app version available in EAS
  - [ ] Rollback procedure documented
  - [ ] Rollback tested in staging

## Documentation

- [ ] **Deployment Documentation**
  - [ ] Deployment configuration documented
  - [ ] Environment variables documented
  - [ ] API endpoints documented
  - [ ] Admin panel usage documented

- [ ] **User Documentation**
  - [ ] Store registration guide created
  - [ ] Store management guide created
  - [ ] FAQ updated with store features
  - [ ] Support team trained on new features

## Sign-Off

- [ ] **Technical Lead Approval**
  - Name: ___________________________
  - Date: ___________________________
  - Signature: ___________________________

- [ ] **QA Approval**
  - Name: ___________________________
  - Date: ___________________________
  - Signature: ___________________________

- [ ] **Product Owner Approval**
  - Name: ___________________________
  - Date: ___________________________
  - Signature: ___________________________

## Notes

Add any deployment notes, issues encountered, or special considerations:

_______________________________________________________________________________

_______________________________________________________________________________

_______________________________________________________________________________

_______________________________________________________________________________

_______________________________________________________________________________
