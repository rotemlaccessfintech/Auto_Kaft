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

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Attempt to fix optional dependency issue with rollup on alpine/musl
RUN npm install --no-save @rollup/rollup-linux-x64-musl

# Install project dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the application (if needed)
# Assuming your build script is 'npm run build'
RUN npm run build

# Set display port and dbus environment variables for Xvfb
ENV DISPLAY=:99
ENV DBUS_SYSTEM_BUS_ADDRESS=unix:path=/dev/null

# Expose any ports the app might need (if applicable)
# EXPOSE 3000

# Command to run the app using Xvfb
CMD ["sh", "-c", "Xvfb :99 -screen 0 1024x768x16 & npm start"] 