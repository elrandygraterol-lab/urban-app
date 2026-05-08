# UrbanTaxi Backend API

Backend API for the UrbanTaxi platform built with Express.js and TypeScript.

## 🚀 Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js 4.x
- **Language**: TypeScript
- **Database**: PostgreSQL 15+ with PostGIS
- **Cache**: Redis 7+
- **Authentication**: JWT
- **Real-time**: Socket.io
- **Validation**: Zod
- **Logging**: Winston

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/           # Configuration files
│   ├── controllers/      # Route controllers
│   ├── services/         # Business logic
│   ├── models/           # Database models
│   ├── middleware/       # Express middleware
│   ├── routes/           # API routes
│   ├── utils/            # Utility functions
│   ├── types/            # TypeScript types
│   ├── app.ts            # Express app setup
│   └── server.ts         # Server entry point
├── logs/                 # Log files
├── dist/                 # Compiled JavaScript
├── .env.example          # Environment variables template
├── package.json
└── tsconfig.json
```

## 🛠️ Installation

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Update `.env` with your configuration

## 🏃 Running the Server

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

## 📝 Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate coverage report

## 🔌 API Endpoints

### Health Check
- `GET /health` - Server health status

### Authentication (Coming Soon)
- `POST /api/auth/register/passenger` - Register passenger
- `POST /api/auth/register/driver` - Register driver
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/logout` - Logout

### Users (Coming Soon)
- `GET /api/users/passengers` - List passengers
- `GET /api/users/drivers` - List drivers
- `PUT /api/users/:id` - Update user

### Rides (Coming Soon)
- `POST /api/rides/request` - Request ride
- `POST /api/rides/:id/accept` - Accept ride
- `GET /api/rides/active` - Get active rides

## 🔐 Environment Variables

See `.env.example` for all required environment variables.

Key variables:
- `PORT` - Server port (default: 3000)
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - JWT signing secret
- `GOOGLE_MAPS_API_KEY` - Google Maps API key

## 🧪 Testing

```bash
npm test
```

## 📦 Deployment

1. Build the application:
```bash
npm run build
```

2. Set production environment variables

3. Start the server:
```bash
npm start
```

## 📄 License

Private - All rights reserved
