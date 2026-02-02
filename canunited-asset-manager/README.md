# CANUnited Asset Manager

Enterprise-grade multi-vendor electrical asset intelligence platform with predictive maintenance capabilities.

## Live Demo

Visit the live demo: [https://[your-username].github.io/canunited-asset-manager/](https://github.io/canunited-asset-manager/)

### Demo Accounts

| Email | Password | Role | Access Level |
|-------|----------|------|--------------|
| admin@canunited.com | password123 | Administrator | Full access |
| analyst@canunited.com | password123 | Analyst | Analytics, reports, read-only |
| tech@canunited.com | password123 | Technician | Maintenance tasks, field ops |
| viewer@canunited.com | password123 | Viewer | Read-only dashboard |

## Features

### Core Capabilities

- **Multi-Vendor Support**: Schneider Electric, ABB, Siemens, Bosch, Eaton
- **Real-time Monitoring**: Live sensor data with WebSocket updates
- **AI-Powered Predictions**: Remaining Useful Life (RUL) forecasting
- **Predictive Maintenance**: Schedule maintenance before failures occur

### Enterprise Features

- **Multi-Tenancy**: Complete tenant isolation with separate data stores
- **Role-Based Access Control (RBAC)**:
  - Administrator: Full system access
  - Analyst: Data analysis and reporting
  - Technician: Field operations
  - Viewer: Read-only access
- **Multi-Factor Authentication (MFA)**: Google Authenticator / TOTP
- **Single Sign-On Ready**: SAML 2.0 / OpenID Connect hooks
- **LDAP/LDAPS Integration**: Enterprise directory support

### Dashboard & Analytics

- Real-time health monitoring
- Vendor comparison analytics
- Cross-vendor performance correlation
- Lifecycle cost analysis
- Failure risk distribution

### Asset Management

- QR code asset tagging
- Single-line diagram topology view
- Health score tracking (electrical, thermal, insulation, mechanical)
- Document and attachment management

### Maintenance Management

- Work order creation and tracking
- Task assignment and scheduling
- Completion reporting with attachments
- CMMS integration (SAP PM, IBM Maximo, ServiceNow)

### Reports

- PDF and Excel export
- Custom report templates
- Scheduled report generation

## Technology Stack

### Frontend
- React 18 with TypeScript
- Vite for build tooling
- TailwindCSS for styling
- TanStack Query for data fetching
- Zustand for state management
- React Router for navigation
- i18next for internationalization
- Recharts for data visualization
- React Flow for topology diagrams

### Backend
- Node.js with Express
- TypeScript
- PostgreSQL 15 database
- Redis for caching and sessions
- JWT authentication with refresh tokens
- Zod for validation

### Infrastructure
- Docker & Docker Compose
- GitHub Actions for CI/CD
- GitHub Pages for static hosting

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose (for full stack)
- npm or yarn

### Development Mode (Frontend Only)

```bash
# Clone the repository
git clone https://github.com/[your-username]/canunited-asset-manager.git
cd canunited-asset-manager

# Install dependencies
npm install

# Start frontend in demo mode
cd packages/frontend
npm run dev
```

Open http://localhost:3000 in your browser.

### Full Stack (with Docker)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

Services:
- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- PostgreSQL: localhost:5432
- Redis: localhost:6379

### Database Setup

The database is automatically initialized with:
- Demo tenant and users
- Sample sites (Singapore, Malaysia, Thailand)
- Sample assets and sensors
- Health history data

## Project Structure

```
canunited-asset-manager/
├── packages/
│   ├── frontend/          # React frontend
│   │   ├── src/
│   │   │   ├── components/  # Reusable components
│   │   │   ├── pages/       # Page components
│   │   │   ├── stores/      # Zustand stores
│   │   │   ├── lib/         # Utilities and API
│   │   │   └── i18n/        # Internationalization
│   │   └── Dockerfile
│   │
│   ├── backend/           # Express backend
│   │   ├── src/
│   │   │   ├── routes/      # API routes
│   │   │   ├── services/    # Business logic
│   │   │   ├── middleware/  # Auth, error handling
│   │   │   └── db/          # Database connection
│   │   ├── sql/             # Database schema
│   │   └── Dockerfile
│   │
│   └── shared/            # Shared types and utilities
│
├── docker-compose.yml     # Docker configuration
└── docs/                  # Documentation
    └── UPGRADE_PLAN.md    # Implementation roadmap
```

## API Documentation

### Authentication

```bash
# Login
POST /api/v1/auth/login
{
  "email": "admin@canunited.com",
  "password": "password123"
}

# Response (if MFA not enabled)
{
  "success": true,
  "data": {
    "accessToken": "...",
    "refreshToken": "...",
    "user": { ... }
  }
}

# MFA Verify (if MFA enabled)
POST /api/v1/auth/mfa/verify
{
  "userId": "...",
  "code": "123456",
  "tempToken": "..."
}
```

### Resources

- `GET /api/v1/assets` - List assets
- `GET /api/v1/assets/:id` - Get asset details
- `GET /api/v1/sensors` - List sensors
- `GET /api/v1/alerts` - List alerts
- `GET /api/v1/maintenance` - List maintenance tasks
- `GET /api/v1/predictions/:assetId/rul` - Get RUL prediction

## Deployment to GitHub Pages

1. Fork this repository
2. Go to Settings > Pages
3. Set Source to "GitHub Actions"
4. Push to main branch
5. The workflow will automatically build and deploy

## Environment Variables

### Frontend
```env
VITE_API_URL=http://localhost:4000/api
```

### Backend
```env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://host:6379
JWT_SECRET=your-secret-key
```

## Security

- Password hashing with bcrypt (cost factor 12)
- JWT tokens with short expiry (15 min access, 7 day refresh)
- TOTP-based MFA with backup codes
- Session management with Redis
- Audit logging for all actions
- Role-based access control
- Tenant data isolation

## Internationalization

Supported languages:
- English (default)
- Chinese (中文)
- German (Deutsch)
- French (Français)

## License

MIT License

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## Support

For issues and feature requests, please use the GitHub Issues page.
