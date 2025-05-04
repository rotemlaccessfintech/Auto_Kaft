# CLI Command UI

A web interface for managing CLI commands with timers for different environments.

## Features

- Execute CLI commands for different environments
- Automatic 4-hour timers for each environment
- Timer persistence across page refreshes
- Docker support for easy deployment
- Modern UI with Chakra UI

## Prerequisites

- Node.js 16 or higher
- Docker and Docker Compose
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd cli-command-ui
```

2. Install dependencies:
```bash
npm install
```

## Running the Application

### Using Docker (Recommended)

1. Start the application:
```bash
./start-app.cmd
```

2. Stop the application:
```bash
./stop-app.cmd
```

### Manual Development

1. Start the backend server:
```bash
node server.js
```

2. Start the frontend development server:
```bash
npm start
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend: http://localhost:3001

## Project Structure

```
cli-command-ui/
├── src/
│   ├── components/
│   │   └── Timer.js
│   └── App.js
├── server.js
├── Dockerfile.frontend
├── Dockerfile.backend
├── docker-compose.yml
├── start-app.cmd
└── stop-app.cmd
```

## Development

- Frontend code is in the `src` directory
- Backend server code is in `server.js`
- Docker configuration files are in the root directory

## License

MIT 