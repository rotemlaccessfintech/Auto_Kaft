# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Install dependencies needed for Electron and Xvfb
RUN apk add --no-cache \
    udev \
    ttf-freefont \
    dbus \
    chromium \
    xvfb

# Copy only package.json to leverage Docker cache
COPY package.json ./

# Install project dependencies (will generate a lockfile specific to the container env)
RUN npm install

# Copy the rest of the application code (respecting .dockerignore)
COPY . .

# Build the application
RUN npm run build

# Set display port and dbus environment variables for Xvfb
ENV DISPLAY=:99
ENV DBUS_SYSTEM_BUS_ADDRESS=unix:path=/dev/null

# Expose any ports the app might need (if applicable)
# EXPOSE 3000

# Command to run the app using Xvfb
CMD ["sh", "-c", "Xvfb :99 -screen 0 1024x768x16 & npm run electron:start"] 