# App should be already built built at tis moment locally or via github actions
FROM node:22.9.0-alpine

# Create app directory
WORKDIR /usr/src/app

# Use the node user from the image (instead of the root user)
USER node
COPY --chown=node:node ./backend /usr/src/app
COPY --chown=node:node ./frontend/build /var/www/html

# Set NODE_ENV environment variable
ENV NODE_ENV production
RUN npm ci --omit=dev  && npm cache clean --force # reinstall deps since they can be binary incompatible

EXPOSE 3000

# Start the server using the production build
CMD [ "node", "dist/backend/src/main.js" ]
