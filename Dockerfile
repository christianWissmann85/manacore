FROM oven/bun:1

WORKDIR /app

# Copy root config files
COPY package.json bun.lock bunfig.toml tsconfig.json ./

# Copy source code
COPY packages ./packages
COPY scripts ./scripts
COPY experiments ./experiments

# Install dependencies
RUN bun install

# Create output directory for volume mounting
RUN mkdir -p output

# Default entrypoint (can be overridden)
ENTRYPOINT ["bun", "run", "packages/cli-client/src/index.ts"]
