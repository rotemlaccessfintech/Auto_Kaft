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

### Linting

```bash
npm run lint
```

## Docker

To build and run the application using Docker:

1.  **Build the Docker image:**

    ```bash
    docker build -t cli-command-ui .
    ```

2.  **Run the application in a container:**

    ```bash
    # Note: Running GUI applications from Docker can be complex and platform-dependent.
    # This command attempts to forward the X11 socket for Linux hosts.
    # Adjustments might be needed for macOS or Windows.

    # For Linux (ensure X11 server is running and accessible):
    docker run --rm -it \
        -e DISPLAY=$DISPLAY \
        -v /tmp/.X11-unix:/tmp/.X11-unix \
        cli-command-ui

    # Alternative using Xvfb (as defined in Dockerfile, no host X11 needed):
    # This runs the app headlessly within the container's virtual framebuffer.
    # You might need other tools (like VNC) to view the UI if run this way.
    docker run --rm -it cli-command-ui
    ```

    - The first `docker run` command attempts to connect to your host's X server to display the GUI. This often requires specific host configuration (`xhost +local:docker` might be needed).
    - The second `docker run` command uses the `Xvfb` setup within the container. The app runs, but you won't see the UI directly unless you connect to the container's virtual display (e.g., via VNC, which is not set up by default in this Dockerfile).
