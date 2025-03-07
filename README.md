# PCMS Frontend

A modern React-based frontend for the Power Consumption Management System (PCMS). Built with Vite, TypeScript, and Tailwind CSS.

## Features

- 🚀 User authentication and authorization
- 📊 Power consumption tracking and analysis
- 💼 Plan management and subscriptions
- 📱 Responsive design
- 🔄 Real-time updates
- 📄 PDF report generation

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Docker
- GitHub Container Registry
- AWS S3

## Project Structure

```
pcms-frontend/
├── .github/workflows/      # CI/CD workflows
├── src/                   # Application source
├── docker/               # Docker configurations
├── nginx/               # Nginx settings
├── scripts/            # Deployment scripts
└── aws/               # AWS configurations
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Docker (optional)
- AWS CLI (for deployment)

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test
```

### Docker Development

```bash
# Build and run development container
npm run docker:dev

# Build production image
npm run docker:build

# Run production container
npm run docker:prod
```

## Deployment

### GitHub Container Registry

The application is automatically built and pushed to GHCR on every push to main branch.

```bash
# Pull latest image
docker pull ghcr.io/yourusername/pcms-frontend:latest

# Run container
docker run -p 80:80 ghcr.io/yourusername/pcms-frontend:latest
```

### AWS S3 Deployment

```bash
# Deploy to S3
npm run deploy
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm test` - Run tests
- `npm run docker:dev` - Run development Docker container
- `npm run docker:prod` - Run production Docker container
- `npm run deploy` - Deploy to AWS S3

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- React Team
- Vite Team
- Tailwind CSS Team
- All contributors